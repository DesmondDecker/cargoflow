import { Schema, model, Types } from 'mongoose';

// Deliberately dates only — no dollar amounts anywhere in this model. The
// per-day demurrage RATE (what Bolloré/the terminal and each carrier
// actually charge) isn't something this system can source or verify, so
// it's out of scope on purpose (see deadlineEngine.ts). What an agency
// *can* know and enter themselves, from their own paperwork with a given
// carrier, is how many free days they get before the clock starts — this
// model exists to hold exactly that, per carrier, per agency.
export interface AgencyDemurrageTermDoc {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  shippingLine: string;
  freeStorageDays?: number;
  demurrageGraceDays?: number;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<AgencyDemurrageTermDoc>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true },
    shippingLine: { type: String, required: true, trim: true },
    freeStorageDays: { type: Number, min: 0 },
    demurrageGraceDays: { type: Number, min: 0 },
    notes: { type: String, trim: true },
  },
  { timestamps: true }
);

schema.index({ agencyId: 1, shippingLine: 1 }, { unique: true });

export const AgencyDemurrageTermModel = model<AgencyDemurrageTermDoc>('AgencyDemurrageTerm', schema);
