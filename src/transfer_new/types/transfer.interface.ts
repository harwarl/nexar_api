export interface Transfer {
  status: string;
  step: number;
  payinHash: string;
  payoutHash: string;
  payinAddress: string;
  payoutAddress: string;
  fromCurrency: string;
  toCurrency: string;
  amountSent: number;
  txId: string;
  recipientAddress: string;
  firstBridgeHash: string;
  secondBridgeHash: string;
  internalTransferHash: string;
  transferToReceiverHash: string;
  senderAddress: string;
  identifier: string;
  expectedSendAmount: number;
  expectedReceiveAmount: number;
  refundHash: string;
  walletA: string;
  walletB: string;
  isTestnet?: boolean;
}
