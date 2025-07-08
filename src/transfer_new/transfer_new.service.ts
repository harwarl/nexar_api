import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import {
  erc20Abi,
  formatEther,
  formatUnits,
  isAddress,
  parseEther,
  parseUnits,
  Transaction,
} from 'viem';
import axios from 'axios';
import { AcrossService } from './across.service';
import * as crypto from 'crypto';
import { Contract, HDNodeWallet, JsonRpcProvider, Wallet } from 'ethers';
import {
  BUFFER_GAS,
  ETH,
  minimumAmounts,
  PROVIDERS,
  STATUS,
  SUPPORTED_TOKENS,
  TOKEN_ADDRESS,
  WETH,
} from 'utils/constants';
import { CreateTransferTransactionDto } from './dto/CreateTransferTxn.dto';
import { arbitrumSepolia, base, mainnet, sepolia } from 'viem/chains';
import { Transfer } from './types/transfer.interface';
import { ConfigService } from '@nestjs/config';
import { StartTransferTransactionDto } from 'src/transfer/dto/StartTransferProcess.dto';
import { ERC20_Interface } from 'utils/ethers';
import { send } from 'process';
import { format } from 'path';

@Injectable()
export class TransferNewService {
  private apiKey = process.env.ES_API_KEY;
  private currentBlock = 1000000;
  private BACKEND_WALLET: `0x${string}`;
  private platformFee: number = 1; // this is one percent
  private IV_LENGTH: number = 12; // random bytes length
  private ENCRYPTION_KEY: string; // encryption key
  private ENCRYPTION_SALT: string; // Salt for encryption

  // Listeners available per request
  private activeListeners = new Map<string, { cleanup: () => void }>();
  constructor(
    @Inject('TRANSFER_MODEL') private transferTxnModel: Model<Transfer>,
    private readonly acrossService: AcrossService,
    private readonly configService: ConfigService,
  ) {
    this.ENCRYPTION_KEY = configService.get<string>('ENCRYPTION_KEY');
    this.ENCRYPTION_SALT = configService.get<string>('SALT');
    this.BACKEND_WALLET = configService.get<string>(
      'BACKEND_WALLET',
    ) as `0x${string}`;
  }

