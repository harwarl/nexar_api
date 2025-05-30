import {
  ChainAddress,
  ChainContext,
  Network,
  Signer,
  Wormhole,
  Chain,
  TokenId,
  isTokenId,
} from '@wormhole-foundation/sdk';
import evm from '@wormhole-foundation/sdk/evm';
import solana from '@wormhole-foundation/sdk/solana';
import sui from '@wormhole-foundation/sdk/sui';
import { config } from 'dotenv';
config();

export enum WALLETID {
  WALLET_ETH = 'wallet_ETH',
  WALLET_OASIS = 'wallet_OASIS',
}

export const PRIVATE_KEYS = {
  wallet_ETH: process.env.ETH_PRIVATE_KEY_1,
  wallet_OASIS: process.env.ETH_PRIVATE_KEY_2,
};

export interface SignerStuff<N extends Network, C extends Chain> {
  chain: ChainContext<N, C>;
  signer: Signer<N, C>;
  address: ChainAddress<C>;
}

// Function to fetch environment variables (like your private key)
function getEnv(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing environment variable: ${key}`);
  return val;
}

// Signer setup function for different blockchain platforms
export async function getSigner<N extends Network, C extends Chain>(
  chain: ChainContext<N, C>,
  walletId: keyof typeof PRIVATE_KEYS,
): Promise<{
  chain: ChainContext<N, C>;
  signer: Signer<N, C>;
  address: ChainAddress<C>;
}> {
  let signer: Signer;
  const platform = chain.platform.utils()._platform;

  switch (platform) {
    case 'Solana':
      signer = await (
        await solana()
      ).getSigner(await chain.getRpc(), getEnv('SOL_PRIVATE_KEY'));
      break;
    case 'Evm':
      const privateKey = PRIVATE_KEYS[walletId];
      if (!privateKey) throw new Error(`Invalid wallet ID: ${walletId}`);
      signer = await (await evm()).getSigner(await chain.getRpc(), privateKey);
      break;
    case 'Sui':
      signer = await (
        await sui()
      ).getSigner(await chain.getRpc(), getEnv('SUI_PRIVATE_KEY'));
      break;
    default:
      throw new Error('Unsupported platform: ' + platform);
  }

  return {
    chain,
    signer: signer as Signer<N, C>,
    address: Wormhole.chainAddress(chain.chain, signer.address()),
  };
}

export async function getTokenDecimals<
  N extends 'Mainnet' | 'Testnet' | 'Devnet',
>(
  wh: Wormhole<N>,
  token: TokenId,
  sendChain: ChainContext<N, any>,
): Promise<number> {
  return isTokenId(token)
    ? Number(await wh.getDecimals(token.chain, token.address))
    : sendChain.config.nativeTokenDecimals;
}
