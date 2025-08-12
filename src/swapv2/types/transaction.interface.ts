export interface Transaction {
  status: string;
  payinHash: string;
  payinAddress: string;
  payoutAddress: string;
  fromCurrency: string;
  toCurrency: string;
  amountSent: number; // This is the amount sent to the receiver
  amountReceived: number; // This is the amount received dby the sender
  txId: string;
  expectedSendAmount: number;
  expectedReceiveAmount: number;
  isPartner: Boolean;
  depositReceivedAt: string;
  volumeInUsdt: number;
  platform: string;
  recieversAddress: string;
  reason: string;
  sender: string;
  identifier: string;
  error: string;
}
