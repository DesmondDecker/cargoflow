import { Schema, model, Types } from 'mongoose';

export interface ActivityLogDoc {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  containerId?: Types.ObjectId;
  actorName: string; // denormalized — this IS the "shows up in every activity log" name
  actorUserId?: Types.ObjectId;
  action: string; // e.g. 'status_changed', 'document_uploaded', 'container_created'
  description: string; // human-readable line for the container's timeline
  details?: Record<string, unknown>;
  createdAt: Date;
}

const activityLogSchema = new Schema<ActivityLogDoc>({
  agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
  containerId: { type: Schema.Types.ObjectId, ref: 'Container', index: true },
  actorName: { type: String, required: true },
  actorUserId: { type: Schema.Types.ObjectId, ref: 'User' },
  action: { type: String, required: true },
  description: { type: String, required: true },
  details: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now },
});

activityLogSchema.index({ agencyId: 1, createdAt: -1 });

export const ActivityLogModel = model<ActivityLogDoc>('ActivityLog', activityLogSchema);
