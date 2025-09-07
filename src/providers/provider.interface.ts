import { CreateTransactionDto } from 'src/swapv2/dto/createTransaction.dto';
import { CreateTransactionPayload } from 'src/swapv2/types/transaction';

export interface TokenProvider {
  readonly name: string;
  fetchSupportedTokens(): Promise<ProviderToken[]>;
  createTransaction?(
    createTransactionPayload: CreateTransactionPayload,
  ): Promise<TransactionResponse>;
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

export interface TransactionResponse {
  isError: boolean;
  error?: string | null;
  txId: string | null;
  payinAddress: string;
  payoutAddress: string;
  status: string;
  // payinExtraId?: string | null;
  // payoutExtraId?: string | null;
  fromCurrency: string;
  toCurrency: string;
  amount: number;
  amountToReceiver?: number;
  refundAddress?: string | null;
  payinHash: string | null;
  payoutHash: string | null;
  fromNetwork: string;
  toNetwork: string;
}
