import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
  BadGatewayException,
} from '@nestjs/common';
import { Model } from 'mongoose';
import { Transaction } from 'src/swap/types/transaction.interface';
import { CreateTransferTransactionDto } from './dto/CreateTransferTransaction.dto';
import axios from 'axios';
import {
  Contract,
  formatEther,
  formatUnits,
  JsonRpcProvider,
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
  USDT_FEES,
} from 'utils/constants';
import { VerifyTransactionHashDto } from './dto/VerifyTransactionHash.dto';
import { ABI, ERC20_Interface, provider } from 'utils/ethers';
import { StartTransferTransactionDto } from './dto/StartTransferProcess.dto';
import { WormholeService } from './wormhole.service';

@Injectable()
export class TransferService {
  private apiKey = process.env.ES_API_KEY;
  private currentBlock = 1000000;

  // private activeListeners = new Map<string, NodeJS.Timeout>();
  private activeListeners = new Map<string, { cleanup: () => void }>();
  constructor(
    private readonly wormholeService: WormholeService,
    @Inject('TRANSACTION_MODEL') private transactionModel: Model<Transaction>,
  ) {
    this.initializeBlockTracker();
  }

  private async initializeBlockTracker() {
    this.currentBlock = await provider.getBlockNumber();
    console.log({ current: this.currentBlock });
    setInterval(async () => {
      this.currentBlock = await provider.getBlockNumber();
    }, 15000);
  }

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

    const GAS =
      from.toLowerCase() === ETH.toLowerCase() ? ETH_GAS_FEES : USDT_FEES;

    const expectedReceiveAmount = Number(amount * (1 - FEE_PERCENTAGE)) - GAS;

