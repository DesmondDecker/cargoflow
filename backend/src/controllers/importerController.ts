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

function importerShape(i: { _id: unknown; name: string; contactPerson?: string; phone?: string; email?: string; address?: string; isActive: boolean }) {
  return { _id: String(i._id), name: i.name, contactPerson: i.contactPerson, phone: i.phone, email: i.email, address: i.address, isActive: i.isActive };
}

const HISTORICAL_STATUSES: readonly string[] = TERMINAL_STATUSES;

export const fetchImporters = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
  const limit = 20;
  const filter: Record<string, unknown> = { agencyId: req.auth!.agencyId };
  if (req.query.search) filter.name = new RegExp((req.query.search as string).trim(), 'i');

  const [importers, total] = await Promise.all([
    ImporterModel.find(filter).sort({ name: 1 }).skip((page - 1) * limit).limit(limit),
    ImporterModel.countDocuments(filter),
  ]);

  return ok(res, { importers: importers.map(importerShape), pagination: { total, pages: Math.ceil(total / limit) || 1, page } });
});

export const fetchImporterProfile = asyncHandler(async (req: Request, res: Response) => {
  const importer = await ImporterModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
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

const createImporterSchema = z.object({
  name: z.string().trim().min(1),
  contactPerson: z.string().trim().optional(),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  address: z.string().trim().optional(),
});

export const createImporter = asyncHandler(async (req: Request, res: Response) => {
  const input = createImporterSchema.parse(req.body);
  const importer = await ImporterModel.create({ agencyId: req.auth!.agencyId, ...input });
  return ok(res, { importer: importerShape(importer) }, 201);
});
