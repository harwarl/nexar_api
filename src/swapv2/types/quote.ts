export interface Quote {
  uid: string;
  provider: string;
  from_currency: string;
  from_network: string;
  to_currency: string;
  to_network: string;
  from_amount: string;
  to_amount: string;
  uuid_request: string;
  exchange_rate: string;
  amount_to_usdt: string;
  amount_from_usdt: string;
  minAmount: string;
  maxAmount: string;
  createdAt: string;
  updatedAt: string;
}
