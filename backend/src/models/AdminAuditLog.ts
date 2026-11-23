import { Schema, model, Types } from 'mongoose';

// A record of every change a platform admin makes (verifying a driver,
// switching an agency's plan, creating a Customs account, ...). Written
// automatically for every successful non-GET request to /platform-admin, so a
// new admin action is covered without anyone remembering to log it.
export interface AdminAuditLogDoc {
  _id: Types.ObjectId;
  adminId: Types.ObjectId;
  adminName: string;
  method: string;
  route: string; // the route pattern, e.g. /platform-admin/drivers/:id/verification
  path: string; // the actual path, with real ids
  summary: Record<string, unknown>; // the request body with secrets removed
  statusCode: number;
  createdAt: Date;
}

const schema = new Schema<AdminAuditLogDoc>(
  {
    adminId: { type: Schema.Types.ObjectId, ref: 'PlatformAdmin', required: true, index: true },
    adminName: { type: String, required: true },
    method: { type: String, required: true },
    route: { type: String, required: true },
    path: { type: String, required: true },
    summary: { type: Schema.Types.Mixed, default: {} },
    statusCode: { type: Number, required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
schema.index({ createdAt: -1 });

export const AdminAuditLogModel = model<AdminAuditLogDoc>('AdminAuditLog', schema);
