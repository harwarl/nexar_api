import {
  AcrossClient,
  createAcrossClient,
  GetQuoteParams,
  Quote,
} from '@across-protocol/app-sdk';
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HDNodeWallet, JsonRpcProvider } from 'ethers';
import { Model } from 'mongoose';
import {
  BUFFER_GAS,
  PROVIDERS,
  SUPPORTED_CHAINS,
  SUPPORTED_TOKENS,
  TOKEN_ADDRESS,
} from 'utils/constants';
import {
  Account,
  Chain,
  http,
  parseEther,
  Transport,
  WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import {
  base,
  mainnet,
  arbitrumSepolia,
  baseSepolia,
  sepolia,
} from 'viem/chains';
import { createWalletClient } from 'viem';
import { tokenBridgeNamedPayloads } from '@wormhole-foundation/sdk-connect';

@Injectable()
export class AcrossService {
  private acrossClient: AcrossClient;
  constructor(
    // @Inject('TRANSACTION_MODEL') private transactionModel: Model<Transaction>,
    private readonly configService: ConfigService,
  ) {
    this.acrossClient = this.createAcrossClient(); // Starting with testnet
  }

  // Start Bridge Process, this accepts the amount to be bridged and the chains involved
  // This simply calls the quote and the execute. functions again.
  // The execute function is the actual bridge in here
  async startBridge(
    wallet: HDNodeWallet,
    sourceChain: Chain,
    destinationChain: Chain,
    token: SUPPORTED_TOKENS,
    amount: bigint,
    receivingWalletAddress: `0x${string}`,
    fromETH: boolean = true,
    isTestnet: boolean = false,
  ) {
    const quote = await this.getQuote(
      amount,
      sourceChain.id,
      destinationChain.id,
      token,
      receivingWalletAddress,
      isTestnet,
      fromETH,
      token === SUPPORTED_TOKENS.WETH ? true : false,
    );

    console.log('Quote:', quote);

    if (!quote) return;

    // Create the Wallet Client
    const walletClient = this.createUserWalletClient(
      wallet.privateKey as `0x${string}`,
      sourceChain,
      fromETH,
      isTestnet,
    );

    // Get Provider
    let provider: JsonRpcProvider;

    if (isTestnet) {
      provider = fromETH ? PROVIDERS.SEPOLIA : PROVIDERS.ARB_TESTNET;
    } else {
      provider = fromETH ? PROVIDERS.MAINNET : PROVIDERS.BASE; // Base Mainnet
    }

    if (!provider) {
      throw new BadRequestException('No provider found');
    }

    // Estimate the Gas Fees
    const gasEstimate = await provider.estimateGas({
      from: walletClient.account?.address,
      to: quote.deposit.spokePoolAddress,
      // data,
      value: quote.deposit.isNative ? quote.deposit.inputAmount : 0n,
    });

    const gasPrice = (await provider.getFeeData()).gasPrice || 0n;

    // Calculate the gas cost
    const gasCost = gasEstimate * gasPrice;

    // Clean up buffer gas
    const bufferWei = parseEther((Number(BUFFER_GAS) / 2).toString());

    // Generate a new quote with the adjusted input amount
    const new_quote = await this.getQuote(
      amount - gasCost - bufferWei,
      sourceChain.id,
      destinationChain.id,
      token,
      receivingWalletAddress,
      isTestnet,
      fromETH,
      token === SUPPORTED_TOKENS.WETH ? true : false,
    );

    // Execute Bridge
    return await this.executeQuote(
      this.acrossClient,
      walletClient,
      new_quote.deposit,
    );
  }

  // Execute the Quote
  async executeQuote(
    acrossClient: AcrossClient,
    walletClient: WalletClient<Transport, Chain, Account>,
    quoteDeposit: Quote['deposit'],
  ) {
    let result: {
      success: boolean;
      txHash?: string;
      error?: any;
    } = {
      success: false,
    };
    const res = await acrossClient.executeQuote({
      walletClient,
      deposit: quoteDeposit,
      onProgress: async (progress) => {
        if (progress.step === 'approve' && progress.status === 'txSuccess') {
          console.log(
            'Token approval successful:',
            progress.txReceipt?.transactionHash,
          );
        }
        if (progress.step === 'deposit' && progress.status === 'txSuccess') {
          console.log(
            'Deposit successful:',
            progress.txReceipt?.transactionHash,
          );
        }
        if (progress.step === 'fill' && progress.status === 'txSuccess') {
          const { txReceipt } = progress;
          if (txReceipt.transactionHash) {
            console.log(
              'Cross chain txs were successful:',
              txReceipt?.transactionHash,
            );
            result = { success: true, txHash: txReceipt?.transactionHash };
          } else {
            console.log(
              'Cross chain txs were not successful:',
              txReceipt?.transactionHash,
            );
            result = { success: false, txHash: txReceipt?.transactionHash };
          }
        }
        if (progress.status === 'simulationError') {
          console.error('Simulation error:', progress);
          result = { success: false, error: progress };
        }
        if (progress.status === 'error' || progress.status === 'txError') {
          console.error('Transaction error:', progress);
          result = { success: false, error: progress };
        }
      },
    });

    return result;
  }

  // Get the Across Bridge Quote
  async getQuote(
    inputAmount: bigint, // parsed Input
    sourceChainId: number,
    destinationChainId: number,
    token: SUPPORTED_TOKENS, // WETH or any supported tokens
    receivingWalletAddress?: `0x${string}`, // Receiving wallet address
    isTestnet: boolean = false, // Check for testnet
    fromETH: boolean = true, // Means sending chain is ETH
    isNative: boolean = true, // If sending WETH
  ) {
    console.log({ isTestnet });
    token = token.toUpperCase() as SUPPORTED_TOKENS;
    console.log({ fromETH, token });
    let inputToken: `0x${string}`;
    let outputToken: `0x${string}`;

    console.log({ isTestnet });

    if (isTestnet) {
      // ensure the across client is testnet based
      inputToken = TOKEN_ADDRESS[token][
        fromETH ? 'SEPOLIA' : 'BASE_SEPOLIA'
      ] as `0x${string}`;
      outputToken = TOKEN_ADDRESS[token][
        fromETH ? 'BASE_SEPOLIA' : 'SEPOLIA'
      ] as `0x${string}`;
    } else {
      inputToken = TOKEN_ADDRESS[token][
        fromETH ? 'ETH' : 'BASE'
      ] as `0x${string}`;
      outputToken = TOKEN_ADDRESS[token][
        fromETH ? 'BASE' : 'ETH'
      ] as `0x${string}`;
    }

    console.log({ inputToken, outputToken });
    if (inputToken.length == 0 || outputToken.length == 0)
      throw new BadRequestException('Token not supported');

    console.log({
      originChainId: sourceChainId,
      destinationChainId,
      inputToken,
      outputToken,
      isNative,
    });

    const route: GetQuoteParams['route'] = {
      originChainId: sourceChainId,
      destinationChainId,
      inputToken,
      outputToken,
      isNative,
    };

    console.log({ route, inputAmount, receivingWalletAddress });

    try {
      return await this.acrossClient.getQuote({
        route,
        inputAmount,
        recipient: receivingWalletAddress,
      });
    } catch (error) {
      throw new BadRequestException(error.message);
    }
  }

  // Adjust the input amount to include the fee
  calculateFee(
    inputAmount: bigint,
    fees: Quote['fees'],
  ): {
    error?: string | null;
    value: bigint | null;
  } {
    let b: bigint = fees.totalRelayFee.pct; // Get the percentage relayer fee

    const SCALING_FACTOR = BigInt(1e18);

    if (b > SCALING_FACTOR) {
      return {
        error: 'Relayer must not exceed 1e18 (100%)',
        value: null,
      };
    }

    const adjustedInputAmount =
      (inputAmount * SCALING_FACTOR) / (SCALING_FACTOR - b);

    return {
      error: null,
      value: adjustedInputAmount,
    };
  }

  /*------------------------------ Private functions ------------------------------*/

  // convert the acrossclient to use testnets
  // private useTestnet(useTestnet: boolean) {
  //   this.acrossClient = this.createAcrossClient(useTestnet);
  // }

  private createUserWalletClient(
    privateKey: `0x${string}`,
    chain: Chain,
    fromETH: boolean = true,
    isTestnet: boolean = false,
  ) {
    let rpcUrl: string;
    if (isTestnet) {
      rpcUrl = fromETH
        ? this.configService.get<string>('SEPOLIA_RPC_URL')
        : this.configService.get<string>('BASE_TEST_RPC_URL');
    } else {
      rpcUrl = fromETH
        ? this.configService.get<string>('MAINNET_RPC_URL')
        : this.configService.get<string>('BASE_RPC_URL');
    }

    if (!rpcUrl) return;

    // Get the account via viem
    const account = privateKeyToAccount(privateKey);

    // throw error if there is no account
    if (!account) throw new Error('No account');

    // Return the wallet client
    return createWalletClient({
      account,
      transport: http(rpcUrl),
      chain,
    });
  }

  // create across client
  // set the use of testnet to false
  private createAcrossClient(isTestnet: boolean = true): AcrossClient {
    return createAcrossClient({
      integratorId: '0xdead',
      chains: SUPPORTED_CHAINS,
      useTestnet: isTestnet,
    });
  }
}
