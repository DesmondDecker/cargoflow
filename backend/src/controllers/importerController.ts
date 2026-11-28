import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { ImporterModel } from '../models/Importer';
import { ContainerModel } from '../models/Container';
import { BillOfLadingModel } from '../models/BillOfLading';
import { CargoDocumentModel } from '../models/CargoDocument';
import { TERMINAL_STATUSES } from '../constants/containerPipeline';
import { createPresignedDownloadUrl, createPresignedUploadUrl, deleteStoredFile } from '../services/storageService';

interface ImporterLike {
  _id: unknown;
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  addressLine2?: string;
  city?: string;
  country?: string;
  tin?: string;
  idCardFrontKey?: string;
  idCardBackKey?: string;
  isActive: boolean;
}

// The ID card storage keys are never sent to the app, only whether a photo
// exists. Viewing one goes through the owner/admin-only link endpoint below.
function importerShape(i: ImporterLike) {
  return {
    _id: String(i._id),
    name: i.name,
    contactPerson: i.contactPerson,
    phone: i.phone,
    email: i.email,
    address: i.address,
    addressLine2: i.addressLine2,
    city: i.city,
    country: i.country,
    tin: i.tin,
    hasIdCardFront: !!i.idCardFrontKey,
    hasIdCardBack: !!i.idCardBackKey,
    isActive: i.isActive,
  };
}

const WITH_ID_KEYS = '+idCardFrontKey +idCardBackKey';

const HISTORICAL_STATUSES: readonly string[] = TERMINAL_STATUSES;

export const fetchImporters = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
  const limit = 20;
  const filter: Record<string, unknown> = { agencyId: req.auth!.agencyId };
  if (req.query.search) filter.name = new RegExp((req.query.search as string).trim(), 'i');

  const [importers, total] = await Promise.all([
    ImporterModel.find(filter).select(WITH_ID_KEYS).sort({ name: 1 }).skip((page - 1) * limit).limit(limit).lean(),
    ImporterModel.countDocuments(filter),
  ]);

  return ok(res, { importers: importers.map(importerShape), pagination: { total, pages: Math.ceil(total / limit) || 1, page } });
});

export const fetchImporterProfile = asyncHandler(async (req: Request, res: Response) => {
  const importer = await ImporterModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId }).select(WITH_ID_KEYS);
  if (!importer) throw AppError.notFound('Importer not found');

  const containers = await ContainerModel.find({ agencyId: req.auth!.agencyId, importerId: importer._id });
  const activeContainers = containers.filter((c) => !HISTORICAL_STATUSES.includes(c.status)).length;
  const historicalContainers = containers.filter((c) => HISTORICAL_STATUSES.includes(c.status)).length;
  const attentionContainers = containers.filter((c) => c.attentionLevel !== 'normal');

  const [billsOfLading, documents] = await Promise.all([
    BillOfLadingModel.countDocuments({ agencyId: req.auth!.agencyId, importerId: importer._id }),
    CargoDocumentModel.countDocuments({ agencyId: req.auth!.agencyId, importerId: importer._id, deletedAt: null }),
  ]);

  const upcomingDeadlines = containers
    .flatMap((c) => c.deadlines.filter((d) => d.status === 'pending').map((d) => ({ containerNumber: c.containerNumber, ruleName: d.ruleName, dueDate: d.dueDate })))
    .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    .slice(0, 10);

  return ok(res, {
    importer: importerShape(importer),
    summary: {
      activeContainers,
      historicalContainers,
      billsOfLading,
      documents,
      containersRequiringAttention: attentionContainers.length,
    },
    attentionContainers: attentionContainers.map((c) => ({
      _id: String(c._id),
      containerNumber: c.containerNumber,
      status: c.status,
      attentionLevel: c.attentionLevel,
      attentionReasons: c.attentionReasons,
    })),
    upcomingDeadlines,
  });
});

const importerFields = {
  contactPerson: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(40).optional(),
  email: z.union([z.string().trim().email(), z.literal('')]).optional(),
  address: z.string().trim().max(200).optional(),
  addressLine2: z.string().trim().max(200).optional(),
  city: z.string().trim().max(100).optional(),
  country: z.string().trim().max(100).optional(),
  tin: z.string().trim().max(60).optional(),
};

const createImporterSchema = z.object({ name: z.string().trim().min(1).max(200), ...importerFields });
const updateImporterSchema = z.object({ name: z.string().trim().min(1).max(200).optional(), ...importerFields });

