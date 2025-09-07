import { TokenResponse } from 'src/tokens/tokens.interface';

export interface TransactionExchange {
  status: string;
  updatedAt: Date;
  createdAt: Date;
  uuid_request: string;
  from_currency: string;
  to_currency: string;
  from_network: string;
  to_network: string;
  from_amount: string;
  to_amount: string;
  direction: string;
  payin_hash: string;
  payout_hash: string;
  payin_address: string;
  payout_address: string;
  recipient_address: string;
  selected_provider: string;
  selected_quote_uid: string;
  exchange_rate?: string;
  quote_db_id: string;
  tx_id: string;
  amount: string;
  amount_to_receiver: string;
  refund_address?: string;
  payinHash?: string;
  payooutHash?: string;
}

export interface CreateTransactionPayload {
  amount: string;
  recipient_address: string;
  refund_address?: string;
  fromToken: TokenResponse;
  toToken: TokenResponse;
  payload?: Record<string, any>;
}
