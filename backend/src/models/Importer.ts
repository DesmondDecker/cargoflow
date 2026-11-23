import { Schema, model, Types } from 'mongoose';

export interface ImporterDoc {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string; // address line 1
  addressLine2?: string;
  city?: string;
  country?: string;
  tin?: string; // taxpayer identification number
  // Storage keys of the client's ID card photos. Deliberately NOT public
  // URLs: the photos are only reachable through a short-lived signed link
  // handed to an owner or admin (see importerController).
  idCardFrontKey?: string;
  idCardBackKey?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const importerSchema = new Schema<ImporterDoc>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
    name: { type: String, required: true, trim: true },
    contactPerson: { type: String, trim: true },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    address: { type: String, trim: true },
    addressLine2: { type: String, trim: true },
    city: { type: String, trim: true },
    country: { type: String, trim: true },
    tin: { type: String, trim: true },
    idCardFrontKey: { type: String, select: false },
    idCardBackKey: { type: String, select: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

importerSchema.index({ agencyId: 1, name: 1 });

export const ImporterModel = model<ImporterDoc>('Importer', importerSchema);
