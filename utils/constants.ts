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
export const USDT_MINIMUM = 100;
export const ETH_MINIMUM = 0.05;

/*------------------------------ TOKEN TICKERS ------------------------------*/
export const ETH = 'eth';
export const USDT = 'usdterc20';

/*------------------------------ BACKEND WALLETS ------------------------------*/
export const BACKEND_WALLET_1 = '0xef0C2f5b23717d1930f4EC61eAdC42D3e50Ac34e';
export const BACKEND_WALLET_2 = '0xBcA05C6b8091C07D03fd4E2BB094228C85FC552b';

/*------------------------------ MINIMUM VALUE ------------------------------*/
export const minimumAmounts: Record<string, number> = {
  [ETH]: ETH_MINIMUM,
  [USDT]: USDT_MINIMUM,
};

/*------------------------------ SUPPORTED CHAINS ------------------------------*/
export enum CHAINS {
  ETHEREUM = 'Ethereum',
  OASIS = 'Oasis',
}

/*------------------------------ GAS FEES ------------------------------*/
export const ETH_GAS_FEES: number = 0.01;
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
}

/*------------------------------ FAILURE_REASONS ------------------------------*/
export enum REASON {
  INSUFFICIENT_AMOUNT = 'Insufficient Amount sent',
  NO_AMOUNT = 'No Amount sent',
}

/*------------------------------ SIGNATURE ------------------------------*/
export const TRANSFER_SIGNATURE = '0xa9059cbb';
