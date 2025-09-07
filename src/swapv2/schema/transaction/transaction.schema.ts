import mongoose from 'mongoose';

export const TransactionSchemaV2 = new mongoose.Schema(
  {
    uuid_request: { type: String, required: true, unique: true },
    status: { type: String, required: true, default: 'PENDING' },
    from_currency: { type: String, required: true },
    to_currency: { type: String, required: true },
    from_network: { type: String, required: true },
    to_network: { type: String, required: true },
    from_amount: { type: String, required: true },
    to_amount: { type: String, required: true },
    direction: { type: String, required: true },
    payin_hash: { type: String }, // optional in interface
    payout_hash: { type: String }, // optional in interface
    payin_address: { type: String },
    payout_address: { type: String },
    recipient_address: { type: String, required: true },
    selected_provider: { type: String, required: true },
    selected_quote_uid: { type: String, required: true },
    exchange_rate: { type: String },
    quote_db_id: { type: String, required: true },
    tx_id: { type: String },
    amount: { type: String },
    amount_to_receiver: { type: String },
    refund_address: { type: String }, // optional in interface
  },
  { timestamps: true },
);
