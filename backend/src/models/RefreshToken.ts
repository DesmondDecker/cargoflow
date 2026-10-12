import { Schema, model, Types } from 'mongoose';

// One collection backs refresh tokens for all three client apps
// (agency staff, drivers, platform admins), distinguished by `audience`.
// Storing a hash (never the raw token) means a leaked DB dump can't be used
// to forge sessions. Per-device rows (`deviceId`) let us revoke one device
// without signing every other device out.
export interface RefreshTokenDoc {
  _id: Types.ObjectId;
  tokenHash: string;
  audience: 'agency-app' | 'driver-app' | 'admin-app' | 'warehouse-app';
  subjectId: Types.ObjectId; // User / Driver / PlatformAdmin id
  agencyId?: Types.ObjectId; // set for agency-app tokens; used for bulk revoke on password change
  deviceId?: string;
  expiresAt: Date;
  revokedAt?: Date | null;
  createdAt: Date;
}

const refreshTokenSchema = new Schema<RefreshTokenDoc>({
  tokenHash: { type: String, required: true, unique: true, index: true },
  audience: { type: String, enum: ['agency-app', 'driver-app', 'admin-app', 'warehouse-app'], required: true },
  subjectId: { type: Schema.Types.ObjectId, required: true, index: true },
  agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', index: true },
  deviceId: { type: String },
  expiresAt: { type: Date, required: true },
  revokedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now },
});

export const RefreshTokenModel = model<RefreshTokenDoc>('RefreshToken', refreshTokenSchema);
