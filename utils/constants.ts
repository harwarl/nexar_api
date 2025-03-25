export const GLOBAL_PREFIX = 'api';
export const ENV_FILE_PATH = '.env';
export const DEV = 'DEV';

/*------------------------------ URLs ------------------------------*/
export const BASE_URL = 'BASE_URL';
export const API_KEY = 'API_KEY';
export const TOKENS_PATH = 'currencies?active=true&fixedRate=true';

/*------------------------------ CONTRACT ADDRESSES ------------------------------*/
export const ETH_WETH = '';
export const OASIS_WETH = '';
export const ETH_USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
export const OASIS_USDT = '';
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
  ORDER_CREATED = 'order created',
  OASIS_CLAIM = 'oasis claim',
  RECEIVER_ROUTING = 'receiver routing',
  ORDER_COMPLETED = 'order completed',
}
