import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { CargoDocumentModel } from '../models/CargoDocument';
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
    createdAt: d.createdAt,
  };
}

export const fetchDocuments = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { agencyId: req.auth!.agencyId, deletedAt: null };
  if (req.query.containerId) filter.containerId = req.query.containerId;
  if (req.query.importerId) filter.importerId = req.query.importerId;
  if (req.query.documentType) filter.documentType = req.query.documentType;

  const documents = await CargoDocumentModel.find(filter).sort({ createdAt: -1 });
  return ok(res, { documents: documents.map(documentShape) });
});

export const fetchDocument = asyncHandler(async (req: Request, res: Response) => {
  const document = await CargoDocumentModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId, deletedAt: null });
  if (!document) throw AppError.notFound('Document not found');
  return ok(res, { document: documentShape(document) });
});

const uploadUrlSchema = z.object({ fileName: z.string().min(1), contentType: z.string().min(1), containerId: z.string().optional() });

export const requestUploadUrl = asyncHandler(async (req: Request, res: Response) => {
  const input = uploadUrlSchema.parse(req.body);
  const presigned = await createPresignedUploadUrl('cargo_document', input.contentType, req.auth!.agencyId!);
  return ok(res, { uploadUrl: presigned.uploadUrl, fileKey: presigned.fileKey });
});

const registerDocumentSchema = z.object({
  documentType: z.enum(DOCUMENT_TYPE_KEYS),
  importerId: z.string().min(1),
  blId: z.string().optional(),
  containerId: z.string().optional(),
  fileKey: z.string().min(1),
  mimeType: z.string().min(1),
  fileSizeBytes: z.number().optional(),
  pageCount: z.number().optional(),
});

// A document is registered here AFTER the client has already PUT the bytes
// straight to R2 using the presigned URL from requestUploadUrl — this call
// only records the metadata + builds the public fileUrl. Re-registering the
// same (agency, container, documentType) adds a new version rather than a
// duplicate row, matching the mobile client's DocumentVersion[] model.
export const registerDocument = asyncHandler(async (req: Request, res: Response) => {
  const input = registerDocumentSchema.parse(req.body);
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
