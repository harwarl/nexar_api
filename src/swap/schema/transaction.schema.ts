import * as mongoose from 'mongoose';

export const TransactionSchema = new mongoose.Schema(
  {
    status: String,
    payinHash: String,
    payinAddress: String,
    payoutAddress: String,
    fromCurrency: String,
    toCurrency: String,
    amountSend: Number,
    txId: String,
    updatedAt: Date,
    expectedSendAmount: Number,
    expectedReceiveAmount: Number,
    createdAt: Date,
    isPartner: Boolean,
    depositReceivedAt: Date,
    volumeInUsdt: Number,
    inApp: Boolean,
    wormholeFirstHash: String,
    wormholeSecondHash: String,
  },
  { timestamps: false },
);
