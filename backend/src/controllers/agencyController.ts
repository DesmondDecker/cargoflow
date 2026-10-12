import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { AgencyModel } from '../models/Agency';
import { AgencyDemurrageTermModel } from '../models/AgencyDemurrageTerm';
import { ContainerModel } from '../models/Container';
import { WarehouseModel } from '../models/Warehouse';
import { DriverModel } from '../models/Driver';
import { recomputeDerivedFields } from './containerController';
import { ALL_KNOWN_CARRIERS } from '../services/carrierDetection';
import { STATUS_KEYS, DOCUMENT_TYPE_KEYS } from '../constants/containerPipeline';

// Fixed, in this order, everywhere in the app (see constants/containerPipeline.ts
// — this is the single source of truth these two now read from). What CAN
// change per agency is the LABEL shown for each one (see AgencyDoc.statusLabels'
// comment for why the key itself can't move); the key, and everything the
// backend does when it sees that key, cannot.
const STATUS_PIPELINE: readonly string[] = STATUS_KEYS;
const DOCUMENT_TYPES: readonly string[] = DOCUMENT_TYPE_KEYS;

function withLabels(keys: readonly string[], labels?: Map<string, string>) {
  return keys.map((key) => ({ key, label: labels?.get(key) || key }));
}

export const getAgencySettings = asyncHandler(async (req: Request, res: Response) => {
  const agency = await AgencyModel.findById(req.auth!.agencyId);
  if (!agency) throw AppError.notFound('Agency not found');
  return ok(res, {
    id: String(agency._id),
    name: agency.name,
    agencyCode: agency.agencyCode,
    contactEmail: agency.contactEmail,
    contactPhone: agency.contactPhone,
    address: agency.address,
    settings: {
      statusPipeline: withLabels(STATUS_PIPELINE, agency.statusLabels),
      documentTypes: withLabels(DOCUMENT_TYPES, agency.documentTypeLabels),
    },
  });
});

const updateLabelsSchema = z.object({
  statusLabels: z.record(z.string(), z.string().trim().max(40)).optional(),
  documentTypeLabels: z.record(z.string(), z.string().trim().max(40)).optional(),
});

// Relabels a fixed status or document type for this agency's own staff —
// never adds, removes, or reorders one. Any key not in STATUS_PIPELINE /
// DOCUMENT_TYPES is rejected outright rather than silently accepted, so
// this can't be used to sneak in a status the rest of the app (driver
// dispatch, the attention engine, the daily digest) has never heard of and
// wouldn't know what to do with. An empty-string label clears the override
// and reverts that one entry to its default.
export const updateAgencyLabels = asyncHandler(async (req: Request, res: Response) => {
  const input = updateLabelsSchema.parse(req.body);

  for (const key of Object.keys(input.statusLabels ?? {})) {
    if (!STATUS_PIPELINE.includes(key)) throw AppError.badRequest(`"${key}" is not a real status — see the fixed list in getAgencySettings`);
  }
  for (const key of Object.keys(input.documentTypeLabels ?? {})) {
    if (!DOCUMENT_TYPES.includes(key)) throw AppError.badRequest(`"${key}" is not a real document type — see the fixed list in getAgencySettings`);
  }

  const agency = await AgencyModel.findById(req.auth!.agencyId);
  if (!agency) throw AppError.notFound('Agency not found');

  agency.statusLabels = agency.statusLabels || new Map();
  for (const [key, label] of Object.entries(input.statusLabels ?? {})) {
    if (label) agency.statusLabels.set(key, label); else agency.statusLabels.delete(key);
  }
  agency.documentTypeLabels = agency.documentTypeLabels || new Map();
  for (const [key, label] of Object.entries(input.documentTypeLabels ?? {})) {
    if (label) agency.documentTypeLabels.set(key, label); else agency.documentTypeLabels.delete(key);
  }
  await agency.save();

  return ok(res, {
    statusPipeline: withLabels(STATUS_PIPELINE, agency.statusLabels),
    documentTypes: withLabels(DOCUMENT_TYPES, agency.documentTypeLabels),
  });
});

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).optional(),
  contactEmail: z.string().trim().email().optional().or(z.literal('')),
  contactPhone: z.string().trim().optional(),
  address: z.string().trim().optional(),
});

// Deliberately does NOT accept agencyCode: it's the code staff use to join
// this agency (see JoinAgencyScreen in the mobile app) and is referenced
// wherever a new staff account gets linked — changing it here would silently
// break anyone mid-onboarding with the old code. If it ever needs to change,
// that's a platform-admin action with staff notified first, not a
// self-service field.
export const updateAgencyProfile = asyncHandler(async (req: Request, res: Response) => {
  const input = updateProfileSchema.parse(req.body);
  const agency = await AgencyModel.findByIdAndUpdate(
    req.auth!.agencyId,
    {
      $set: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.contactEmail !== undefined ? { contactEmail: input.contactEmail || undefined } : {}),
        ...(input.contactPhone !== undefined ? { contactPhone: input.contactPhone || undefined } : {}),
        ...(input.address !== undefined ? { address: input.address || undefined } : {}),
      },
    },
    { new: true }
  );
  if (!agency) throw AppError.notFound('Agency not found');
  return ok(res, {
    id: String(agency._id),
    name: agency.name,
    agencyCode: agency.agencyCode,
    contactEmail: agency.contactEmail,
    contactPhone: agency.contactPhone,
    address: agency.address,
  });
});

