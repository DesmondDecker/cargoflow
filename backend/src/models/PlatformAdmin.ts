import { Schema, model, Types } from 'mongoose';

export interface PlatformAdminDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  isActive: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const platformAdminSchema = new Schema<PlatformAdminDoc>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, trim: true, lowercase: true, index: true },
    passwordHash: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date },
  },
  { timestamps: true }
);

export const PlatformAdminModel = model<PlatformAdminDoc>('PlatformAdmin', platformAdminSchema);