    let newTransaction = await this.transactionModel.create({
      txId: this.generateRandomTxId(),
      isTransfer: true,
      payinAddress: BACKEND_WALLET_1,
      payoutAddress: BACKEND_WALLET_2,
      expectedSendAmount: amount,
      expectedReceiveAmount,
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

    // await this.transactionModel.updateOne(
    //   {
    //     txId: transactionId,
    //   },
    //   {
    //     $set: {
    //       status: STATUS.ORDER_CREATED,
    //       payinHash: transactionHash,
    //       amountSend: validTransaction.amountInETh,
    //     },
    //   },
    // );

    return { success: true, message: 'Hash verified' };
  }

  async startTransferProcess(startTransferDto: StartTransferTransactionDto) {
    this.currentBlock = await provider.getBlockNumber();
    const { transactionId } = startTransferDto;

    const session = await this.transactionModel.startSession();

    session.startTransaction();

    try {
      // 1. Validate Transaction
      const transactionExists = await this.transactionModel
        .findOne({
          txId: transactionId,
        })
        .session(session);

      if (!transactionExists) {
        throw new BadRequestException('Invalid Transaction Id');
      }

      if (transactionExists.status === 'finished') {
        await session.commitTransaction();
        return {
          success: true,
          message: 'Transaction completed',
        };
      }

      const { fromCurrency, toCurrency } = transactionExists;

      if (fromCurrency !== toCurrency) {
        throw new BadRequestException('Invalid Transfer Transaction');
      }

      // 2. Listen for payment
      const paymentResult =
        await this.startTransactionListener(transactionExists);

      const {
        txHash,
        sender,
        amountReceived: amountSend,
        error: paymentResultError,
      } = paymentResult;

      if (paymentResultError) {
        await this.transactionModel.updateOne(
          {
            txId: transactionExists.txId,
          },
          {
            status: STATUS.FAILED,
            reason: REASON.NO_AMOUNT,
            updatedAt: new Date(),
          },
          {
            session,
          },
        );

        throw new Error(paymentResultError);
      }

      // 3. Update Initial Payment Status
      await this.transactionModel.updateOne(
        {
          txId: transactionExists.txId,
        },
        {
          status: STATUS.ORDER_CREATED,
          payinHash: txHash,
          sender,
          amountSend,
          updatedAt: new Date(),
          depositReceivedAt: new Date(),
        },
        {
          session,
        },
      );

      // 4. Calculate Amounts with Fee Protection
      const GAS =
        fromCurrency.toLowerCase() === ETH.toLowerCase()
          ? ETH_GAS_FEES
          : USDT_FEES;

      const amountToReceive = Number(amountSend * (1 - FEE_PERCENTAGE)) - GAS;

      const amountToBridge = (amountToReceive + Number(GAS * 0.6)).toString();

      // 5. Execute Bridge Operations
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
            updatedAt: new Date(),
          },
        },
        {
          session,
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
            updatedAt: new Date(),
          },
        },
        {
          session,
        },
      );

      // 6. Final Transfer to Receiver
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
            updatedAt: new Date(),
          },
        },
        { session },
      );

      await session.commitTransaction();
      return { success: true, message: 'Transaction Completed successfully' };
    } catch (error) {
      await session.abortTransaction();
      console.error('Transfer process failed:', error);
      await this.transactionModel.updateOne(
        {
          txId: transactionId,
        },
        {
          status: STATUS.FAILED,
          reason: error.message?.substring(0, 200) || 'Unknown error',
          updatedAt: new Date(),
        },
      );
      throw new BadRequestException(
        error.message || 'Transaction failed, please try again.',
      );
    } finally {
      session.endSession();
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
      if (ticker.toLowerCase() == ETH.toLowerCase()) {
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
    const { txId, toCurrency, fromCurrency, tokensDestination } = transaction;
    if (toCurrency !== fromCurrency) {
      throw new Error('From Currency must match the To Currency');
    }

    // Create unique key using txId, currency, and destination
    const listenerKey = `${txId}-${fromCurrency.toLowerCase()}-${tokensDestination.toLowerCase()}`;

    if (this.activeListeners.has(listenerKey)) {
      throw new BadRequestException(
        `Listener already exists for transaction ${txId}`,
      );
    }

    console.log(`👥 [TX:${txId}] Starting listener for user`);

    return new Promise(async (resolve, reject) => {
      const checkInterval = 15_000; // 15 seconds

      const interval = setInterval(async () => {
        try {
          const result = await this.checkTransactions(transaction);
          if (result) {
            cleanup();
            resolve(result);
          }
        } catch (error) {
          cleanup();
          reject(error);
        }
      }, checkInterval);

      const timeout = setTimeout(() => {
        cleanup();
        reject(new Error(`[TX:${txId}] Timeout after 10 minutes`));
      }, 600000);

      const cleanup = () => {
        clearInterval(interval);
        clearTimeout(timeout);
        this.activeListeners.delete(listenerKey);
      };

      this.activeListeners.set(listenerKey, { cleanup });
    });
  }

  private async checkTransactions(transaction: Transaction): Promise<{
    txHash: string;
    sender: string;
    amountReceived: number;
    error: any;
  } | null> {
    const { txId, fromCurrency, tokensDestination, expectedSendAmount } =
      transaction;
    const isETH = fromCurrency.toLowerCase() === 'eth';
    const address = BACKEND_WALLET_1;

    try {
      // Fetch both normal and token transfers in parallel
      const [normalTxs, tokenTxs] = await Promise.all([
        this.fetchTransactions(address, 'txlist'),
        isETH ? [] : this.fetchTransactions(address, 'tokentx'),
      ]);

      console.log({ normalTxs, tokenTxs });

      // Combine and sort by timestamp (newest first)
      const allTxs = [...normalTxs, ...tokenTxs].sort(
        (a, b) => parseInt(b.timeStamp) - parseInt(a.timeStamp),
      );

      for (const tx of allTxs) {
        try {
          const amount = isETH
            ? parseFloat(formatEther(tx.value))
            : await this.decodeTokenAmount(tx);

          if (
            Math.abs(amount - expectedSendAmount) <=
            expectedSendAmount * 0.01
          ) {
            return {
              txHash: tx.hash,
              sender: tx.from,
              amountReceived: amount,
              error: null,
            };
          }
        } catch (error) {
          console.warn(`[TX:${txId}] Error processing tx ${tx.hash}:`, error);
        }
      }
      return null;
    } catch (error) {
      console.error(`[TX:${txId}] Etherscan error:`, error);
      throw new Error(`Transaction check failed: ${error.message}`);
    }
  }

  private async fetchTransactions(
    address: string,
    action: 'txlist' | 'tokentx',
  ) {
    const baseUrl = process.env.ETH_API_URL;
    console.log({ action });

    let url = `${baseUrl}?module=account&action=${action}${action === 'tokentx' ? `contractaddress=${BACKEND_WALLET_1}` : ''}&address=${address}&startblock=${this.currentBlock - 20}&endblock=99999999&sort=desc&page=1&offset=10&apikey=${this.apiKey}`;

    if (action === 'tokentx') {
      url += `&contractaddress=${ETH_USDT.toLowerCase()}`;
    }

    console.log('[DEBUG] Final Etherscan URL:', url);

    const response = await axios.get(url, { timeout: 5000 });

    if (response.data.status !== '1') {
      // throw new Error(response.data.message || 'Etherscan API error');
      // // continue;
      return [];
    }

    return response.data.result.map((tx: any) => ({
      ...tx,
      blockNumber: parseInt(tx.blockNumber),
    }));
  }

  // async startTransactionListener(transaction: Transaction): Promise<{
  //   txHash: string;
  //   sender: string;
  //   amountReceived: number;
  //   error: any;
  // }> {
  //   const { toCurrency, fromCurrency } = transaction;
  //   if (toCurrency !== fromCurrency) {
  //     throw new Error('From Currency must match the To Currency');
  //   }

  //   console.log(`Listening for Transactions to: ${BACKEND_WALLET_1}`);

  //   return new Promise((resolve, reject) => {
  //     const timeout = setTimeout(() => {
  //       cleanup();
  //       reject(new Error('❌ Transaction not detected within timeout period'));
  //     }, 600000); // 10 minutes Timeout

  //     const cleanup = () => {
  //       clearTimeout(timeout);
  //       wssProvider.off('pending', pendingHandler);
  //     };

  //     const pendingHandler = async (txHash: string) => {
  //       try {
  //         const tx = await wssProvider.getTransaction(txHash);

  //         if (
  //           !tx ||
  //           !tx.to ||
  //           tx.to.toLowerCase() !== BACKEND_WALLET_1.toLowerCase()
  //         ) {
  //           return;
  //         }

  //         let amountReceived: number;
  //         if (transaction.fromCurrency.toLowerCase() === ETH.toLowerCase()) {
  //           amountReceived = parseFloat(formatEther(tx.value));
  //         } else if (
  //           transaction.fromCurrency.toLowerCase() === USDT.toLowerCase()
  //         ) {
  //           amountReceived = await this.decodeERC20TransferAmount(tx);
  //         } else {
  //           throw new Error(`⚠️ Unsupported currency: ${fromCurrency}`);
  //         }

  //         const minAmountRequired = minimumAmounts[fromCurrency.toLowerCase()];

  //         // console.log({ minAmountRequired, amountReceived });
  //         if (amountReceived >= minAmountRequired) {
  //           console.log('⏳ Payment detected! Waiting for confirmation...');

  //           try {
  //             const receipt = await wssProvider.waitForTransaction(txHash, 1);
  //             if (receipt?.status === 1) {
  //               console.log(
  //                 `✅ Payment confirmed! Process started for transaction: ${txHash}`,
  //               );
  //               cleanup();
  //               resolve({
  //                 txHash,
  //                 sender: tx.from,
  //                 amountReceived: amountReceived,
  //                 error: null,
  //               });
  //             } else {
  //               throw new BadRequestException(
  //                 '❌ Transaction failed or reverted',
  //               );
  //             }
  //           } catch (error) {
  //             cleanup();
  //             reject(
  //               new Error(
  //                 `⚠️ Transaction confirmation failed: ${error.message}`,
  //               ),
  //             );
  //           }
  //         }
  //       } catch (error) {
  //         throw new BadGatewayException(`Error fetching transaction: ${error}`);
  //       }
  //     };

  //     wssProvider.on('pending', pendingHandler);
  //   });
  // }

  async decodeTokenAmount(tx: any): Promise<number> {
    try {
      if (tx.tokenDecimal) {
        return parseFloat(formatUnits(tx.value, tx.tokenDecimal));
      }

      const txn = await provider.getTransaction(tx.hash);
      const parsedTx = ERC20_Interface.parseTransaction({
        value: txn.value,
        data: txn.data,
      });

      if (!parsedTx) {
        throw new Error('Failed to parse transfer data');
      }

      if (!parsedTx || parsedTx.name !== 'transfer') return 0;
      return parseFloat(formatEther(parsedTx.args[1]));
    } catch (error) {
      console.error('⚠️ Failed to decode ERC-20 transaction:', error);
      throw error;
    }
  }

  cancelListener(txId: string, currency: string, destination: string) {
    const key = `${txId}-${currency.toLowerCase()}-${destination.toLowerCase()}`;
    const listener = this.activeListeners.get(key);
    if (listener) {
      listener.cleanup();
      return true;
    }
    return false;
  }
}
