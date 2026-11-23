import { Schema, model, Types } from 'mongoose';

// The supervisors' oversight record for Customs and AGL staff: who signed in,
// who looked at which record, who approved or returned what, who exported data,
// and who tried something they were not allowed to. It is written by the server
// for every request an institution user makes (not by the portal), and it is
// append-only: the model refuses updates and deletes, and no route offers them.
export type InstitutionAuditOutcome = 'ok' | 'denied' | 'failed';

export interface InstitutionAuditLogDoc {
  _id: Types.ObjectId;
  institutionUserId?: Types.ObjectId; // missing for a failed sign-in with an unknown email
  userName: string;
  email?: string;
  institution?: 'customs' | 'agl';
  action: string; // e.g. record.approve, approved.export_csv, auth.login
  outcome: InstitutionAuditOutcome;
  statusCode?: number;
  method?: string;
  path?: string;
  targetId?: string; // the submission this was about
  targetLabel?: string; // container + CVC, so a supervisor can read it without opening it
  detail?: string; // return reason, approval reference, ...
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

const schema = new Schema<InstitutionAuditLogDoc>(
  {
    institutionUserId: { type: Schema.Types.ObjectId, ref: 'InstitutionUser', index: true },
    userName: { type: String, required: true },
    email: String,
    institution: { type: String, enum: ['customs', 'agl'], index: true },
    action: { type: String, required: true, index: true },
    outcome: { type: String, enum: ['ok', 'denied', 'failed'], required: true, index: true },
    statusCode: Number,
    method: String,
    path: String,
    targetId: { type: String, index: true },
    targetLabel: String,
    detail: String,
    ip: String,
    userAgent: String,
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);
schema.index({ institution: 1, createdAt: -1 });

const blocked = () => {
  throw new Error('The institution audit log is append-only');
};
for (const op of ['updateOne', 'updateMany', 'findOneAndUpdate', 'findOneAndReplace', 'replaceOne', 'deleteOne', 'deleteMany', 'findOneAndDelete'] as const) {
  schema.pre(op, blocked);
}
schema.pre('save', function (this: { isNew: boolean }) {
  if (!this.isNew) blocked();
});

export const InstitutionAuditLogModel = model<InstitutionAuditLogDoc>('InstitutionAuditLog', schema);
