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
  pushToken?: string; // Expo push token (e.g. "ExponentPushToken[...]") — set via PATCH /auth/push-token
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
    pushToken: { type: String },
  },
  { timestamps: true }
);

// A name must be unique within its agency (case-insensitive) — this is how
// staff are told apart in every activity log line, per the product's own
// stated design ("your name is how you'll show up in every activity log").
userSchema.index({ agencyId: 1, name: 1 }, { unique: true, collation: { locale: 'en', strength: 2 } });
userSchema.index({ agencyId: 1, phone: 1 }, { unique: true, sparse: true });

export const UserModel = model<UserDoc>('User', userSchema);
