import { AFFILIATES } from 'src/providers/provider.data';
import { TokenResponse } from 'src/tokens/tokens.interface';

export interface ExchangeRequest {
  from_currency: string;
  to_currency: string;
  from_network: string;
  to_network: string;
  from_amount: string;
  direction: string;
  uuid_request: string;
  init: boolean;
}

export interface ExchangeQuote {
  uid: string;
  provider: string;
  estimated_amount_to: string;
  estimated_amount_from: string;
  estimated_amount_to_usdt: string;
  estimated_amount_from_usdt: string;
  exchange_rate: string;
  fee?: string;
  created_at: string;
  minAmount: string;
  maxAmount: string;
  isBest?: boolean;
}

export interface ExchangeQuoteWithTxId extends ExchangeQuote {
  tx_id: string;
}

export interface ErrorMessage {
  isError: boolean;
  message: string;
}

export interface ExchangeResponseInit {
  uid: string;
  from_currency: string;
  to_currency: string;
  from_network: string;
  to_network: string;
  from_amount: string;
  to_amount: string;
  from_amount_usdt: string;
  to_amount_usdt: string;
  direction: string;
  status: string;
  created_at: string;
  updated_at: string;
  quotes: ExchangeQuote[] | ExchangeQuoteWithTxId[];
  bestQuote: ExchangeQuote;
  uuid_request: string;
  errors: Record<string, string>;
  refund_address?: string | null;
}

export interface ExchangeResponse extends ExchangeResponseInit {
  verified_txn?: boolean; // Needed to clean exchange requests
  recipient_address?: string | null;
  selected_provider?: string | null;
  selected_quote_uid?: string | null;
  from_token_obj: TokenResponse;
  to_token_obj: TokenResponse;
}

export interface ProviderQuote {
  provider: string;
  from_amount: string;
  to_amount: string;
  fee: string;
  exchange_rate: string;
}