export const createImporter = asyncHandler(async (req: Request, res: Response) => {
  const input = createImporterSchema.parse(req.body);
  const importer = await ImporterModel.create({ agencyId: req.auth!.agencyId, ...Object.fromEntries(Object.entries(input).filter(([, v]) => v !== '' && v !== undefined)) });
  return ok(res, { importer: importerShape(importer) }, 201);
});


// Editing a client. A field sent as an empty string is cleared.
export const updateImporter = asyncHandler(async (req: Request, res: Response) => {
  const input = updateImporterSchema.parse(req.body);
  const set: Record<string, string> = {};
  const unset: Record<string, ''> = {};
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue;
    if (value === '' && key !== 'name') unset[key] = '';
    else set[key] = value;
  }
  const update: Record<string, unknown> = {};
  if (Object.keys(set).length) update.$set = set;
  if (Object.keys(unset).length) update.$unset = unset;
  if (Object.keys(update).length === 0) throw AppError.badRequest('Nothing to update');

  const importer = await ImporterModel.findOneAndUpdate({ _id: req.params.id, agencyId: req.auth!.agencyId }, update, { new: true }).select(WITH_ID_KEYS);
  if (!importer) throw AppError.notFound('Importer not found');
  return ok(res, { importer: importerShape(importer) });
});

// ---- ID card photos --------------------------------------------------------
// Personal identity documents. They are uploaded straight to private storage
// on a short-lived link, only the storage key is saved, and the only way to
// look at one is a link that expires in five minutes, handed to an owner or
// admin. Staff can add a photo while onboarding a client but cannot read one
// back.

const sideSchema = z.enum(['front', 'back']);
const ID_CONTENT_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const;

function idOwner(req: Request): string {
  return `${req.auth!.agencyId}-${req.params.id}`;
}

export const createIdCardUploadUrl = asyncHandler(async (req: Request, res: Response) => {
  const { contentType, fileSizeBytes } = z.object({
    side: sideSchema,
    contentType: z.enum(ID_CONTENT_TYPES),
    fileSizeBytes: z.number().int().positive().max(10 * 1024 * 1024).optional(),
  }).parse(req.body);
  const importer = await ImporterModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!importer) throw AppError.notFound('Importer not found');
  const { uploadUrl, fileKey, expiresIn } = await createPresignedUploadUrl('client_id_card', contentType, idOwner(req), fileSizeBytes);
  return ok(res, { uploadUrl, fileKey, expiresIn });
});

export const saveIdCard = asyncHandler(async (req: Request, res: Response) => {
  const { side, fileKey } = z.object({ side: sideSchema, fileKey: z.string().min(1) }).parse(req.body);
  // Only keys this endpoint's own upload link produced for THIS client.
  if (!fileKey.startsWith(`client_id_card/${idOwner(req)}/`)) throw AppError.badRequest('That file does not belong to this client', 'INVALID_FILE_KEY');

  const field = side === 'front' ? 'idCardFrontKey' : 'idCardBackKey';
  const existing = await ImporterModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId }).select(`+${field}`);
  if (!existing) throw AppError.notFound('Importer not found');
  const previousKey = existing.get(field) as string | undefined;

  existing.set(field, fileKey);
  await existing.save();
  if (previousKey && previousKey !== fileKey) await deleteStoredFile(previousKey).catch(() => undefined); // replaced photo is removed, not orphaned

  const importer = await ImporterModel.findById(existing._id).select(WITH_ID_KEYS);
  return ok(res, { importer: importerShape(importer!) });
});

export const getIdCardLink = asyncHandler(async (req: Request, res: Response) => {
  const side = sideSchema.parse(req.params.side);
  const field = side === 'front' ? 'idCardFrontKey' : 'idCardBackKey';
  const importer = await ImporterModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId }).select(`+${field}`);
  if (!importer) throw AppError.notFound('Importer not found');
  const key = importer.get(field) as string | undefined;
  if (!key) throw AppError.notFound('No ID card photo on file', 'NO_ID_CARD');
  const expiresIn = 300;
  return ok(res, { url: await createPresignedDownloadUrl(key, expiresIn), expiresIn });
});

export const removeIdCard = asyncHandler(async (req: Request, res: Response) => {
  const side = sideSchema.parse(req.params.side);
  const field = side === 'front' ? 'idCardFrontKey' : 'idCardBackKey';
  const importer = await ImporterModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId }).select(`+${field}`);
  if (!importer) throw AppError.notFound('Importer not found');
  const key = importer.get(field) as string | undefined;
  if (!key) throw AppError.notFound('No ID card photo on file', 'NO_ID_CARD');
  await deleteStoredFile(key);
  importer.set(field, undefined);
  await importer.save();
  return ok(res, { message: 'ID card photo removed' });
});
