import { Schema, model, Types } from 'mongoose';

export type SubmissionStatus = 'pending' | 'approved' | 'returned';
export type SubmissionSource = 'agent' | 'customs_assisted';

export interface HistoryEntry {
  at: Date;
  actorType: 'agent' | 'customs' | 'system';
  actorName: string;
  action: 'submitted' | 'resubmitted' | 'approved' | 'returned' | 'email_sent' | 'email_failed' | 'email_not_configured';
  note?: string;
}

export interface CustomsSubmissionDoc {
  _id: Types.ObjectId;
  // The six agreed fields, and nothing else about the transaction.
  cvcNumber: string;
  billOfLadingNumber: string;
  shippingAgency: string;
  containerNumber: string;
  documentName: string;
  itsNumber: string;

  source: SubmissionSource;
  // Agent submissions belong to the clearing agent's agency and user.
  agencyId?: Types.ObjectId;
  submittedByUserId?: Types.ObjectId;
  submittedByName: string;
  // Customs-assisted records: who the agent is (free text), since they may have no account.
  onBehalfOf?: string;
  // Entered by the Customs officer who keyed in an assisted record.
  enteredByInstitutionUserId?: Types.ObjectId;

  status: SubmissionStatus;
  submittedAt: Date; // when it last entered the queue (changes on resubmission)
  submissionCount: number;

  reviewedByInstitutionUserId?: Types.ObjectId;
  reviewedByName?: string;
  reviewedAt?: Date;
  approvalReference?: string;
  returnReason?: string;

  // Set to the CVC number while the record is pending or approved, and
  // removed when it is returned. A unique index on it means two live records
  // can never carry the same CVC number, even if two submissions race.
  activeCvc?: string;

  email: {
    status: 'none' | 'sent' | 'failed' | 'not_configured';
    attemptedAt?: Date;
    to?: string[];
    error?: string;
  };

  history: HistoryEntry[];
  createdAt: Date;
  updatedAt: Date;
}

const schema = new Schema<CustomsSubmissionDoc>(
  {
    cvcNumber: { type: String, required: true, trim: true },
    billOfLadingNumber: { type: String, required: true, trim: true },
    shippingAgency: { type: String, required: true, trim: true },
    containerNumber: { type: String, required: true, trim: true },
    documentName: { type: String, required: true, trim: true },
    itsNumber: { type: String, required: true, trim: true },

    source: { type: String, enum: ['agent', 'customs_assisted'], required: true },
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', index: true },
    submittedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    submittedByName: { type: String, required: true },
    onBehalfOf: { type: String, trim: true },
    enteredByInstitutionUserId: { type: Schema.Types.ObjectId, ref: 'InstitutionUser' },

    status: { type: String, enum: ['pending', 'approved', 'returned'], default: 'pending', index: true },
    submittedAt: { type: Date, default: Date.now },
    submissionCount: { type: Number, default: 1 },

    reviewedByInstitutionUserId: { type: Schema.Types.ObjectId, ref: 'InstitutionUser' },
    reviewedByName: String,
    reviewedAt: Date,
    approvalReference: { type: String, index: true },
    returnReason: String,

    activeCvc: { type: String },

    email: {
      status: { type: String, enum: ['none', 'sent', 'failed', 'not_configured'], default: 'none' },
      attemptedAt: Date,
      to: [String],
      error: String,
    },

    history: [
      {
        _id: false,
        at: { type: Date, default: Date.now },
        actorType: { type: String, enum: ['agent', 'customs', 'system'], required: true },
        actorName: { type: String, required: true },
        action: { type: String, required: true },
        note: String,
      },
    ],
  },
  { timestamps: true }
);

schema.index({ activeCvc: 1 }, { unique: true, sparse: true });
schema.index({ status: 1, submittedAt: -1 });
schema.index({ containerNumber: 1 });

export const CustomsSubmissionModel = model<CustomsSubmissionDoc>('CustomsSubmission', schema);
