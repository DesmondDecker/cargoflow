import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { CargoDocumentModel } from '../models/CargoDocument';
import { UserModel } from '../models/User';
import { ActivityLogModel } from '../models/ActivityLog';
import { createPresignedUploadUrl } from '../services/storageService';
import { recomputeDerivedFields } from './containerController';
import { DOCUMENT_TYPE_KEYS } from '../constants/containerPipeline';

function documentShape(d: {
  _id: unknown;
  documentType: string;
  importerId: unknown;
  blId?: unknown;
  containerId?: unknown;
  versions: { versionNumber: number; fileKey: string; fileUrl: string; mimeType: string; uploadedAt: Date }[];
  currentVersion: number;
  reviewStatus?: string;
  reviewedAt?: Date;
  reviewedByName?: string;
  createdAt: Date;
}) {
  return {
    _id: String(d._id),
    documentType: d.documentType,
    importerId: d.importerId,
    blId: d.blId,
    containerId: d.containerId,
    versions: d.versions.map((v) => ({ versionNumber: v.versionNumber, fileKey: v.fileKey, fileUrl: v.fileUrl, mimeType: v.mimeType, uploadedAt: v.uploadedAt, downloadUrl: v.fileUrl })),
    currentVersion: d.currentVersion,
    reviewStatus: d.reviewStatus ?? 'pending_review',
    reviewedAt: d.reviewedAt,
    reviewedByName: d.reviewedByName,
    createdAt: d.createdAt,
  };
}

export const fetchDocuments = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { agencyId: req.auth!.agencyId, deletedAt: null };
  if (req.query.containerId) filter.containerId = req.query.containerId;
  if (req.query.importerId) filter.importerId = req.query.importerId;
  if (req.query.documentType) filter.documentType = req.query.documentType;

  const documents = await CargoDocumentModel.find(filter).sort({ createdAt: -1 }).lean();
  return ok(res, { documents: documents.map(documentShape) });
});

export const fetchDocument = asyncHandler(async (req: Request, res: Response) => {
  const document = await CargoDocumentModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId, deletedAt: null }).lean();
  if (!document) throw AppError.notFound('Document not found');
  return ok(res, { document: documentShape(document) });
});

const uploadUrlSchema = z.object({
  fileName: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1),
  fileSizeBytes: z.number().int().positive().max(10 * 1024 * 1024).optional(),
  containerId: z.string().optional(),
});

export const requestUploadUrl = asyncHandler(async (req: Request, res: Response) => {
  const input = uploadUrlSchema.parse(req.body);
  const presigned = await createPresignedUploadUrl('cargo_document', input.contentType, req.auth!.agencyId!, input.fileSizeBytes);
  return ok(res, { uploadUrl: presigned.uploadUrl, fileKey: presigned.fileKey });
});

const registerDocumentSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPE_KEYS),
  importerId: z.string().min(1),
  blId: z.string().optional(),
  containerId: z.string().optional(),
  fileKey: z.string().min(1),
  mimeType: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif', 'application/pdf']),
  fileSizeBytes: z.number().int().positive().max(10 * 1024 * 1024).optional(),
  pageCount: z.number().optional(),
});

// A document is registered here AFTER the client has already PUT the bytes
// straight to R2 using the presigned URL from requestUploadUrl — this call
// only records the metadata + builds the public fileUrl. Re-registering the
// same (agency, container, documentType) adds a new version rather than a
// duplicate row, matching the mobile client's DocumentVersion[] model.
export const registerDocument = asyncHandler(async (req: Request, res: Response) => {
  const input = registerDocumentSchema.parse(req.body);
  const expectedKeyPrefix = `cargo_document/${req.auth!.agencyId}/`;
  if (!input.fileKey.startsWith(expectedKeyPrefix)) {
    throw AppError.badRequest('The document file does not belong to this agency.', 'INVALID_FILE_KEY');
  }
  const fileUrl = `${process.env.R2_PUBLIC_BASE_URL || ''}/${input.fileKey}`.replace(/^\//, '');

  let document = input.containerId
    ? await CargoDocumentModel.findOne({ agencyId: req.auth!.agencyId, containerId: input.containerId, documentType: input.documentType, deletedAt: null })
    : null;

  const versionEntry = {
    versionNumber: (document?.versions.length || 0) + 1,
    fileKey: input.fileKey,
    fileUrl,
    mimeType: input.mimeType,
    fileSizeBytes: input.fileSizeBytes,
    pageCount: input.pageCount,
    uploadedBy: req.auth!.userId,
    uploadedAt: new Date(),
  };

  if (document) {
    document.versions.push(versionEntry as unknown as (typeof document.versions)[number]);
    document.currentVersion = versionEntry.versionNumber;
    // The checked file is no longer the current one.
    document.reviewStatus = 'pending_review';
    document.reviewedAt = undefined;
    document.reviewedByName = undefined;
    document.reviewedByUserId = undefined;
    await document.save();
  } else {
    document = await CargoDocumentModel.create({
      agencyId: req.auth!.agencyId,
      documentType: input.documentType,
      importerId: input.importerId,
      blId: input.blId,
      containerId: input.containerId,
      versions: [versionEntry],
      currentVersion: 1,
    });
  }

  if (input.containerId) {
    await ActivityLogModel.create({
      agencyId: req.auth!.agencyId,
      containerId: input.containerId,
      actorName: 'User',
      actorUserId: req.auth!.userId,
      action: 'document_uploaded',
      details: { documentType: input.documentType },
    });
    await recomputeDerivedFields(input.containerId);
  }

  return ok(res, { document: documentShape(document) }, 201);
});

export const deleteDocument = asyncHandler(async (req: Request, res: Response) => {
  const document = await CargoDocumentModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!document) throw AppError.notFound('Document not found');

  // Soft delete only, per project policy — cleared/uploaded documents are
  // evidence of what an agency actually submitted and must stay recoverable.
  document.deletedAt = new Date();
  await document.save();

  if (document.containerId) {
    await ActivityLogModel.create({
      agencyId: req.auth!.agencyId,
      containerId: document.containerId,
      actorName: 'User',
      actorUserId: req.auth!.userId,
      action: 'document_deleted',
      details: { documentType: document.documentType },
    });
    await recomputeDerivedFields(String(document.containerId));
  }

  return res.status(204).send();
});


const reviewSchema = z.object({ status: z.enum(['verified', 'pending_review']) });

// Mark a document as checked (or send it back to "needs review"). Anyone on
// the team can do it; who did it and when is kept, and shown.
export const reviewDocument = asyncHandler(async (req: Request, res: Response) => {
  const { status } = reviewSchema.parse(req.body);
  const document = await CargoDocumentModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId, deletedAt: null });
  if (!document) throw AppError.notFound('Document not found');
  const user = await UserModel.findById(req.auth!.userId);

  document.reviewStatus = status;
  document.reviewedAt = status === 'verified' ? new Date() : undefined;
  document.reviewedByName = status === 'verified' ? user?.name || 'User' : undefined;
  document.reviewedByUserId = status === 'verified' ? (req.auth!.userId as never) : undefined;
  await document.save();

  if (document.containerId) {
    await ActivityLogModel.create({
      agencyId: req.auth!.agencyId,
      containerId: document.containerId,
      actorName: user?.name || 'User',
      actorUserId: req.auth!.userId,
      action: status === 'verified' ? 'document_verified' : 'document_review_requested',
      details: { documentType: document.documentType },
    });
  }
  return ok(res, { document: documentShape(document) });
});
