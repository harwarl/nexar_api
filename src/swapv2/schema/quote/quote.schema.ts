import mongoose from 'mongoose';

export const QuoteSchema = new mongoose.Schema(
  {
    uid: { type: String, required: true, unique: true },
    provider: { type: String, required: true },
    from_currency: { type: String, required: true },
    from_network: { type: String, required: true },
    to_currency: { type: String, required: true },
    to_network: { type: String, required: true },
    from_amount: { type: String, required: true },
    to_amount: { type: String, required: true },
    tx_id: { type: String, required: true },
    uuid_request: { type: String, required: true },
    exchange_rate: { type: String, required: true },
  },
  {
    timestamps: true,
  },
);
