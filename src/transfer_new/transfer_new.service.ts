import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { Model } from 'mongoose';
import {
  erc20Abi,
  formatUnits,
  isAddress,
  parseEther,
  parseUnits,
  Transaction,
} from 'viem';
import { AcrossService } from './across.service';
import { Contract, HDNodeWallet, JsonRpcProvider, Wallet } from 'ethers';
import {
  ETH,
  minimumAmounts,
  SUPPORTED_TOKENS,
  TOKEN_ADDRESS,
  WETH,
} from 'utils/constants';
import { CreateTransferTransactionDto } from './dto/CreateTransferTxn.dto';
import { arbitrumSepolia, base, baseSepolia, mainnet } from 'viem/chains';

@Injectable()
export class TransferNewService {
  //   private apiKey = process.env.ES_API_KEY;
  //   private currentBlock = 1000000;
  private BACKEND_WALLET: `0x${string}`;
  private platformFee: number = 1; // this is one percent

  // Listeners available per request
  private activeListeners = new Map<string, { cleanup: () => void }>();
  constructor(
    @Inject('TRANSFER_MODEL') private transferTxnModel: Model<Transaction>, // TODO: Adjust that to match the new transaction
    private readonly acrossService: AcrossService,
  ) {}

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
    const decimals = [ETH, WETH].includes(token.toLowerCase()) ? 18 : 6;

    console.log({ decimals });
    // Format amount for quote
    const formattedAmount =
      decimals === 18
        ? parseEther(amount.toString())
        : parseUnits(amount.toString(), decimals);

    // Determine chain IDs
    const sourceChainId = isTestnet ? arbitrumSepolia.id : mainnet.id;
    const destinationChainId = isTestnet ? baseSepolia.id : base.id;

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
    console.log({ walletA, walletB });

    // TODO: Save the entire Thing to the database.

    // TODO: Hash the wallets involved in this transaction

    // TODO: get a transaction ID
    return {
      success: true,
      expectedSendAmount: formatUnits(expectedSendAmount, decimals),
      expectedRecieveAmount: formatUnits(amountAfterFee, decimals),
      payinAddress: walletA.address,
      payoutAddress: walletB.address,
    };
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
    amount: number,
    fromWallet: HDNodeWallet,
    provider: JsonRpcProvider,
    network: 'ETH' | 'BASE' = 'ETH',
  ) {
    // CALCULATE 1%
    // TODO: use the calculate fee function to get teh fee involved in here
    const feeAmount = BigInt(Math.floor(amount * 0.01 * 1e18));

    let tokenAddress: `0x${string}` | undefined = undefined;

    // If not ETH, get the token address for the network
    if (token !== SUPPORTED_TOKENS.WETH && token !== SUPPORTED_TOKENS.USDC) {
      throw new Error('Unsupported token for fee removal');
    }
    if (token !== SUPPORTED_TOKENS.WETH && token !== SUPPORTED_TOKENS.USDC) {
      throw new Error('Unsupported token for fee removal');
    }
    if (token === SUPPORTED_TOKENS.WETH || token === SUPPORTED_TOKENS.USDC) {
      tokenAddress = TOKEN_ADDRESS[token][network] as `0x${string}`;
    }

    // For ETH, tokenAddress remains undefined
    return await this.transfer(
      feeAmount,
      this.BACKEND_WALLET,
      fromWallet,
      provider,
      token === SUPPORTED_TOKENS.WETH || token === SUPPORTED_TOKENS.USDC
        ? tokenAddress
        : undefined,
    );
  }
  // The universal Transfer function for both ETH AND WETH AND other ERC20 tokens
  private async transfer(
    amount: bigint,
    recipientAddress: `0x${string}`,
    wallet: HDNodeWallet,
    provider: JsonRpcProvider,
    tokenAddress?: `0x${string}`,
  ): Promise<`0x{string}`> {
    const signer = wallet.connect(provider);
    if (!tokenAddress) {
      // Transfer Native ETH
      const tx = await signer.sendTransaction({
        to: recipientAddress,
        value: amount,
      });
      await tx.wait();
      return tx.hash as `0x{string}`;
    } else {
      // ERC 20 transfer (WETH) or any ERC20
      const erc20Contract = new Contract(tokenAddress, erc20Abi, signer);
      const tx = await erc20Contract.transfer(recipientAddress, amount);
      await tx.wait();
      return tx.hash as `0x{string}`;
    }
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
}
