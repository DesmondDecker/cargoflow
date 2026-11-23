import { Schema, model, Types } from 'mongoose';

// A letter is its template plus the values typed into it. The .docx is never
// stored: it is rebuilt from `fields` every time it is downloaded, so an edit
// can never leave a stale file behind and the layout can never be broken by
// editing. `revisions` is the edit history (who changed it and the values
// they saved), capped to the most recent saves.
export interface LetterRevision {
  fields: Record<string, string>;
  editedByName: string;
  editedByUserId?: Types.ObjectId;
  editedAt: Date;
}

export interface LetterDoc {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  containerId: Types.ObjectId;
  templateKey: string;
  fields: Record<string, string>;
  revisions: LetterRevision[];
  createdByName: string;
  createdByUserId?: Types.ObjectId;
  lastDownloadedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export const MAX_REVISIONS = 30;

const letterSchema = new Schema<LetterDoc>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
    containerId: { type: Schema.Types.ObjectId, ref: 'Container', required: true, index: true },
    templateKey: { type: String, required: true },
    fields: { type: Schema.Types.Mixed, default: {} },
    revisions: [
      {
        _id: false,
        fields: { type: Schema.Types.Mixed, default: {} },
        editedByName: { type: String, required: true },
        editedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
        editedAt: { type: Date, default: Date.now },
      },
    ],
    createdByName: { type: String, required: true },
    createdByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    lastDownloadedAt: Date,
  },
  { timestamps: true, minimize: false }
);

export const LetterModel = model<LetterDoc>('Letter', letterSchema);
