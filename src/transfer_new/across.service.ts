import {
  AcrossClient,
  createAcrossClient,
  GetQuoteParams,
  Quote,
} from '@across-protocol/app-sdk';
import { Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HDNodeWallet } from 'ethers';
import { Model } from 'mongoose';
import { SUPPORTED_TOKENS, TOKEN_ADDRESS } from 'utils/constants';
import {
  Account,
  Chain,
  http,
  parseEther,
  Transport,
  WalletClient,
} from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { base, mainnet, arbitrumSepolia, baseSepolia } from 'viem/chains';
import { createWalletClient } from 'viem';

@Injectable()
export class AcrossService {
  private acrossClient: AcrossClient;
  constructor(
    // @Inject('TRANSACTION_MODEL') private transactionModel: Model<Transaction>,
    private readonly configService: ConfigService,
  ) {
    this.acrossClient = this.createAcrossClient();
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
    fromETH: boolean = true,
    isTestnet: boolean = false,
  ) {
    const quote = await this.getQuote(
      amount,
      sourceChain.id,
      destinationChain.id,
      token,
      fromETH,
      token === SUPPORTED_TOKENS.WETH ? true : false,
    );

    if (!quote) return;

    // Create the Wallet Client
    // const isFromEth = sourceChain === arbitrumSepolia || mainnet ? true : false;
    const walletClient = this.createUserWalletClient(
      wallet.privateKey as `0x${string}`,
      sourceChain,
      fromETH,
      isTestnet,
    );
    // Execute Bridge
    const res = await this.executeQuote(
      this.acrossClient,
      walletClient,
      quote.deposit,
    );

    return res;
  }

  // Execute the Quote
  async executeQuote(
    acrossClient: AcrossClient,
    walletClient: WalletClient<Transport, Chain, Account>,
    quoteDeposit: Quote['deposit'],
  ) {
    let result: { success: boolean; txHash?: string; error?: any } = {
      success: false,
    };
    return await acrossClient.executeQuote({
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
          const { txReceipt, actionSuccess } = progress;
          if (actionSuccess) {
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
    fromETH = true, // Means sending chain is ETH
    isNative = true, // If sending WETH
  ) {
    console.log({ fromETH });
    const inputToken = TOKEN_ADDRESS[token][
      fromETH ? 'ETH' : 'BASE'
    ] as `0x${string}`;
    const outputToken = TOKEN_ADDRESS[token][
      fromETH ? 'BASE' : 'ETH'
    ] as `0x${string}`;

    console.log({ inputToken, outputToken });

    const route: GetQuoteParams['route'] = {
      originChainId: sourceChainId,
      destinationChainId,
      inputToken,
      outputToken,
      isNative,
    };

    return await this.acrossClient.getQuote({ route, inputAmount });
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
  private useTestnet() {
    this.acrossClient = this.createAcrossClient(true);
  }

  private createUserWalletClient(
    privateKey: `0x${string}`,
    chain: Chain,
    fromETH: boolean = true,
    isTestnet: boolean = false,
  ) {
    let rpcUrl: string;
    if (isTestnet) {
      rpcUrl = fromETH
        ? this.configService.get<string>('ARBITRUM_SEPOLIA_RPC_URL')
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
  private createAcrossClient(isTestnet: boolean = false): AcrossClient {
    return createAcrossClient({
      integratorId: '0xdead',
      chains: [arbitrumSepolia, baseSepolia, mainnet, base],
      useTestnet: isTestnet,
    });
  }
}
