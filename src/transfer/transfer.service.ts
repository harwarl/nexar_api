import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { Transaction } from 'src/swap/types/transaction.interface';
import { CreateTransferTransactionDto } from './dto/CreateTransferTransaction.dto';
import {
  Contract,
  formatEther,
  formatUnits,
  parseEther,
  parseUnits,
  toBigInt,
  TransactionResponse,
  Wallet,
} from 'ethers';

import {
  BACKEND_WALLET_1,
  BACKEND_WALLET_2,
  ETH,
  ETH_GAS_FEES,
  ETH_USDT,
  FEE_PERCENTAGE,
  minimumAmounts,
  REASON,
  STATUS,
  TRANSFER_SIGNATURE,
  USDT,
} from 'utils/constants';
import { VerifyTransactionHashDto } from './dto/VerifyTransactionHash.dto';
import { ABI, ERC20_Interface, provider, wssProvider } from 'utils/ethers';
import { StartTransferTransactionDto } from './dto/StartTransferProcess.dto';
import { WormholeService } from './wormhole.service';

@Injectable()
export class TransferService {
  constructor(
    private readonly wormholeService: WormholeService,
    @Inject('TRANSACTION_MODEL') private transactionModel: Model<Transaction>,
  ) {}

  async createTransaction(
    createTransactionPayload: CreateTransferTransactionDto,
  ) {
    const { from, to, amount, address } = createTransactionPayload;

    if (from !== to) {
      throw new BadRequestException(
        `"from" (${from}) and "to" (${to}) should be the same.`,
      );
    }

    if (!minimumAmounts[from] || !minimumAmounts[to]) {
      throw new BadRequestException('Invalid Tokens');
    }

    if (minimumAmounts[from] && amount < minimumAmounts[from]) {
      throw new BadRequestException(
        `Minimum amount for ${from} transfers is ${minimumAmounts[from]}`,
      );
    }

    let newTransaction = await this.transactionModel.create({
      txId: this.generateRandomTxId(),
      isTransfer: true,
      payinAddress: BACKEND_WALLET_1,
      payoutAddress: BACKEND_WALLET_2,
      expectedSendAmount: amount,
      tokensDestination: address,
      inApp: true,
      volumeInUsdt: 0,
      fromCurrency: from.toUpperCase(),
      toCurrency: to.toUpperCase(),
      status: STATUS.WAITING,
    });

    return newTransaction;
  }

  async verifyTransactionHash(verifyTransactionHash: VerifyTransactionHashDto) {
    const { transactionHash, transactionId } = verifyTransactionHash;

    const transactionExists = await this.transactionModel.findOne({
      txId: transactionId,
    });

    if (!transactionExists)
      throw new NotFoundException('Transaction Not found');

    if (transactionExists.payinHash)
      throw new BadRequestException(
        'Transaction Hash already consumed for this transaction',
      );

    const validTransaction =
      await this.verifyTransactionFromTransactionHash(transactionHash);

    console.log({ validTransaction });

    if (!validTransaction.success)
      throw new BadRequestException('Invalid transaction hash');

    if (!validTransaction.meetThreshold)
      throw new BadRequestException('Amount does not meet threshold');

    await this.transactionModel.updateOne(
      {
        txId: transactionId,
      },
      {
        $set: {
          status: STATUS.ORDER_CREATED,
          payinHash: transactionHash,
          amountSend: validTransaction.amountInETh,
        },
      },
    );

    return { success: true, message: 'Hash verified' };
  }

