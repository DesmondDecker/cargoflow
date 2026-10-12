import { Schema, model, Types } from 'mongoose';

// One row per (agency, calendar day) — GET /reports/daily-digest returns the
// most recent row instead of recomputing on every read; POST .../run
// recomputes and upserts today's row on demand.
export interface DailyDigestDoc {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  dateKey: string; // YYYY-MM-DD
  generatedAt: Date;
  payload: Record<string, unknown>; // the DailyDigest shape the mobile app expects, stored as-is
}

const dailyDigestSchema = new Schema<DailyDigestDoc>({
  agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
  dateKey: { type: String, required: true },
  generatedAt: { type: Date, default: Date.now },
  payload: { type: Schema.Types.Mixed, required: true },
});

dailyDigestSchema.index({ agencyId: 1, dateKey: 1 }, { unique: true });

export const DailyDigestModel = model<DailyDigestDoc>('DailyDigest', dailyDigestSchema);