// Powers the carrier picker on Grace Periods "Add" — the global table's
// names, plus any shipping line this agency's own containers actually carry
// (from real BL entries, manual corrections, or agency-history guesses)
// that isn't already in the global table. That second part matters: an
// agency's actual carrier might be an NVOCC or regional line the global
// table has never heard of, and it should still show up here rather than
// forcing free-typing for exactly the agencies most likely to need it.
export const listKnownCarriers = asyncHandler(async (req: Request, res: Response) => {
  const agencyOwn = await ContainerModel.distinct('shippingLine', { agencyId: req.auth!.agencyId, shippingLine: { $ne: null } });
  const carriers = [...new Set([...ALL_KNOWN_CARRIERS, ...agencyOwn])].sort();
  return ok(res, { carriers });
});

// ---- per-carrier grace-period terms (deliberately no $ fields — see AgencyDemurrageTerm) ----

export const listDemurrageTerms = asyncHandler(async (req: Request, res: Response) => {
  const terms = await AgencyDemurrageTermModel.find({ agencyId: req.auth!.agencyId }).sort({ shippingLine: 1 });
  return ok(res, {
    terms: terms.map((t) => ({
      _id: String(t._id),
      shippingLine: t.shippingLine,
      freeStorageDays: t.freeStorageDays ?? null,
      demurrageGraceDays: t.demurrageGraceDays ?? null,
      notes: t.notes,
      updatedAt: t.updatedAt,
    })),
  });
});

const upsertTermSchema = z.object({
  shippingLine: z.string().trim().min(1),
  freeStorageDays: z.number().min(0).nullable().optional(),
  demurrageGraceDays: z.number().min(0).nullable().optional(),
  notes: z.string().trim().optional(),
});

// Upserting or deleting a term reruns deadlines on every open container
// currently attributed to that carrier for this agency — otherwise a staff
// member entering the real terms today wouldn't see the effect until
// something else happened to touch each container days later.
export const upsertDemurrageTerm = asyncHandler(async (req: Request, res: Response) => {
  const input = upsertTermSchema.parse(req.body);
  const term = await AgencyDemurrageTermModel.findOneAndUpdate(
    { agencyId: req.auth!.agencyId, shippingLine: input.shippingLine },
    {
      $set: {
        freeStorageDays: input.freeStorageDays ?? undefined,
        demurrageGraceDays: input.demurrageGraceDays ?? undefined,
        notes: input.notes,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  const affected = await ContainerModel.find({ agencyId: req.auth!.agencyId, shippingLine: input.shippingLine }).select('_id');
  for (const c of affected) await recomputeDerivedFields(String(c._id));

  return ok(res, {
    term: {
      _id: String(term._id),
      shippingLine: term.shippingLine,
      freeStorageDays: term.freeStorageDays ?? null,
      demurrageGraceDays: term.demurrageGraceDays ?? null,
      notes: term.notes,
      updatedAt: term.updatedAt,
    },
    containersUpdated: affected.length,
  });
});

export const deleteDemurrageTerm = asyncHandler(async (req: Request, res: Response) => {
  const term = await AgencyDemurrageTermModel.findOneAndDelete({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!term) throw AppError.notFound('Term not found');

  const affected = await ContainerModel.find({ agencyId: req.auth!.agencyId, shippingLine: term.shippingLine }).select('_id');
  for (const c of affected) await recomputeDerivedFields(String(c._id));

  return ok(res, { message: 'Deleted — affected containers reverted to the global default.', containersUpdated: affected.length });
});

// ---- featured listings for the agency dashboard (real sponsorship data,
// not a static promo — see Warehouse.sponsored / Driver.sponsored) ----

export const listFeaturedListings = asyncHandler(async (_req: Request, res: Response) => {
  const now = new Date();
  const sponsorFilter = { sponsored: true, sponsoredUntil: { $gt: now }, isActive: true };

  const [warehouses, drivers] = await Promise.all([
    WarehouseModel.find({ ...sponsorFilter, verificationStatus: 'verified' }).select('businessName location pricePerUnitPerDay photos').limit(5),
    DriverModel.find({ ...sponsorFilter, verificationStatus: 'verified', availability: true }).select('name location yearsExperience').limit(5),
  ]);

  return ok(res, {
    warehouses: warehouses.map((w) => ({
      _id: String(w._id),
      businessName: w.businessName,
      location: w.location,
      pricePerUnitPerDay: w.pricePerUnitPerDay,
      photos: w.photos,
    })),
    drivers: drivers.map((d) => ({
      _id: String(d._id),
      name: d.name,
      location: d.location,
      yearsExperience: d.yearsExperience,
    })),
  });
});
