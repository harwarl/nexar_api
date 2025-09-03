import { AFFILIATES } from 'src/providers/provider.data';

export interface ExchangeRequest {
  from_currency: string;
  to_currency: string;
  from_network: string;
  to_network: string;
  from_amount: string;
  direction: string;
  uuid_request?: string;
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
}

export interface ErrorMessage {
  isError: boolean;
  message: string;
}

export interface ExchangeResponse {
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
  quotes: ExchangeQuote[];
  uuid_request: string;
}

export interface ProviderQuote {
  provider: string;
  from_amount: string;
  to_amount: string;
  fee: string;
  exchange_rate: string;
}
