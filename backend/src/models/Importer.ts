import { Schema, model, Types } from 'mongoose';

export interface ImporterDoc {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
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
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

importerSchema.index({ agencyId: 1, name: 1 });

export const ImporterModel = model<ImporterDoc>('Importer', importerSchema);
