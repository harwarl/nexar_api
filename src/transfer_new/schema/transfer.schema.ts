import mongoose from 'mongoose';

export const TransferSchema = new mongoose.Schema(
  {
    status: String,
    step: Number,
    payinHash: String,
    payoutHash: String,
    payinAddress: String,
    payoutAddress: String,
    fromCurrency: String,
    toCurrency: String,
    amountSent: Number,
    txId: String,
    recipientAddress: String,
    firstBridgeHash: String,
    secondBridgeHash: String,
    internalTransferHash: String,
    transferToReceiverHash: String,
    senderAddress: String,
    identifier: String,
    expectedSendAmount: Number,
    expectedReceiveAmount: Number,
    refundHash: String,
    walletA: String,
    walletB: String,
    isTestnet: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);
