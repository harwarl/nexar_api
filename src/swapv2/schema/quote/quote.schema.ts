import mongoose from 'mongoose';

export const QuoteSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true }, // original unique quote identifier
    quote_uid: { type: String }, // you’re saving this separately
    provider: { type: String, required: true },
    from_currency: { type: String, required: true },
    from_network: { type: String, required: true },
    to_currency: { type: String, required: true },
    to_network: { type: String, required: true },
    from_amount: { type: String, required: true },
    to_amount: { type: String, required: true },
    uuid_request: { type: String, required: true },
    exchange_rate: { type: String, required: true },
    created_at: { type: Date },
    amount_to_usdt: { type: String },
    amount_from_usdt: { type: String },
    minAmount: { type: String },
    maxAmount: { type: String },
  },
  {
    timestamps: true,
  },
);
