import { Schema, model, Types } from 'mongoose';

// Staff of an institution taking part in the customs-verification workflow.
// They are not agency staff and not Summit operators, so they get their own
// accounts, created by a platform admin ("configure user accounts and roles
// for the participating institutions"). What each institution can do:
//   customs: see every submission, approve it or return it, enter a record on
//            an agent's behalf, see reports.
//   agl:     read-only view of APPROVED records, export them, see reports.
export type Institution = 'customs' | 'agl';

export interface InstitutionUserDoc {
  _id: Types.ObjectId;
  name: string;
  email: string;
  passwordHash: string;
  institution: Institution;
  isActive: boolean;
  // AGL users: also receive the automatic approval email at this address.
  notifyByEmail: boolean;
  // A supervisor can read the oversight log of their OWN institution's staff (and nothing else extra).
  // Set by a platform admin; never by the person themselves.
  isSupervisor?: boolean;
  lastLoginAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<InstitutionUserDoc>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    institution: { type: String, enum: ['customs', 'agl'], required: true },
    isActive: { type: Boolean, default: true },
    notifyByEmail: { type: Boolean, default: true },
    isSupervisor: { type: Boolean, default: false },
    lastLoginAt: Date,
  },
  { timestamps: true }
);

export const InstitutionUserModel = model<InstitutionUserDoc>('InstitutionUser', schema);