  // Create transaction and send transaction details to the USER
  async createTransaction(
    createTransactionPayload: CreateTransferTransactionDto,
  ) {
    const { token, amount, recipientAddress, isTestnet } =
      createTransactionPayload;

    // throw an error when there is incomplete parameters
    if (!token || !amount || !recipientAddress) {
      throw new BadRequestException('Incomplete Parameters');
    }

    // verify recipient address is EVM compatible
    if (!isAddress(recipientAddress)) {
      throw new BadRequestException('Invalid Recipient Address');
    }

    // Validate minimum amount
    if (
      !minimumAmounts[token.toLowerCase()] ||
      minimumAmounts[token.toLowerCase()] > amount
    ) {
      throw new BadRequestException(
        `Minimum amount for ${token} transfers is ${minimumAmounts[token.toLowerCase()]}`,
      );
    }

    // Dynamically determine decimals for parseUnits
    console.log({ token, ETH, WETH, isIn: token.toLowerCase() in [ETH, WETH] });
    const decimals = [ETH, WETH].includes(token.toLowerCase())
      ? 18
      : await this.getTokenDecimals();

    console.log({ decimals });
    // Format amount for quote
    const formattedAmount =
      decimals === 18
        ? parseEther(amount.toString())
        : parseUnits(amount.toString(), decimals);

    // Determine chain IDs
    const sourceChainId = isTestnet ? sepolia.id : mainnet.id;
    const destinationChainId = isTestnet ? arbitrumSepolia.id : base.id;

    console.log({ sourceChainId, destinationChainId, formattedAmount });

    // Determine supported token
    // Ensure token is a key of SUPPORTED_TOKENS
    if (!(token in SUPPORTED_TOKENS)) {
      throw new BadRequestException('Unsupported token');
    }
    const supportedToken =
      SUPPORTED_TOKENS[token as keyof typeof SUPPORTED_TOKENS];

    // Determine if fromETH
    const fromETH = token.toLowerCase() === ETH || token.toLowerCase() === WETH;

    // Get the Quote so as to add the gas
    const quote = await this.acrossService.getQuote(
      formattedAmount,
      sourceChainId,
      destinationChainId,
      supportedToken,
      recipientAddress,
      isTestnet,
      fromETH,
      fromETH,
    );

    console.log({ quote });

    // throw an error if there is no quote or there is no deposit object
    if (!quote && !quote.deposit)
      throw new BadRequestException('Could not get quote');
    // throw an error when the amount is low
    if (quote.isAmountTooLow)
      throw new BadRequestException('Amount is too low');

    // calculate the fees and add it to the amount to be sent by the user
    const { error, value: expectedSendAmount } =
      this.acrossService.calculateFee(formattedAmount, quote.fees);

    console.log({ error, expectedSendAmount });

    // throw error if there is any when calculating the adjusted fee
    if (error) {
      throw new BadRequestException(error);
    }

    // Calculate the platform
    const { fee, amountAfterFee } = this.calculateplatformFee(formattedAmount);

    console.log({ fee, amountAfterFee });

    if (!fee || !amountAfterFee)
      throw new BadRequestException('Could not calucate the fees');

    // generate two wallets for the user.
    const { walletA, walletB } = await this.generateWallets();

    // TODO: Hash the wallets involved in this transaction
    const walletAEncrypted = this.encryptObject({
      ...walletA,
      privateKey: walletA.privateKey,
    });
    const walletBEncrypted = this.encryptObject({
      ...walletB,
      privateKey: walletB.privateKey,
    });
    console.log('In here na');
    console.log(
      Number(
        formatUnits(expectedSendAmount, decimals) + parseEther(BUFFER_GAS),
      ),
    );

    console.log(
      formatUnits(expectedSendAmount, decimals),
      parseEther(BUFFER_GAS),
    );
    // TODO: Save the entire Thing to the database.
    const newTransferTxn = await this.transferTxnModel.create({
      txId: this.generateRandomTxId(),
      payinAddress: walletA.address,
      payoutAddress: walletB.address,
      expectedSendAmount: Number(
        formatUnits(expectedSendAmount, decimals) + parseEther(BUFFER_GAS),
      ),
      expectedReceiveAmount: Number(formatUnits(amountAfterFee, decimals)),
      recipientAddress: recipientAddress,
      status: STATUS.NEW,
      payinHash: '',
      payoutHash: '',
      identifier: '',
      firstBridgeHash: '',
      secondBridgeHash: '',
      internalTransferHash: '',
      transferToReceiverHash: '',
      fromCurrency: supportedToken,
      toCurrency: supportedToken,
      amountSent: 0,
      senderAddress: '',
      walletA: walletAEncrypted,
      walletB: walletBEncrypted,
      isTestnet,
    });

    let txnObj = newTransferTxn.toObject();

    // Remove sensitive data before returning
    delete txnObj.walletA;
    delete txnObj.walletB;

    // TODO: get a transaction ID
    return {
      success: true,
      transaction: txnObj,
      isTestnet,
      message:
        'Tranaction created successfully. Transfer funds to the payin address and wait for confirmation. Pooling to the Payin Wallet closes in 15 minutes after transaction has been started.',
    };
  }

