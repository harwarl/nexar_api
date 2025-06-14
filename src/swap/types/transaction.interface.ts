export interface Transaction {
  status: string;
  payinHash: string;
  payinAddress: string;
  payoutAddress: string;
  fromCurrency: string;
  toCurrency: string;
  amountSend: number;
  txId: string;
  updatedAt: string;
  expectedSendAmount: number;
  expectedReceiveAmount: number;
  createdAt: string;
  isPartner: boolean;
  depositReceivedAt: string;
  volumeInUsdt: number;
  inApp: boolean;
  tokensDestination: string;
  wormholeFirstHash: string;
  wormholeSecondHash: string;
  isTransfer: boolean;
  identifier?: string;
  reason?: string;
  sender?: string;
}
