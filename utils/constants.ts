import {
  arbitrumSepolia,
  base,
  baseSepolia,
  mainnet,
  sepolia,
} from 'viem/chains';
import 'dotenv/config';
import { JsonRpcProvider } from 'ethers';

export const GLOBAL_PREFIX = 'api';
export const ENV_FILE_PATH = '.env';
export const DEV = 'DEV';

/*------------------------------ URLs ------------------------------*/
export const BASE_URL = 'BASE_URL';
export const API_KEY = 'API_KEY';
export const TOKENS_PATH = 'currencies?active=true&fixedRate=true';

/*------------------------------ CONTRACT ADDRESSES ------------------------------*/
export const OASIS_WETH: string = '0x3223f17957Ba502cbe71401D55A0DB26E5F7c68F';
export const ETH_WETH: string = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
export const OASIS_USDT: string = '0xdC19A122e268128B5eE20366299fc7b5b199C8e3';
export const ETH_USDT: string = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

/*------------------------------ MINIMUM VALUES ------------------------------*/
export const USDT_MINIMUM = 10;
export const USDC_MINIMUM = 10;
export const ETH_MINIMUM = 0.0005;

/*------------------------------ TOKEN TICKERS ------------------------------*/
export const ETH = 'eth';
export const USDT = 'usdt';
export const USDC = 'usdc';
export const WETH = 'weth';

/*------------------------------ BACKEND WALLETS ------------------------------*/
export const BACKEND_WALLET_1 = '0xef0C2f5b23717d1930f4EC61eAdC42D3e50Ac34e';
export const BACKEND_WALLET_2 = '0xBcA05C6b8091C07D03fd4E2BB094228C85FC552b';

/*------------------------------ MINIMUM VALUE ------------------------------*/
export const minimumAmounts: Record<string, number> = {
  [WETH]: ETH_MINIMUM,
  [ETH]: ETH_MINIMUM,
  [USDT]: USDT_MINIMUM,
  [USDC]: USDC_MINIMUM,
};

/*------------------------------ SUPPORTED CHAINS ------------------------------*/
export enum CHAINS {
  ETHEREUM = 'Ethereum',
  OASIS = 'Oasis',
}

/*------------------------------ GAS FEES ------------------------------*/
export const ETH_GAS_FEES: number = 0.008;
export const USDT_FEES: number = 27.5;
export const FEE_PERCENTAGE: number = 0.01;

/*------------------------------ STATUS ------------------------------*/
export enum STATUS {
  NEW = 'new',
  WAITING = 'waiting',
  CONFIRMING = 'confirming',
  ORDER_CREATED = 'order_created',
  OASIS_CLAIM = 'oasis_claim',
  RECEIVER_ROUTING = 'receiver_routing',
  ORDER_COMPLETED = 'order_completed',
  FAILED = 'failed',
  CROSS_CHAIN_CLAIM = 'cross_chain_claim',
  REFUNDING = 'refunding',
  REFUNDED = 'refunded',
}

/*------------------------------ FAILURE_REASONS ------------------------------*/
export enum REASON {
  INSUFFICIENT_AMOUNT = 'Insufficient Amount sent',
  NO_AMOUNT = 'No Amount sent',
}

/*------------------------------ SIGNATURE ------------------------------*/
export const TRANSFER_SIGNATURE = '0xa9059cbb';

// Supported chains
export const SUPPORTED_CHAINS = [sepolia, arbitrumSepolia, mainnet, base];

// Token Address of supported tokens
export const TOKEN_ADDRESS: Record<
  string,
  { ETH: string; BASE: string; SEPOLIA: string; BASE_SEPOLIA: string }
> = {
  WETH: {
    ETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Ethereum Mainnet WETH
    BASE: '0x4200000000000000000000000000000000000006', // Base Mainnet WETH
    SEPOLIA: '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', // Sepolia testnet WETH
    BASE_SEPOLIA: '0x980B62Da83eFf3D4576C647993b0c1D7faf17c73', // Arbitrum TEstnet Mainnet
  },
  USDC: {
    ETH: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // Ethereum Mainnet USDC
    BASE: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // Base Mainnet USDC
    SEPOLIA: '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238',
    BASE_SEPOLIA: '0x036CbD53842c5426634e7929541eC2318f3dCF7e',
  },
};

// Supported Tokens
export enum SUPPORTED_TOKENS {
  WETH = 'WETH',
  USDC = 'USDC',
  USDT = 'USDT',
  ETH = 'WETH',
}

// PROVIDERS
export const PROVIDERS = {
  MAINNET: new JsonRpcProvider(process.env.MAINNET_RPC_URL || ''),
  BASE: new JsonRpcProvider(process.env.BASE_RPC_URL || ''),
  SEPOLIA: new JsonRpcProvider(process.env.SEPOLIA_RPC_URL || ''),
  BASE_TESTNET: new JsonRpcProvider(process.env.BASE_TEST_RPC_URL || ''),
};

// Buffer gas to add to the transaction amount
export const BUFFER_GAS = '0.0008';
