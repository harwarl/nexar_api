import * as mongoose from 'mongoose';

export const KeysSchema = new mongoose.Schema(
  {
    key: String,
    expiresAt: Date,
    isActive: Boolean,
    isMaster: Boolean,
  },
  { timestamps: true },
);
