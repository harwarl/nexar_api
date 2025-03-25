import { Injectable, Inject } from '@nestjs/common';
import type { Chain, Network, TokenId } from '@wormhole-foundation/sdk';
import { Model } from 'mongoose';
import evm from '@wormhole-foundation/sdk/evm';
import {
  getSigner,
  getTokenDecimals,
  PRIVATE_KEYS,
  SignerStuff,
  WALLETID,
} from '../helpers/helpers';
import {
  wormhole,
  TokenTransfer,
  amount,
  Wormhole,
  // isNative,
} from '@wormhole-foundation/sdk';
import { Transaction } from 'src/swap/types/transaction.interface';
import { CHAINS, ETH_USDT, OASIS_USDT, OASIS_WETH } from 'utils/constants';

@Injectable()
export class WormholeService {
  constructor(
    @Inject('TRANSACTION_MODEL') private transactionModel: Model<Transaction>,
  ) {}

  async tokenTransfer<N extends Network>(
    wh: Wormhole<N>,
    route: {
      token: TokenId;
      amount: bigint;
      source: SignerStuff<N, Chain>;
      destination: SignerStuff<N, Chain>;
      delivery?: {
        automatic: boolean;
        nativeGas?: bigint;
      };
      payload?: Uint8Array;
    },
    txnId: string,
    oasis?: boolean,
    roundTrip?: boolean,
  ): Promise<TokenTransfer<N>> {
    // EXAMPLE_TOKEN_TRANSFER
    // Create a TokenTransfer object to track the state of the transfer over time
    const xfer = await wh.tokenTransfer(
      route.token,
      route.amount,
      route.source.address,
      route.destination.address,
      route.delivery?.automatic ?? false,
      route.payload,
      route.delivery?.nativeGas,
    );

    const quote = await TokenTransfer.quoteTransfer(
      wh,
      route.source.chain,
      route.destination.chain,
      xfer.transfer,
    );
    console.log(quote);

    if (xfer.transfer.automatic && quote.destinationToken.amount < 0)
      throw 'The amount requested is too low to cover the fee and any native gas requested.';

    // 1) Submit the transactions to the source chain, passing a signer to sign any txns
    console.log('Starting transfer');
    const srcTxids = await xfer.initiateTransfer(route.source.signer);
    console.log(`Source Trasaction ID: ${srcTxids[0]}`);
    console.log(`Wormhole Trasaction ID: ${srcTxids[1] ?? srcTxids[0]}`);
    if (oasis) {
      await this.transactionModel.updateOne(
        {
          txId: txnId,
        },
        {
          $set: {
            wormholeSecondHash: srcTxids[1] ?? srcTxids[0],
          },
        },
      );
    } else {
      await this.transactionModel.updateOne(
        {
          txId: txnId,
        },
        {
          $set: {
            wormholeFirstHash: srcTxids[1] ?? srcTxids[0],
          },
        },
      );
    }

    // If automatic, we're done
    if (route.delivery?.automatic) return xfer;

    // 2) Wait for the VAA to be signed and ready (not required for auto transfer)
    const attestIds = await xfer.fetchAttestation(40 * 60 * 1000);
    console.log(`Got Attestation: `, attestIds);

    // 3) Redeem the VAA on the dest chain
    console.log('Completing Transfer');
    const destTxids = await xfer.completeTransfer(route.destination.signer);
    console.log(`Completed Transfer: `, destTxids);

    if (!roundTrip) return xfer;

    const { destinationToken: token } = quote;
    return await this.tokenTransfer(
      wh,
      {
        ...route,
        token: token.token,
        amount: token.amount,
        source: route.destination,
        destination: route.source,
      },
      txnId,
      oasis,
    );
  }

  async bridgeTokens(
    wh: Wormhole<Network>,
    sendChain: any,
    rcvChain: any,
    senderWalletId: keyof typeof PRIVATE_KEYS,
    receiverWalletId: keyof typeof PRIVATE_KEYS,
    amt: string,
    isNative: boolean,
    txnId: string,
    tokenAddress?: string,
    oasis?: boolean,
  ) {
    const sourceChain = wh.getChain(sendChain);
    const destinationChain = wh.getChain(rcvChain);

    const source = await getSigner(sourceChain, senderWalletId);
    const destination = await getSigner(destinationChain, receiverWalletId);

    if (!tokenAddress && !isNative) {
      throw new Error('Token address must be defined for non-native tokens.');
    }

    const token = Wormhole.tokenId(
      sourceChain.chain,
      isNative ? 'native' : tokenAddress!,
    );

    const automatic = false;
    const nativeGas = automatic ? '0.01' : undefined;

    const decimals = await getTokenDecimals(wh, token, sourceChain);

    const xfer = await this.tokenTransfer(
      wh,
      {
        token,
        amount: amount.units(amount.parse(amt, decimals)),
        source,
        destination,
        delivery: {
          automatic,
          nativeGas: nativeGas
            ? amount.units(amount.parse(nativeGas, decimals))
            : undefined,
        },
      },
      txnId,
      oasis,
    );

    return xfer;
  }

  async bridgeToOasis(
    amt: string,
    // tokenAddress?: string,
    type: string,
    // isNative = true
    txnId?: string,
  ) {
    const wh = await wormhole('Mainnet', [evm]);
    const tokenAddress = type === 'ETH' ? undefined : ETH_USDT;
    const isNative = type === 'ETH';

    return await this.bridgeTokens(
      wh,
      CHAINS.ETHEREUM,
      CHAINS.OASIS,
      WALLETID.WALLET_ETH,
      WALLETID.WALLET_OASIS,
      amt,
      isNative,
      txnId,
      tokenAddress,
      true,
    );
  }

  async bridgeToEthereum(
    amt: string,
    // tokenAddress = OASIS_WETH,
    type: string,
    // isNative = false
    txnId: string,
  ) {
    const wh = await wormhole('Mainnet', [evm]);
    const tokenAddress = type === 'ETH' ? OASIS_WETH : OASIS_USDT;
    const isNative = false;

    return await this.bridgeTokens(
      wh,
      CHAINS.OASIS,
      CHAINS.ETHEREUM,
      WALLETID.WALLET_OASIS,
      WALLETID.WALLET_OASIS,
      amt,
      isNative,
      txnId,
      tokenAddress,
    );
  }
}