  // Starting the transfer process while getting the Transaction ID
  async startTransfer(startTransferDto: StartTransferTransactionDto) {
    // Get the transaction from The ID and throw an error if not found
    const { transactionId } = startTransferDto;

    const transactionExists = await this.transferTxnModel.findOne({
      txId: transactionId,
    });

    if (
      !transactionExists ||
      !transactionExists.walletA ||
      !transactionExists.walletB
    ) {
      throw new BadRequestException('Transaction not found');
    }

    if (transactionExists.status !== STATUS.NEW) {
      throw new BadRequestException(
        'Transaction has already been started or completed',
      );
    }

    // Decrypt the Wallets involved in the Transaction
    const [walletA, walletB] = [
      await this.decryptObject(transactionExists.walletA),
      await this.decryptObject(transactionExists.walletB),
    ];

    // console.log({ walletA: walletA.privateKey });

    // Get the current block number : TODO: uncomment this later
    // this.currentBlock = transactionExists.isTestnet
    //   ? await PROVIDERS.SEPOLIA.getBlockNumber()
    //   : await PROVIDERS.MAINNET.getBlockNumber();

    try {
      // Update the transaction status to WAITING
      await this.transferTxnModel.updateOne(
        { txId: transactionId },
        { $set: { status: STATUS.WAITING } },
      );

      // Start Listener for the transaction
      const paymentResult = await this.startListener(transactionExists);

      if (paymentResult.error) {
        await this.transferTxnModel.updateOne(
          { txId: transactionId },
          {
            $set: {
              status: STATUS.FAILED,
              updateAt: new Date(),
            },
          },
        );

        throw new BadRequestException(paymentResult.error.message);
      }

      // const { txHash: fee_removal_hash, amountAfterFee } =
      //   await this.remove_fee(
      //     transactionExists.fromCurrency.toLowerCase() as SUPPORTED_TOKENS,
      //     paymentResult.amountReceived as number,
      //     walletA,
      //     transactionExists.isTestnet ? PROVIDERS.SEPOLIA : PROVIDERS.MAINNET,
      //     transactionExists.isTestnet ? 'SEPOLIA' : 'ETH',
      //   );

      // console.log('Fee Removal Hash: ', fee_removal_hash);

      // STEP 1: Calculate and Subtract the 1% fee from the amount sent
      const decimals = [ETH, WETH].includes(
        transactionExists.fromCurrency.toLowerCase(),
      )
        ? 18
        : await this.getTokenDecimals();

      // Format amount for quote
      const formattedAmount =
        decimals === 18
          ? parseEther(paymentResult.amountReceived.toString())
          : parseUnits(paymentResult.amountReceived.toString(), decimals);

      // calculate platform fee
      const { amountAfterFee, fee } =
        this.calculateplatformFee(formattedAmount);

      if (amountAfterFee < fee) {
        throw new BadRequestException('Amount after fee is less than the fee');
      }

      // Update the DB with the payment hash and the sender
      await this.transferTxnModel.updateOne(
        { txId: transactionId },
        {
          $set: {
            status: STATUS.ORDER_CREATED,
            payinHash: paymentResult.txHash,
            senderAddress: paymentResult.senderAddress,
            amountSent: formatEther(amountAfterFee),
          },
        },
      );

      //TODO: Make this ERC20 compatible
      const amountToSend = transactionExists.isTestnet
        ? await PROVIDERS.SEPOLIA.getBalance(walletA.address as `0x${string}`)
        : await PROVIDERS.MAINNET.getBalance(walletA.address as `0x${string}`);

      console.log('Amount to send: ', amountToSend);

      // STEP 2: Bridge to base And Update the Status
      const firstBridgeHash = await this.acrossService.startBridge(
        walletA,
        transactionExists.isTestnet ? sepolia : mainnet,
        transactionExists.isTestnet ? arbitrumSepolia : base,
        WETH.toUpperCase() as SUPPORTED_TOKENS,
        BigInt(amountToSend),
        walletB.address as `0x${string}`,
        true, // Bridging from ETH
        transactionExists.isTestnet, // check if is testnet
      );

      console.log('First Bridge hash: ', firstBridgeHash);

      // Get balance left in wallet A after the first bridge
      const amountLeft = transactionExists.isTestnet
        ? await PROVIDERS.SEPOLIA.getBalance(walletA.address as `0x${string}`)
        : await PROVIDERS.MAINNET.getBalance(walletA.address as `0x${string}`);

      // SEND FEE TO PLATFORM WALLET
      const { txHash: fee_removal_hash } = await this.remove_fee(
        transactionExists.fromCurrency.toLowerCase() as SUPPORTED_TOKENS,
        amountLeft,
        walletA,
        transactionExists.isTestnet ? PROVIDERS.SEPOLIA : PROVIDERS.MAINNET,
        transactionExists.isTestnet ? 'SEPOLIA' : 'ETH',
      );

      console.log('Fee Removal Hash: ', fee_removal_hash);
      // STEP 3: Transfer to wallet B And Update the Status

      // STEP 4: Bridge Back to ETH and update the status

      // STEP 5: Transfer to Receiver and update the status

      // await this.remove_fee(SUPPORTED_TOKENS.ETH, paymentResult.amountReceived);
    } catch (error) {
      console.log('Transfer Failed: ', error);

      // Do some form of revert here or update the transaction as failed
      // await this.transferTxnModel.updateOne(
      //   { txId: transactionId },
      //   {
      //     $set: {
      //       status: STATUS.FAILED,
      //       payinHash: '',
      //       payoutHash: '',
      //       firstBridgeHash: '',
      //       secondBridgeHash: '',
      //       internalTransferHash: '',
      //       transferToReceiverHash: '',
      //     },
      //   },
      // );

      throw new BadRequestException(
        error.message ||
          'Transfer failed due to an error. Please try again later.',
      );
    }
  }

