import { Injectable, Inject } from '@nestjs/common';
import type { Chain, Network, TokenId } from '@wormhole-foundation/sdk';
import { Model } from 'mongoose';
import evm from '@wormhole-foundation/sdk/evm';
import {
  getSigner,
  PRIVATE_KEYS,
  SignerStuff,
  WALLETID,
} from '../helpers/helpers';
import {
  wormhole,
  TokenTransfer,
  amount,
  Wormhole,
  isTokenId,
  // isNative,
} from '@wormhole-foundation/sdk';
import { Transaction } from 'src/swap/types/transaction.interface';
import { CHAINS, ETH, ETH_USDT, OASIS_USDT, OASIS_WETH } from 'utils/constants';

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

    if (xfer.transfer.automatic && quote.destinationToken.amount < 0)
      throw 'The amount requested is too low to cover the fee and any native gas requested.';

    // 1) Submit the transactions to the source chain, passing a signer to sign any txns
    const srcTxids = await xfer.initiateTransfer(route.source.signer);
    // console.log({ srcTxids });

    if (oasis) {
      await this.transactionModel.updateOne(
        {
          txId: txnId,
        },
        {
          $set: {
            wormholeSecondHash: srcTxids[0] ? srcTxids[0] : srcTxids[1],
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
            wormholeFirstHash: srcTxids[0] ? srcTxids[0] : srcTxids[1],
          },
        },
      );
    }

    // If automatic, we're done
    if (route.delivery?.automatic) return xfer;

    // 2) Wait for the VAA to be signed and ready (not required for auto transfer)
    await xfer.fetchAttestation(40 * 60 * 1000);
    await xfer.completeTransfer(route.destination.signer);

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

    const decimals = isTokenId(token)
      ? Number(await wh.getDecimals(token.chain, token.address))
      : sendChain.config.nativeTokenDecimals;

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
    const wh = await this.initializeWormhole();

    const tokenAddress =
      type.toUpperCase() === ETH.toUpperCase() ? undefined : ETH_USDT;
    const isNative = type.toUpperCase() === ETH.toUpperCase();

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
    const wh = await this.initializeWormhole();
    const tokenAddress =
      type.toUpperCase() === ETH.toUpperCase() ? OASIS_WETH : OASIS_USDT;
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
      false,
    );
  }

  async initializeWormhole() {
    return await wormhole('Mainnet', [evm], {
      chains: {
        Ethereum: {
          contracts: {
            coreBridge: '0x98f3c9e6E3fAce36bAAd05FE09d375Ef1464288B',
            tokenBridge: '0x3ee18B2214AFF97000D974cf647E7C347E8fa585',
            nftBridge: '0x6FFd7EdE62328b3Af38FCD61461Bbfc52F5651fE',
            relayer: '0x27428DD2d3DD32A4D7f7C497eAaa23130d894911',
            tokenBridgeRelayer: '0xcafd2f0a35a4459fa40c0517e17e6fa2939441ca',
            cctp: {
              tokenMessenger: '0xbd3fa81b58ba92a82136038b25adec7066af3155',
              messageTransmitter: '0x0a992d191deec32afe36203ad87d7d289a738f81',
              wormholeRelayer: '0x4cb69FaE7e7Af841e44E1A1c30Af640739378bb2',
              wormhole: '0xAaDA05BD399372f0b0463744C09113c137636f6a',
            },
            portico: {
              porticoUniswap: '0x48b6101128C0ed1E208b7C910e60542A2ee6f476',
              uniswapQuoterV2: '0x61fFE014bA17989E743c5F6cB21bF9697530B21e',
              porticoPancakeSwap: '0x4db1683d60e0a933A9A477a19FA32F472bB9d06e',
              pancakeSwapQuoterV2: '0xB048Bbc1Ee6b733FFfCFb9e9CeF7375518e25997',
            },
          },
          rpc: process.env.ETH_RPC!,
        },
      },
    });
  }
}
