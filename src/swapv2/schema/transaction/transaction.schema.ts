import mongoose from 'mongoose';

export const TransactionSchemaV2 = new mongoose.Schema(
  {
    uuid_request: { type: String, required: true, unique: true },
    from_currency: { type: String, required: true },
    to_currency: { type: String, required: true },
    from_network: { type: String, required: true },
    to_network: { type: String, required: true },
    from_amount: { type: String, required: true },
    to_amount: { type: String, required: true },
    direction: { type: String, required: true },
    recipient_address: { type: String, required: true },
    selected_provider: { type: String, required: true },
    selected_quote_uid: { type: String, required: true },
    status: { type: String, required: true, default: 'PENDING' },
    tx_id: { type: String },
    exchange_rate: { type: String },
  },
  { timestamps: false },
);
