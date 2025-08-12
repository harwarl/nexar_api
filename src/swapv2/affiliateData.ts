import 'dotenv/config';

export interface AffiliateProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  apiSecret?: string;
  endpoints: {
    tokens: string;
    chains?: string;
    getTransactions?: string;
    getTransactionById?: string;
    createExchangeTxn?: string;
    getMinimumAmount?: string;
    confirmTransaction?: string;
  };
}

export const AFFILIATE_PROVIDERS: AffiliateProviderConfig[] = [
  {
    name: 'exolix',
    baseUrl: '', // e.g., 'https://api.exolix.com/v1/'
    apiKey: process.env.EXOLIX_API_KEY || '',
    endpoints: {
      tokens: 'currencies',
      chains: 'currencies/networks',
      getTransactions: 'transactions',
      getTransactionById: 'transactions/', // expects ID as param
      createExchangeTxn: 'transactions', // POST with body
    },
  },
  {
    name: 'fixed_float',
    baseUrl: '', // e.g., 'https://api.fixedfloat.com/v1/'
    apiKey: process.env.FIXED_FLOAT_API_KEY || '',
    apiSecret: process.env.FIXED_FLOAT_API_SECRET || '',
    endpoints: {
      tokens: 'ccies',
      chains: 'currencies/networks',
      getMinimumAmount: 'price', // query params: from, to, amount
      createExchangeTxn: 'create', // POST with body
    },
  },
  {
    name: 'swapuz',
    baseUrl: '', // e.g., 'https://api.swapuz.com/'
    apiKey: process.env.SWAPUZ_API_KEY || '',
    endpoints: {
      tokens: 'home/v1/coins',
      getTransactions: 'home/v1/rate/', // query: from, to, amount, fromNetwork, toNetwork, mode
      getTransactionById: 'order/uid/', // expects UUID as param
      createExchangeTxn: 'home/v1/order', // POST with body
    },
  },
  {
    name: 'simple_swap',
    baseUrl: '', // e.g., 'https://api.simpleswap.io/v1/'
    apiKey: process.env.SIMPLE_SWAP_API_KEY || '',
    endpoints: {
      tokens: 'pairs',
      chains: 'currencies/networks',
      getTransactions: 'exchanges', // query: from, to, amount, fromNetwork, toNetwork
      getTransactionById: 'exchanges/', // expects public ID as param
      createExchangeTxn: 'exchanges', // POST with body
      confirmTransaction: 'exchanges', // POST with body
      getMinimumAmount: 'ranges',
    },
  },
  {
    name: 'changenow',
    baseUrl: '', // e.g., 'https://api.changenow.io/v1/'
    apiKey: process.env.CHANGENOW_API_KEY || '',
    endpoints: {
      tokens: 'currencies?active=true&fixedRate=true',
      getTransactions: 'exchanges', // query: from, to, amount, fromNetwork, toNetwork
      getTransactionById: 'exchanges/', // expects public ID as param
      confirmTransaction: 'exchanges', // POST with body
      getMinimumAmount: 'ranges',
    },
  },
];
