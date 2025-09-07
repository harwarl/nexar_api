export interface Quote {
  uid: string;
  provider: string;
  from_currency: string;
  from_network: string;
  to_currency: string;
  to_network: string;
  from_amount: string;
  to_amount: string;
  tx_id: string;
  uuid_request: string;
  exchange_rate: string;
}
