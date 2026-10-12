import { Schema, model, Types } from 'mongoose';

export type SubscriptionStatus = 'trialing' | 'active' | 'expired' | 'canceled';

export interface AgencyDoc {
  _id: Types.ObjectId;
  name: string;
  agencyCode: string;
  passwordHash: string; // shared agency password staff join/log in with
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
  // Display-only overrides, keyed by the FIXED internal status/document-type
  // strings (ContainerStatus / DocumentType) — never a new key. Business
  // logic throughout the app (driver dispatch, attention flags, the daily
  // digest, deadline date-stamping) compares against those fixed strings
  // directly, so this can only relabel what staff see — it can't add,
  // remove, or reorder a status or document type without breaking things
  // that already work. See agencyController's own comment for the fuller
  // reasoning. Mongoose Maps, not plain objects, so an update can patch one
  // label without clobbering the rest.
  statusLabels?: Map<string, string>;
  documentTypeLabels?: Map<string, string>;
  isActive: boolean; // platform-admin suspend/reactivate — separate from subscription
  subscription: {
    status: SubscriptionStatus;
    planId?: string;
    currentPeriodEnd?: Date;
  };
  createdAt: Date;
  updatedAt: Date;
}

const agencySchema = new Schema<AgencyDoc>(
  {
    name: { type: String, required: true, trim: true },
    agencyCode: { type: String, required: true, unique: true, uppercase: true, index: true },
    passwordHash: { type: String, required: true },
    contactEmail: { type: String, trim: true, lowercase: true },
    contactPhone: { type: String, trim: true },
    address: { type: String, trim: true },
    statusLabels: { type: Map, of: String },
    documentTypeLabels: { type: Map, of: String },
    isActive: { type: Boolean, default: true },
    subscription: {
      status: { type: String, enum: ['trialing', 'active', 'expired', 'canceled'], default: 'trialing' },
      planId: { type: String },
      currentPeriodEnd: { type: Date },
    },
  },
  { timestamps: true }
);

export const AgencyModel = model<AgencyDoc>('Agency', agencySchema);
