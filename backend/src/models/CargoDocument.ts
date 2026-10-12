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
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

cargoDocumentSchema.index({ agencyId: 1, containerId: 1, documentType: 1 });

export const CargoDocumentModel = model<CargoDocumentDoc>('CargoDocument', cargoDocumentSchema);
