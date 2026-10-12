import { Schema, model, Types } from 'mongoose';

// Fills a real gap, and only that gap: when guessShippingLine() has no
// global BIC-table entry for a prefix, but THIS agency has manually
// corrected containers with that same prefix before, that history is a
// better answer than "unrecognized." It deliberately never overrides a
// prefix the global table already resolves — a single agency's correction
// shouldn't outvote a properly sourced global mapping, and confidence only
// reaches 'high' once the same correction has repeated (see
// AGENCY_HISTORY_HIGH_CONFIDENCE_THRESHOLD in carrierDetection.ts), so one
// fat-fingered entry can't poison future guesses on its own.
export interface AgencyCarrierPrefixOverrideDoc {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  prefix: string; // 4-letter BIC owner-code prefix, e.g. "ABCU"
  shippingLine: string;
  correctionCount: number;
  lastCorrectedAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<AgencyCarrierPrefixOverrideDoc>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true },
    prefix: { type: String, required: true, uppercase: true, trim: true },
    shippingLine: { type: String, required: true, trim: true },
    correctionCount: { type: Number, default: 1 },
    lastCorrectedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

schema.index({ agencyId: 1, prefix: 1 }, { unique: true });

export const AgencyCarrierPrefixOverrideModel = model<AgencyCarrierPrefixOverrideDoc>(
  'AgencyCarrierPrefixOverride',
  schema
);
