import mongoose from 'mongoose';

export const TransactionSchemaV2 = new mongoose.Schema(
  {
    status: String,
    payinHash: String,
    payinAddress: String,
    payoutAddress: String,
    fromCurrency: String,
    toCurrency: String,
    amountSent: Number, // This is the amount sent to the receiver
    amountReceived: Number, // This is the amount received dby the sender
    txId: String,
    updatedAt: Date,
    expectedSendAmount: Number,
    expectedReceiveAmount: Number,
    createdAt: Date,
    isPartner: Boolean,
    depositReceivedAt: Date,
    volumeInUsdt: Number,
    platform: String,
    recieversAddress: String,
    reason: String,
    sender: String,
    identifier: String,
    error: String, // This field is used to store any error messages related to the transaction
  },
  { timestamps: false },
);
