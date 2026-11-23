import { Schema, model, Types } from 'mongoose';
import { DocumentType, DOCUMENT_TYPE_KEYS } from '../constants/containerPipeline';

export type { DocumentType };

export interface DocumentVersionEntry {
  versionNumber: number;
  fileKey: string;
  fileUrl: string;
  mimeType: string;
  fileSizeBytes?: number;
  pageCount?: number;
  uploadedBy: Types.ObjectId;
  uploadedAt: Date;
}

export interface CargoDocumentDoc {
  _id: Types.ObjectId;
  agencyId: Types.ObjectId;
  documentType: DocumentType;
  importerId: Types.ObjectId;
  blId?: Types.ObjectId;
  containerId?: Types.ObjectId;
  versions: DocumentVersionEntry[];
  currentVersion: number;
  // Has someone at the agency checked this against the paperwork? A document
  // starts as pending_review and a person marks it verified (recorded with who
  // and when). Uploading a new version puts it back to pending_review, because
  // the file that was checked is no longer the current one.
  reviewStatus: 'pending_review' | 'verified';
  reviewedAt?: Date;
  reviewedByName?: string;
  reviewedByUserId?: Types.ObjectId;
  deletedAt?: Date | null; // soft-delete only
  createdAt: Date;
  updatedAt: Date;
}

const cargoDocumentSchema = new Schema<CargoDocumentDoc>(
  {
    agencyId: { type: Schema.Types.ObjectId, ref: 'Agency', required: true, index: true },
    documentType: { type: String, enum: DOCUMENT_TYPE_KEYS, required: true },
    importerId: { type: Schema.Types.ObjectId, ref: 'Importer', required: true, index: true },
    blId: { type: Schema.Types.ObjectId, ref: 'BillOfLading' },
    containerId: { type: Schema.Types.ObjectId, ref: 'Container', index: true },
    versions: [
      {
        versionNumber: { type: Number, required: true },
        fileKey: { type: String, required: true },
        fileUrl: { type: String, required: true },
        mimeType: { type: String, required: true },
        fileSizeBytes: Number,
        pageCount: Number,
        uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    currentVersion: { type: Number, default: 1 },
    reviewStatus: { type: String, enum: ['pending_review', 'verified'], default: 'pending_review' },
    reviewedAt: Date,
    reviewedByName: String,
    reviewedByUserId: { type: Schema.Types.ObjectId, ref: 'User' },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

cargoDocumentSchema.index({ agencyId: 1, containerId: 1, documentType: 1 });

export const CargoDocumentModel = model<CargoDocumentDoc>('CargoDocument', cargoDocumentSchema);