  /*------------------------------ Listeners ------------------------------*/
  private async startListener(transfer: Transfer): Promise<{
    txHash: `0x${string}`;
    senderAddress: `0x${string}`;
    amountReceived: number;
    error: any;
  } | null> {
    const { txId, payinAddress, toCurrency, fromCurrency } = transfer;

    if (toCurrency !== fromCurrency) {
      throw new BadRequestException(
        'Transfer currencies do not match. Cannot start listener.',
      );
    }

    // Create a unique Key for the listener
    const listenerKey = `${txId}-${payinAddress}`;

    // Check if a listener already exists for this transaction
    if (this.activeListeners.has(listenerKey)) {
      throw new BadRequestException(
        'Listener already exists for this transaction',
      );
    }

    console.log(`👥 [TX:${listenerKey}] Starting listener for user`);

    return new Promise(async (resolve, reject) => {
      const checkInterval = 15_000; // 15 seconds

      const interval = setInterval(async () => {
        try {
          const result = await this.checkTransactions(transfer);
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

  // Check tthe transactions for the wallet involved
  private async checkTransactions(transfer: Transfer): Promise<{
    txHash: `0x${string}`;
    senderAddress: `0x${string}`;
    amountReceived: number;
    error: any;
  } | null> {
    const { txId, fromCurrency, isTestnet } = transfer;

    console.log(`[TX:${txId}] Checking transactions for ${fromCurrency}`);
    // Determine if fromETH
    const isETH =
      fromCurrency.toLowerCase() === ETH || fromCurrency.toLowerCase() === WETH;
    const walletA = await this.decryptObject(transfer.walletA);

    try {
      // Fetch both normal and token transfers in parallel
      const [normalTxs, tokenTxs] = await Promise.all([
        this.fetchTransactions(
          walletA.address as `0x${string}`,
          'txlist',
          isTestnet,
        ),
        isETH
          ? []
          : this.fetchTransactions(
              walletA.address as `0x${string}`,
              'tokentx',
              isTestnet,
            ),
      ]);
      // Combine and sort by timestamp (newest first)
      const allTxs = [...normalTxs, ...tokenTxs].sort(
        (a, b) => parseInt(b.timeStamp) - parseInt(a.timeStamp),
      );
      for (const tx of allTxs) {
        try {
          const amount = isETH
            ? parseFloat(formatEther(tx.value))
            : await this.decodeTokenAmount(tx, tx.isTestnet);

          console.log({ amount });
          console.log(fromCurrency.toLowerCase());
          // check if amount is not less than the minimum amount
          if (amount > minimumAmounts[fromCurrency.toLowerCase()]) {
            return {
              txHash: tx.hash,
              senderAddress: tx.from,
              amountReceived: amount,
              error: null,
            };
          }
        } catch (error) {
          console.warn(`[TX:${txId}] Error processing tx ${tx.hash}:`, error);
        }
      }
    } catch (error) {
      console.error(`[TX:${txId}] Etherscan error:`, error);
      throw new Error(`Transaction check failed: ${error.message}`);
    }
  }

  private async fetchTransactions(
    address: `0x${string}`,
    action: 'txlist' | 'tokentx',
    isTestnet: boolean = false,
  ) {
    const baseUrl = isTestnet
      ? this.configService.get<string>('SEPOLIA_API_URL')
      : this.configService.get<string>('ETH_API_URL');

    let url = `${baseUrl}?module=account&action=${action}${action === 'tokentx' ? `contractaddress=${address}` : ''}&address=${address}&startblock=${this.currentBlock - 20}&endblock=99999999&sort=desc&page=1&offset=10&apikey=${this.apiKey}`;

    // TODO: Handle the case where the action is 'tokentx' and we need to filter by contract address
    // if (action === 'tokentx') {
    //   url += `&contractaddress=${walletAddress}`;  ?? This can be alot of address
    // }

    console.log('[DEBUG] Final Etherscan URL:', url);

    const response = await axios.get(url, { timeout: 5000 });

    if (response.data.status !== '1') {
      return [];
    }

    return response.data.result.map((tx: any) => ({
      ...tx,
      blockNumber: parseInt(tx.blockNumber),
    }));
  }

  private async decodeTokenAmount(
    tx: any,
    isTestnet: boolean,
  ): Promise<number> {
    try {
      if (tx.tokenDecimal) {
        return parseFloat(formatUnits(tx.value, tx.tokenDecimal));
      }

      const txn = isTestnet
        ? await PROVIDERS.SEPOLIA.getTransaction(tx.hash)
        : await PROVIDERS.MAINNET.getTransaction(tx.hash);

      if (!txn || !txn.data) {
        throw new Error('Transaction data not found');
      }

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

  /*------------------------------ Private Functions ------------------------------*/
  // calculates the platform fee and returns it and the subtracted amount from the input amount
  private calculateplatformFee(inputAmount: bigint): {
    fee: bigint;
    amountAfterFee: bigint;
  } {
    const fee = (inputAmount * BigInt(this.platformFee)) / BigInt(100);
    const amountAfterFee = inputAmount - fee;
    return { fee, amountAfterFee };
  }

  // This removes and sends the platform 1% fee to the backend wallet, sends ETH or any other ERC 20 related token to the backend wallet
  private async remove_fee(
    token: SUPPORTED_TOKENS,
    amount: bigint, // wallet balance
    fromWallet: HDNodeWallet,
    provider: JsonRpcProvider,
    network: 'ETH' | 'BASE' | 'SEPOLIA' | 'BASE_SEPOLIA' = 'ETH',
  ): Promise<{ txHash: `0x${string}` }> {
    //; amountAfterFee: number }> {
    // CALCULATE 1%
    // //format the amount to the correct decimals
    // console.log({ token, ETH, WETH, isIn: token.toLowerCase() in [ETH, WETH] });
    // const decimals = [ETH, WETH].includes(token.toLowerCase())
    //   ? 18
    //   : await this.getTokenDecimals();

    // // Format amount for quote
    // const formattedAmount =
    //   decimals === 18
    //     ? parseEther(amount.toString())
    //     : parseUnits(amount.toString(), decimals);

    // const { amountAfterFee, fee } = this.calculateplatformFee(formattedAmount);

    // console.log({ message: 'Na here', token, compa: SUPPORTED_TOKENS.ETH });

    // Get the gas fee needed for the transaction
    const { estimatedGas, gasPrice } = await this.getGasFee(
      amount,
      this.BACKEND_WALLET,
      provider,
      fromWallet,
      token.toUpperCase() !== SUPPORTED_TOKENS.ETH
        ? (TOKEN_ADDRESS[token.toUpperCase()][network] as `0x{string}`)
        : undefined,
    );

    const gasFee: bigint = estimatedGas * gasPrice;

    if (amount < gasFee) {
      throw new BadRequestException(
        'Amount is less than the gas fee required for the transaction',
      );
    }

    // For ETH, tokenAddress remains undefined
    const txHash = await this.transfer(
      amount, // The fee
      this.BACKEND_WALLET,
      fromWallet,
      provider,
      estimatedGas,
      gasPrice,
      token.toUpperCase() !== SUPPORTED_TOKENS.ETH
        ? (TOKEN_ADDRESS[token.toUpperCase()][network] as `0x{string}`)
        : undefined,
    );

    return {
      txHash: txHash as `0x${string}`,
      // amountAfterFee: Number(formatUnits(amountAfterFee, decimals)),
    };
  }

  // Get token decimals
  private async getTokenDecimals(
    tokenAddress?: `0x${string}`,
    provider?: JsonRpcProvider,
  ): Promise<number> {
    let decimals: number = 6;
    if (tokenAddress && provider) {
      const erc20Contract = new Contract(tokenAddress, erc20Abi, provider);
      decimals = await erc20Contract.decimals();
    }
    return decimals;
  }

  // The universal Transfer function for both ETH AND WETH AND other ERC20 tokens
  private async transfer(
    amount: bigint,
    recipientAddress: `0x${string}`,
    wallet: HDNodeWallet,
    provider: JsonRpcProvider,
    estimatedGas: bigint,
    gasPrice: bigint,
    tokenAddress?: `0x${string}`,
  ): Promise<`0x${string}`> {
    // Validate recipient address
    if (!isAddress(recipientAddress)) {
      throw new BadRequestException('Invalid recipient address');
    }

    // get wallet signer
    const signer = new Wallet(wallet.privateKey, provider);

    if (!tokenAddress) {
      // Transfer Native ETH
      const tx = await signer.sendTransaction({
        to: recipientAddress,
        value: amount,
        gasLimit: estimatedGas,
        gasPrice: gasPrice,
      });
      await tx.wait();
      return tx.hash as `0x{string}`;
    } else {
      // Use ERC20 to estimate gas
      const erc20Contract = new Contract(tokenAddress, erc20Abi, signer);

      // ERC 20 transfer (WETH) or any ERC20
      const tx = await erc20Contract.transfer(recipientAddress, amount, {
        gasLimit: estimatedGas,
        gasPrice: gasPrice,
      });
      await tx.wait();
      return tx.hash as `0x{string}`;
    }
  }

  // Get the gas fee needed for the transaction
  private async getGasFee(
    amount: bigint,
    recipientAddress: `0x${string}`,
    provider: JsonRpcProvider,
    wallet: HDNodeWallet,
    tokenAddress?: `0x${string}`,
  ) {
    let estimatedGas: bigint;
    let gasPrice: bigint = (await provider.getFeeData()).gasPrice;
    let signer = new Wallet(wallet.privateKey, provider);

    // for natives
    if (!tokenAddress) {
      estimatedGas = await signer.estimateGas({
        to: recipientAddress,
        value: !tokenAddress ? amount : 0n, // only set value if not transferring a token
        data: tokenAddress ? '0x' : undefined,
      });
    } else {
      // for ERC20 tokens, using ERC20 to estimate gas
      const erc20Contract = new Contract(tokenAddress, erc20Abi, signer);
      estimatedGas = await erc20Contract.transfer.estimateGas(
        recipientAddress,
        amount,
      );
    }

    return { estimatedGas, gasPrice }; // in wei
  }

  // Generate Wallets Need for the private transactions
  private async generateWallets(): Promise<{
    walletA: HDNodeWallet;
    walletB: HDNodeWallet;
  }> {
    return {
      walletA: Wallet.createRandom(),
      walletB: Wallet.createRandom(),
    };
  }

  private generateRandomTxId() {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let txId = '';

    for (let i = 0; i < 14; i++) {
      txId += chars[Math.floor(Math.random() * chars.length)];
    }

    return txId;
  }

  private encryptObject(obj: any): string {
    const key = this.getKey(); // already a Buffer
    const iv = crypto.randomBytes(this.IV_LENGTH);

    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    const json = JSON.stringify(obj);
    let encrypted = cipher.update(json, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag();

    return [iv.toString('hex'), authTag.toString('hex'), encrypted].join(':');
  }

  private decryptObject(encrypted: string): any {
    const [ivHex, authTagHex, encryptedData] = encrypted.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const key = this.getKey();

    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedData, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  }

  private getKey() {
    return crypto.pbkdf2Sync(
      this.ENCRYPTION_KEY,
      this.ENCRYPTION_SALT,
      100_000,
      32,
      'sha256',
    );
  }
}
