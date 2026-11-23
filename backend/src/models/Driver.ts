import { Schema, model, Types } from 'mongoose';

export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface DriverDoc {
  _id: Types.ObjectId;
  name: string;
  phone: string;
  passwordHash: string;
  location?: string;
  yearsExperience?: number;
  licenseDocumentUrl?: string;
  verificationStatus: VerificationStatus;
  availability: boolean;
  pushToken?: string; // Expo push token, set via PATCH /driver/push-token
  notificationPrefs?: { jobAlerts?: boolean }; // missing means on
  isActive: boolean;
  ratingTotal: number; // ratingAverage is derived (ratingTotal / ratingCount), not stored redundantly
  ratingCount: number;
  // Paid placement boost — same mechanism and same reasoning as
  // Warehouse.sponsored (see that model's comment).
  sponsored: boolean;
  sponsoredUntil?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const driverSchema = new Schema<DriverDoc>(
  {
    name: { type: String, required: true, trim: true },
    phone: { type: String, required: true, unique: true, trim: true, index: true },
    passwordHash: { type: String, required: true },
    location: { type: String, trim: true },
    yearsExperience: { type: Number },
    licenseDocumentUrl: { type: String, trim: true },
    verificationStatus: { type: String, enum: ['unverified', 'pending', 'verified', 'rejected'], default: 'unverified' },
    availability: { type: Boolean, default: false },
    pushToken: { type: String },
    notificationPrefs: { jobAlerts: { type: Boolean } },
    isActive: { type: Boolean, default: true },
    ratingTotal: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
    sponsored: { type: Boolean, default: false },
    sponsoredUntil: { type: Date, default: null },
  },
  { timestamps: true }
);

export const DriverModel = model<DriverDoc>('Driver', driverSchema);
