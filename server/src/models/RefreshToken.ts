import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

export interface IRefreshToken extends Document {
  userId: mongoose.Types.ObjectId;
  tokenHash: string;
  family: string;       // For rotation: all tokens in same family
  expiresAt: Date;
  revokedAt?: Date;
  replacedByHash?: string;
  userAgent?: string;
  ip?: string;
  createdAt: Date;
}

const RefreshTokenSchema = new Schema<IRefreshToken>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    tokenHash: {
      type: String,
      required: true,
      unique: true,
    },
    family: {
      type: String,
      required: true,
      index: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      index: { expireAfterSeconds: 0 }, // TTL index – auto-delete
    },
    revokedAt: Date,
    replacedByHash: String,
    userAgent: String,
    ip: String,
  },
  { timestamps: true }
);

RefreshTokenSchema.index({ userId: 1, family: 1 });

/**
 * Hash a raw refresh token for secure storage.
 */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export default mongoose.model<IRefreshToken>('RefreshToken', RefreshTokenSchema);
