import {
  AcrossClient,
  createAcrossClient,
  GetQuoteParams,
} from '@across-protocol/app-sdk';
import { Inject, Injectable } from '@nestjs/common';
import { HDNodeWallet, Transaction, Wallet } from 'ethers';
import { boolean } from 'joi';
import { Model } from 'mongoose';
import { SUPPORTED_TOKENS, TOKEN_ADDRESS } from 'utils/constants';
import { base, mainnet, arbitrumSepolia, baseSepolia } from 'viem/chains';

@Injectable()
export class AcrossService {
  private acrossClient: AcrossClient;
  constructor(
    @Inject('TRANSACTION_MODEL') private transactionModel: Model<Transaction>,
  ) {
    this.acrossClient = this.createAcrossClient();
  }

  /*------------------------------ Private functions ------------------------------*/

  // Get the Across Bridge Quote
  private async getQuote(
    acrossClient: AcrossClient,
    inputAmount: bigint,
    sourceChainId: number,
    destinationChainId: number,
    token: SUPPORTED_TOKENS, // could be WETH or USDC or any other supported
    fromETH: boolean = true,
    isNative: boolean = true,
  ) {
    const route: GetQuoteParams['route'] = {
      originChainId: sourceChainId,
      destinationChainId: destinationChainId,
      inputToken: TOKEN_ADDRESS[token][
        fromETH ? 'ETH' : 'BASE'
      ] as `0x${string}`,
      outputToken: TOKEN_ADDRESS[token][
        fromETH ? 'BASE' : 'ETH'
      ] as `0x${string}`,
      isNative,
    };

    return await acrossClient.getQuote({ route, inputAmount });
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

  // convert the acrossclient to use testnets
  private useTestnet() {
    this.acrossClient = this.createAcrossClient(true);
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
