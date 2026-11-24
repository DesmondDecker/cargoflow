import { Schema, model, Types } from 'mongoose';

export interface SavedTrackingDoc {
  agencyId: Types.ObjectId;
  containerNumber: string;
  trackingType?: 'container' | 'bill_of_lading';
  tracking: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

const savedTrackingSchema = new Schema<SavedTrackingDoc>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
    containerNumber: { type: String, required: true, trim: true, uppercase: true },
    trackingType: { type: String, enum: ['container', 'bill_of_lading'], default: 'container' },
    tracking: { type: Schema.Types.Mixed, required: true },
  },
  { timestamps: true }
);

savedTrackingSchema.index({ agencyId: 1, containerNumber: 1 }, { unique: true });

export const SavedTrackingModel = model<SavedTrackingDoc>('SavedTracking', savedTrackingSchema);
