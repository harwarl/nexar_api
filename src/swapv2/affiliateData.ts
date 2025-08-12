import 'dotenv/config';

export interface AffiliateProviderConfig {
  name: string;
  baseUrl: string;
  apiKey: string;
  apiSecret?: string;
  endpoints: {
    tokens: string;
    getTransactions: string;
    getTransactionById: string;
    createExchangeTxn: string;
    getMiniumAmount?: string;
    confirmTransaction?: string;
    chains?: string;
  };
}

export const AFFILIATE_PROVIDERS: AffiliateProviderConfig[] = [
  {
    name: 'exolix',
    baseUrl: '',
    apiKey: process.env.EXOLIX_API_KEY || '',
    endpoints: {
      tokens: 'currencies',
      chains: 'currencies/networks',
      getTransactions: 'transactions',
      getTransactionById: 'transactions/', // expects an Id
      createExchangeTxn: 'transactions', // POST
    },
  },
  {
    name: 'fixed_float',
    baseUrl: '',
    apiKey: process.env.FIXED_FLOAT_API_KEY || '',
    apiSecret: process.env.FIXED_FLOAT_API_SECRET || '',
    endpoints: {
      tokens: 'ccies',
      chains: 'currencies/networks',
      getTransactions: '',
      getTransactionById: '',
      getMiniumAmount: 'price',
      createExchangeTxn: 'create', // Has a body
    },
  },
  {
    name: 'swapuz',
    baseUrl: '',
    apiKey: process.env.SWAPUZ_API_KEY || '',
    endpoints: {
      tokens: 'home/v1/coins',
      chains: '',
      getMiniumAmount: '',
      getTransactions: 'home/v1/rate/', // has a coin query which is ?from, to , amount , fromNetwork toNetwork and mode
      getTransactionById: 'order/uid/', // will have uuid has a param
      createExchangeTxn: 'home/v1/order',
    },
  },
  {
    name: 'simple_swap',
    baseUrl: '',
    apiKey: process.env.SIMPLE_SWAP_API_KEY || '',
    endpoints: {
      tokens: 'pairs',
      chains: 'currencies/networks',
      getTransactions: 'exchanges', // Hhas some queries like ?from, to, amount, fromNetwork, toNetwork
      getTransactionById: 'exchanges/', // Expects a public Id
      createExchangeTxn: 'exchanges', // Has a body
      confirmTransaction: 'exchanges', // Has a body
      getMiniumAmount: 'ranges',
    },
  },
  {
    name: 'changenow',
    baseUrl: '',
    apiKey: process.env.CHANGENOW_API_KEY || '',
    endpoints: {
      tokens: 'pairs',
      chains: 'currencies/networks',
      getTransactions: 'exchanges', // Hhas some queries like ?from, to, amount, fromNetwork, toNetwork
      getTransactionById: 'exchanges/', // Expects a public Id
      confirmTransaction: 'exchanges', // Has a body
      createExchangeTxn: '',
      getMiniumAmount: 'ranges',
    },
  },
];
