export enum AFFILIATES {
  EXOLIX = 'exolix',
  // FIXED_FLOAT = 'fixed_float',
  SWAPUZ = 'swapuz',
  SIMPLE_SWAP = 'simple_swap',
  CHANGENOW = 'changenow',
}

export const AFFILIATE_DATA = {
  EXOLIX: {
    name: AFFILIATES.EXOLIX,
    baseUrl: process.env.EXOLIX_API_URL, // e.g., 'https://api.exolix.com/v1/'
    apiKey: process.env.EXOLIX_API_KEY || '',
    endpoints: {
      tokens: 'currencies',
      chains: 'currencies/networks',
      getTransactions: 'transactions',
      getTransactionById: 'transactions/', // expects ID as param
      createExchangeTxn: 'transactions', // POST with body
    },
  },
  CHANGENOW: {
    name: AFFILIATES.CHANGENOW,
    baseUrl: process.env.CHANGENOW_URL, // e.g., 'https://api.changenow.io/v1/'
    apiKey: process.env.CHANGENOW_API_KEY || '',
    endpoints: {
      tokens: 'currencies?active=true&fixedRate=true',
      getTransactions: 'exchanges', // query: from, to, amount, fromNetwork, toNetwork
      getTransactionById: 'exchanges/', // expects public ID as param
      confirmTransaction: 'exchanges', // POST with body
      getMinimumAmount: 'ranges',
    },
  },
};
