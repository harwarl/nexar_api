export interface TokenProvider {
  readonly name: string;
  fetchSupportedTokens(): Promise<ProviderToken[]>;
  fetchQuote?(getQuoteData: QuoteData): Promise<any>;
  fetchSupportedNetworks?(): Promise<ProviderNetwork[]>;
}

export interface ProviderToken {
  symbol: string;
  network: string;
  name?: string;
  alias?: string;
  isActive?: boolean;
  iconUrl?: string;
  providerMetadata?: any;
  // Add other provider specific fields
}

export interface ProviderNetwork {
  id: string;
  name: string;
  symbol: string;
  isActive: boolean;
  features?: string[];
}

export interface QuoteData {
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  fromNetwork?: string;
  toNetwork?: string;
}

export interface FetchQuoteResponse {
  isError: boolean;
  isMessage: boolean;
  minAmount?: number;
  maxAmount?: number;
  message: string | null;
  fromAmount: number;
  toAmount: number;
  rate: number;
}
