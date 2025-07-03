import mongoose from 'mongoose';

export const TransferSchema = new mongoose.Schema(
  {
    status: String,
    payinHash: String,
    payoutHash: String,
    fromCurrency: String,
    toCurrency: String,
    amountSent: Number,
    txId: String,
    recipientAddress: String,
    firstBridgeHash: String,
    secondBridgeHash: String,
    internalTransferHash: String,
    senderAddress: String,
    identifier: String,
  },
  {
    timestamps: true,
  },
);
