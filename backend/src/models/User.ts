import { Schema, model, Types } from 'mongoose';

export type UserRole = 'owner' | 'admin' | 'staff';

export interface UserDoc {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  name: string;
  phone?: string;
  email?: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt?: Date;
  pinHash?: string; // bcrypt hash of the person's own login PIN
  pinFailedAttempts?: number;
  pinLockedUntil?: Date;
  pushToken?: string; // Expo push token (e.g. "ExponentPushToken[...]") — set via PATCH /auth/push-token
  // dailySummary: the 08:30 push (tracking changes, urgent containers, expired
  // deadlines, missing documents). Missing means on.
  // driverUpdates: a push when a driver accepts, declines or delivers a job
  // the user assigned. Missing means on.
  notificationPrefs?: { dailySummary?: boolean; driverUpdates?: boolean };
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<UserDoc>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
    name: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    role: { type: String, enum: ['owner', 'admin', 'staff'], default: 'staff' },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
    pinHash: { type: String, select: false },
    pinFailedAttempts: { type: Number, default: 0 },
    pinLockedUntil: { type: Date },
    pushToken: { type: String },
    notificationPrefs: { dailySummary: { type: Boolean }, driverUpdates: { type: Boolean } },
  },
  { timestamps: true }
);

// A name must be unique within its agency (case-insensitive) — this is how
// staff are told apart in every activity log line, per the product's own
// stated design ("your name is how you'll show up in every activity log").
userSchema.index({ agencyId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
userSchema.index({ agencyId: 1, phone: 1 }, { unique: true, sparse: true });

export const UserModel = model<UserDoc>('User', userSchema);