  async startTransferProcess(startTransferDto: StartTransferTransactionDto) {
    const { transactionId } = startTransferDto;

    const transactionExists = await this.transactionModel.findOne({
      txId: transactionId,
    });

    if (!transactionExists)
      throw new BadRequestException('Invalid Transaction Id');

    if (transactionExists.status === 'finished') {
      return {
        success: true,
        message: 'Transaction completed',
      };
    }

    const { fromCurrency, toCurrency, expectedSendAmount } = transactionExists;

    if (fromCurrency !== toCurrency) {
      throw new BadRequestException('Invalid Transfer Transaction');
    }

    // const minAmountRequired = minimumAmounts[fromCurrency];

    // if (!amountSend || Number(amountSend) < minAmountRequired) {
    //   throw new BadRequestException(
    //     `Insufficient amount. Minimum required for ${fromCurrency}: ${minAmountRequired}`,
    //   );
    // }

    const successTx = await this.startTransactionListener(transactionExists);
    const { txHash, sender, amountReceived: amountSend, error } = successTx;

    if (error) {
      await this.transactionModel.updateOne(
        {
          txId: transactionExists.txId,
        },
        {
          status: STATUS.FAILED,
          reason: REASON.NO_AMOUNT,
        },
      );

      throw new Error(error);
    }

    await this.transactionModel.updateOne(
      {
        txId: transactionExists.txId,
      },
      {
        status: STATUS.ORDER_CREATED,
        payinHash: txHash,
        sender,
        amountSend,
      },
    );

    // Start the transaction
    try {
      const amountToReceive =
        Number(amountSend * (1 - FEE_PERCENTAGE)) - ETH_GAS_FEES;

      const amountToBridge = (
        amountToReceive + Number(ETH_GAS_FEES * 0.6)
      ).toString();
      // Bridge to OASIS
      await this.wormholeService.bridgeToOasis(
        amountToBridge,
        fromCurrency,
        transactionExists.txId,
      );

      await this.transactionModel.updateOne(
        {
          txId: transactionExists.txId,
        },
        {
          $set: {
            status: STATUS.OASIS_CLAIM,
            sender,
          },
        },
      );

      // Bridge to ETHEREUM
      await this.wormholeService.bridgeToEthereum(
        amountToBridge,
        fromCurrency,
        transactionExists.txId,
      );

      await this.transactionModel.updateOne(
        {
          txId: transactionExists.txId,
        },
        {
          $set: {
            status: STATUS.RECEIVER_ROUTING,
          },
        },
      );

      // Send to reciever
      const tx = await this.transferToReciever(
        amountToReceive.toString(),
        transactionExists.tokensDestination,
        transactionExists.fromCurrency,
      );

      await this.transactionModel.updateOne(
        {
          txId: transactionExists.txId,
        },
        {
          $set: {
            status: STATUS.ORDER_COMPLETED,
            payoutHash: tx.hash,
          },
        },
      );
    } catch (error) {
      console.error('Error in transfer process:', error);
      await this.transactionModel.updateOne(
        {
          txId: transactionId,
        },
        {
          status: STATUS.FAILED,
          reason: error.message,
        },
      );
      throw new BadRequestException('Transaction failed, please try again.');
    }
  }

  async transferToReciever(
    amountToSend: string,
    recipientAddress: string,
    ticker: string,
  ) {
    try {
      const signer = new Wallet(process.env.ETH_PRIVATE_KEY_2!, provider);

      let tx: TransactionResponse;
      if (ticker.toUpperCase() == ETH.toUpperCase()) {
        tx = await signer.sendTransaction({
          to: recipientAddress,
          value: parseEther(amountToSend),
        });
      } else {
        const usdtContract = new Contract(ETH_USDT, ABI, signer);
        const decimals = await usdtContract.decimals();
        const amountInUnits = parseUnits(amountToSend, decimals);

        tx = await usdtContract.transfer(recipientAddress, amountInUnits);
      }

      const txnReceipt = await tx.wait();
      return txnReceipt;
    } catch (error) {
      console.log('Error sending transaction: ', error);
    }
  }

  generateRandomTxId() {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let txId = '';

    for (let i = 0; i < 14; i++) {
      txId += chars[Math.floor(Math.random() * chars.length)];
    }

    return txId;
  }

  async verifyTransactionFromTransactionHash(transactionHash: string) {
    try {
      if (!transactionHash)
        throw new BadRequestException('Invalid Transaction Hash');
      let meetThreshold: boolean;

      const tx = await provider.getTransaction(transactionHash);
      if (!tx) throw new NotFoundException('Transaction Not Found');

      if (tx.to && tx.to.toLowerCase() === BACKEND_WALLET_1.toLowerCase()) {
        if (tx.value && toBigInt(tx.value) !== 0n) {
          const amountInETh = formatEther(tx.value);
          meetThreshold = Number(amountInETh) >= minimumAmounts[ETH];
          return {
            success: true,
            amountInETh,
            meetThreshold,
          };
        }

        // Add usdt later
        // if (tx.data && tx.data !== '0x') {
        //   try {
        //     if(tx.to.lo)
        //   } catch (error) {}
        // }
      }

      return {
        success: false,
        // amountInETh,
        meetThreshold,
      };
    } catch (error) {
      return {
        success: false,
        // amountInETh,
        // meetThreshold,
      };
    }
  }

  async startTransactionListener(transaction: Transaction): Promise<{
    txHash: string;
    sender: string;
    amountReceived: number;
    error: any;
  }> {
    const { toCurrency, fromCurrency } = transaction;
    if (toCurrency !== fromCurrency) {
      throw new Error('From Currency must match the To Currency');
    }

    console.log(`Listening for Transactions to: ${BACKEND_WALLET_1}`);

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error('❌ Transaction not detected within timeout period'));
      }, 900000); // 15 minutes Timeout

      const cleanup = () => {
        clearTimeout(timeout);
        wssProvider.off('pending', pendingHandler);
      };

      const pendingHandler = async (txHash: string) => {
        try {
          const tx = await wssProvider.getTransaction(txHash);

          if (
            !tx ||
            !tx.to ||
            tx.to.toLowerCase() !== BACKEND_WALLET_1.toLowerCase()
          ) {
            return;
          }

          let amountReceived: number;
          if (transaction.fromCurrency.toLowerCase() === ETH.toLowerCase()) {
            amountReceived = parseFloat(formatEther(tx.value));
          } else if (
            transaction.fromCurrency.toLowerCase() === USDT.toLowerCase()
          ) {
            amountReceived = await this.decodeERC20TransferAmount(tx);
          } else {
            throw new Error(`⚠️ Unsupported currency: ${fromCurrency}`);
          }

          const minAmountRequired = minimumAmounts[fromCurrency];

          if (amountReceived >= minAmountRequired) {
            console.log('⏳ Payment detected! Waiting for confirmation...');

            try {
              const receipt = await wssProvider.waitForTransaction(txHash, 1);
              if (receipt?.status === 1) {
                console.log(
                  `✅ Payment confirmed! Process started for transaction: ${txHash}`,
                );
                cleanup();
                resolve({
                  txHash,
                  sender: tx.from,
                  amountReceived: amountReceived,
                  error: null,
                });
              } else {
                throw new Error('❌ Transaction failed or reverted');
              }
            } catch (error) {
              cleanup();
              reject(
                new Error(
                  `⚠️ Transaction confirmation failed: ${error.message}`,
                ),
              );
            }
          }
        } catch (error) {
          throw new Error(`Error fetching transaction: ${error}`);
        }
      };

      wssProvider.on('pending', pendingHandler);
    });
  }

  async decodeERC20TransferAmount(tx: any): Promise<number> {
    try {
      if (!tx.to || !tx.data) {
        throw new Error('Invalid Transaction object');
      }
      const contract = new Contract(tx.to, ABI, wssProvider);
      const decimals = await contract.decimals();

      const inputData = tx.data; // Raw Transaction Data
      if (!inputData.toLowerCase().startWith(TRANSFER_SIGNATURE)) {
        throw new Error('Not an ERC-20 transfer transaction');
      }

      const parsedTx = ERC20_Interface.parseTransaction(tx);

      if (!parsedTx) {
        throw new Error('Failed to parse transfer data');
      }

      const amount = parsedTx.args[1];
      if (!amount) {
        throw new Error('No amount found in transfer data');
      }

      return parseFloat(formatUnits(amount, decimals));
    } catch (error) {
      console.error('⚠️ Failed to decode ERC-20 transaction:', error);
      throw error;
    }
  }
}
