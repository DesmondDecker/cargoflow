import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { ContainerModel, ContainerStatus } from '../models/Container';
import { CargoDocumentModel } from '../models/CargoDocument';
import { BillOfLadingModel } from '../models/BillOfLading';
import { ImporterModel } from '../models/Importer';
import { UserModel } from '../models/User';
import { ActivityLogModel } from '../models/ActivityLog';
import { validateContainerNumber, guessShippingLine, agencyHistoryConfidence } from '../services/carrierDetection';
import { AgencyCarrierPrefixOverrideModel } from '../models/AgencyCarrierPrefixOverride';
import { AgencyDemurrageTermModel } from '../models/AgencyDemurrageTerm';
import { getTrackingProvider, PUBLIC_TRACKER_URLS } from '../services/tracking/registry';
import { computeDeadlines } from '../services/deadlineEngine';
import { computeAttention } from '../services/attentionEngine';
import { STATUS_KEYS } from '../constants/containerPipeline';
import { buildExternalTrackingLookup, normalizeTrackingCodes } from './searchController';

// Recomputes numberValidation/shippingLineDetection/deadlines/attention from
// the container's current stored fields, and persists the result. Called
// after anything that could change any of those inputs (status, dates,
// document upload/delete) so a client reading the container right after
// never sees stale attention data.
//
// Four-tier cascade for the carrier, most authoritative first:
//   1. Staff manually confirmed it (shippingLineDetection.manuallyEdited) —
//      never touched here, full stop.
//   2. The linked Bill of Lading states a shipping line. That's a human
//      reading it off the actual paper document, not a heuristic — it
//      outranks the BIC-prefix guess whenever it disagrees, not just when
//      the container's own field happens to be empty.
//   3. The BIC-prefix guess (global table, carrierDetection.ts).
//   4. Only when the global table has NO entry for the prefix: this
//      agency's own history of correcting that exact prefix before (see
//      AgencyCarrierPrefixOverride). Fills real gaps without ever
//      overriding a properly sourced global mapping.
// Previously this only ever set shippingLine on first computation and then
// left it alone forever (a bug in its own right: a low-confidence guess
// could never be superseded once a real answer showed up), and the BL's own
// shippingLine field was never consulted at all despite already existing on
// every container via blId.
//
// Deadlines then use whichever carrier that cascade landed on to look up
// this agency's own entered free-time/grace-period terms for that carrier
// (AgencyDemurrageTerm) — falling back to deadlineEngine's global default
// when the agency hasn't entered anything for that carrier yet. No dollar
// figures anywhere; see AgencyDemurrageTerm's own comment for why.
export async function recomputeDerivedFields(containerId: string): Promise<void> {
  const container = await ContainerModel.findById(containerId);
  if (!container) return;

  const numberValidation = validateContainerNumber(container.containerNumber);
  container.numberValidation = numberValidation;

  if (!container.shippingLineDetection?.manuallyEdited) {
    const bl = await BillOfLadingModel.findById(container.blId).select('shippingLine');
    if (bl?.shippingLine) {
      container.shippingLineDetection = { guess: bl.shippingLine, confidence: 'high', source: 'bill_of_lading', manuallyEdited: false };
      container.shippingLine = bl.shippingLine;
    } else {
      const guess = guessShippingLine(container.containerNumber);
      if (guess.guess) {
        container.shippingLineDetection = { ...guess, manuallyEdited: false };
        container.shippingLine = guess.guess;
      } else {
        // Global table has nothing for this prefix — before giving up,
        // check whether THIS agency has corrected this exact prefix before.
        // Never consulted when the global table already has an answer (see
        // AgencyCarrierPrefixOverride's own comment for why).
        const prefix = container.containerNumber.trim().toUpperCase().slice(0, 4);
        const learned = await AgencyCarrierPrefixOverrideModel.findOne({ agencyId: container.agencyId, prefix });
        if (learned) {
          container.shippingLineDetection = {
            guess: learned.shippingLine,
            confidence: agencyHistoryConfidence(learned.correctionCount),
            source: 'agency_history',
            manuallyEdited: false,
          };
          container.shippingLine = learned.shippingLine;
        } else {
          container.shippingLineDetection = { ...guess, manuallyEdited: false };
          container.shippingLine = guess.guess;
        }
      }
    }
  }

  container.deadlines = computeDeadlines(
    { discharged: container.dates.discharged, arrival: container.dates.arrival },
    new Date(),
    container.shippingLine
      ? await AgencyDemurrageTermModel.findOne({ agencyId: container.agencyId, shippingLine: container.shippingLine }).then(
          (term) => term ? { freeStorageDays: term.freeStorageDays, demurrageGraceDays: term.demurrageGraceDays } : undefined
        )
      : undefined
  );

  const docs = await CargoDocumentModel.find({ containerId: container._id, deletedAt: null });
  const typesPresent = new Set(docs.map((d) => d.documentType));
  const attention = computeAttention(container, typesPresent);
  container.attentionLevel = attention.attentionLevel;
  container.attentionReasons = attention.attentionReasons;
  container.attentionRank = attention.attentionRank;

  await container.save();
}

export function listItemShape(c: {
  _id: unknown;
  containerNumber: string;
  status: string;
  attentionLevel: string;
  attentionReasons: string[];
  shippingLine?: string;
  shippingLineDetection?: { confidence?: 'high' | 'medium' | 'low'; source?: string; manuallyEdited?: boolean };
  vessel?: string;
  importerId: unknown;
  assignedOfficerId?: unknown;
  updatedAt: Date;
  version: number;
  liveTracking?: {
    resolved: boolean;
    carrierName?: string;
    status?: string;
    vesselName?: string;
    eta?: Date;
    source: string;
    publicTrackingUrl?: string;
  };
}) {
  return {
    _id: String(c._id),
    containerNumber: c.containerNumber,
    status: c.status,
    attentionLevel: c.attentionLevel,
    attentionReasons: c.attentionReasons,
    shippingLine: c.shippingLine,
    // Just enough for a list screen to flag "please verify" without a
    // separate call per container — the full guess object (with the
    // 'agency_history' vs 'bill_of_lading' distinction) is on the case-file
    // detail view below, where there's room to actually explain it.
    shippingLineConfidence: c.shippingLineDetection?.manuallyEdited ? 'confirmed' : c.shippingLineDetection?.confidence,
    vessel: c.vessel,
    importerId: c.importerId,
    assignedOfficerId: c.assignedOfficerId,
    liveTracking: c.liveTracking,
    updatedAt: c.updatedAt,
    version: c.version,
  };
}

export const fetchContainers = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(parseInt((req.query.page as string) || '1', 10), 1);
  const limit = 20;
  const filter: Record<string, unknown> = { agencyId: req.auth!.agencyId };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.attentionLevel) filter.attentionLevel = req.query.attentionLevel;
  if (req.query.shippingLine) filter.shippingLine = req.query.shippingLine;
  if (req.query.search) {
    const searchText = (req.query.search as string).trim();
    const codes = normalizeTrackingCodes(searchText);
    if (codes.length > 0) {
      const blMatches = await BillOfLadingModel.find({
        agencyId: req.auth!.agencyId,
        blNumber: { $in: codes.map((code) => new RegExp(code, 'i')) },
      }).select('_id');

      filter.$or = [
        ...codes.map((code) => ({ containerNumber: new RegExp(code, 'i') })),
        ...(blMatches.length > 0 ? [{ blId: { $in: blMatches.map((bl) => bl._id) } }] : []),
      ];
    } else if (searchText) {
      filter.containerNumber = new RegExp(searchText, 'i');
    }
  }

  const [containers, total] = await Promise.all([
    ContainerModel.find(filter)
      .populate('importerId', 'name')
      .populate('assignedOfficerId', 'name')
      .sort({ attentionRank: 1, updatedAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit),
    ContainerModel.countDocuments(filter),
  ]);

  const searchText = typeof req.query.search === 'string' ? req.query.search.trim() : '';
  const externalLookup = searchText && containers.length === 0 ? buildExternalTrackingLookup(searchText) : null;

  return ok(res, { containers: containers.map(listItemShape), pagination: { total, pages: Math.ceil(total / limit) || 1, page }, externalLookup });
});

export const fetchDashboardStats = asyncHandler(async (req: Request, res: Response) => {
  const agencyId = req.auth!.agencyId;
  const [totalContainers, byStatus, byAttention, byOfficerRaw, byCarrier] = await Promise.all([
    ContainerModel.countDocuments({ agencyId }),
    ContainerModel.aggregate([{ $match: { agencyId: (req as unknown as { auth: { agencyId: string } }).auth.agencyId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
    ContainerModel.aggregate([{ $match: { agencyId: (req as unknown as { auth: { agencyId: string } }).auth.agencyId } }, { $group: { _id: '$attentionLevel', count: { $sum: 1 } } }]),
    ContainerModel.aggregate([
      { $match: { agencyId: (req as unknown as { auth: { agencyId: string } }).auth.agencyId } },
      { $group: { _id: '$assignedOfficerId', count: { $sum: 1 } } },
    ]),
    ContainerModel.aggregate([
      { $match: { agencyId: (req as unknown as { auth: { agencyId: string } }).auth.agencyId } },
      { $group: { _id: { $ifNull: ['$shippingLine', { $ifNull: ['$shippingLineDetection.guess', 'Unidentified'] }] }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
  ]);

  const officerIds = byOfficerRaw.map((r) => r._id).filter(Boolean);
  const officers = await UserModel.find({ _id: { $in: officerIds } }, 'name');
  const nameById = new Map(officers.map((o) => [String(o._id), o.name]));
  const byOfficer = byOfficerRaw.map((r) => ({ _id: r._id ? String(r._id) : null, count: r.count, officerName: r._id ? nameById.get(String(r._id)) : undefined }));

  return ok(res, { totalContainers, byStatus, byAttention, byOfficer, byCarrier });
});

export const fetchContainerCaseFile = asyncHandler(async (req: Request, res: Response) => {
  const container = await ContainerModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId })
    .populate('importerId', 'name')
    .populate('assignedOfficerId', 'name')
    .populate('blId', 'blNumber shippingLine vesselName')
    .populate('statusHistory.changedBy', 'name');
  if (!container) throw AppError.notFound('Container not found');

  const docs = await CargoDocumentModel.find({ containerId: container._id, deletedAt: null });
  const documentChecklist = container.requiredDocumentTypes.map((type) => ({ type, satisfied: docs.some((d) => d.documentType === type) }));

  const activity = await ActivityLogModel.find({ containerId: container._id }).sort({ createdAt: -1 }).limit(50);
  const timeline = activity.map((a) => ({
    action: a.action,
    description: describeActivity(a.action, a.details),
    occurredAt: a.createdAt,
    performedBy: { name: a.actorName },
  }));

  const bl = container.blId as unknown as { _id: unknown; blNumber: string; shippingLine?: string; vesselName?: string } | null;

  return ok(res, {
    container: {
      ...listItemShape(container as unknown as Parameters<typeof listItemShape>[0]),
      dates: container.dates,
      deadlines: container.deadlines,
      blId: bl ? { _id: String(bl._id), blNumber: bl.blNumber, shippingLine: bl.shippingLine, vessel: bl.vesselName } : container.blId,
      statusHistory: container.statusHistory.map((h) => ({
        status: h.status,
        changedAt: h.changedAt,
        changedBy: h.changedByName ? { name: h.changedByName } : undefined,
        note: h.note,
      })),
      liveTracking: container.liveTracking,
      numberValidation: container.numberValidation,
      shippingLineDetection: container.shippingLineDetection,
      requiredDocumentTypes: container.requiredDocumentTypes,
    },
    documents: docs.map((d) => ({ _id: String(d._id), documentType: d.documentType, currentVersion: d.currentVersion })),
    documentChecklist,
    timeline,
  });
});

function describeActivity(action: string, details?: Record<string, unknown>): string {
  switch (action) {
    case 'container_created':
      return 'Container was registered';
    case 'status_changed':
      return `Status changed to "${details?.status ?? ''}"${details?.note ? ` — ${details.note}` : ''}`;
    case 'document_uploaded':
      return `${details?.documentType ?? 'A document'} was uploaded`;
    case 'document_deleted':
      return `${details?.documentType ?? 'A document'} was removed`;
    case 'dates_updated':
      return 'Key dates were updated';
    case 'tracking_refreshed':
      return 'Live tracking was refreshed';
    case 'delivery_completed':
      return 'Delivery was marked complete';
    default:
      return action.replace(/_/g, ' ');
  }
}

const createContainerSchema = z.object({
  containerNumber: z.string().trim().min(1),
  importerId: z.string().min(1),
  blId: z.string().min(1),
  size: z.enum(['20ft', '40ft', '40ft HC', '45ft']).optional(),
});

// The mobile app's committed screens don't show a "create container" call —
// most likely because that screen wasn't part of what was uploaded/built
// yet. A create endpoint has to exist somewhere for the system to have any
// containers at all, so this is a reasonable addition rather than a
// contract match; wire up whatever screen creates containers to POST here.
export const createContainer = asyncHandler(async (req: Request, res: Response) => {
  const input = createContainerSchema.parse(req.body);
  const importer = await ImporterModel.findOne({ _id: input.importerId, agencyId: req.auth!.agencyId });
  if (!importer) throw AppError.notFound('Importer not found');
  const bl = await BillOfLadingModel.findOne({ _id: input.blId, agencyId: req.auth!.agencyId });
  if (!bl) throw AppError.notFound('Bill of lading not found');

  const container = await ContainerModel.create({
    agencyId: req.auth!.agencyId,
    importerId: importer._id,
    blId: bl._id,
    containerNumber: input.containerNumber,
    size: input.size || '20ft',
    statusHistory: [{ status: STATUS_KEYS[0], changedByName: 'System', note: 'Container registered' }],
  });

  await ActivityLogModel.create({ agencyId: req.auth!.agencyId, containerId: container._id, actorName: req.auth!.role || 'User', action: 'container_created' });
  await recomputeDerivedFields(String(container._id));

  const fresh = await ContainerModel.findById(container._id);
  return ok(res, { container: listItemShape(fresh!) }, 201);
});

const updateContainerDetailsSchema = z.object({
  containerNumber: z.string().trim().optional(),
  shippingLine: z.string().trim().optional(),
  vessel: z.string().trim().optional(),
  size: z.enum(['20ft', '40ft', '40ft HC', '45ft']).optional(),
  blId: z.string().min(1).optional(),
  importerId: z.string().min(1).optional(),
});

export const updateContainerDetails = asyncHandler(async (req: Request, res: Response) => {
  const input = updateContainerDetailsSchema.parse(req.body);
  const container = await ContainerModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!container) throw AppError.notFound('Container not found');

  if (input.importerId) {
    const importer = await ImporterModel.findOne({ _id: input.importerId, agencyId: req.auth!.agencyId });
    if (!importer) throw AppError.notFound('Importer not found');
    container.importerId = importer._id;
  }

  if (input.blId) {
    const bl = await BillOfLadingModel.findOne({ _id: input.blId, agencyId: req.auth!.agencyId });
    if (!bl) throw AppError.notFound('Bill of lading not found');
    container.blId = bl._id;
  }

  if (input.containerNumber) {
    const existing = await ContainerModel.findOne({ agencyId: req.auth!.agencyId, containerNumber: input.containerNumber.trim().toUpperCase(), _id: { $ne: container._id } });
    if (existing) throw AppError.badRequest('Another container with that number already exists');
    container.containerNumber = input.containerNumber.trim().toUpperCase();
  }

  if (input.size) container.size = input.size;
  if (input.shippingLine !== undefined) container.shippingLine = input.shippingLine.trim() || undefined;
  if (input.vessel !== undefined) container.vessel = input.vessel.trim() || undefined;

  container.version += 1;
  await container.save();

  const actor = await UserModel.findById(req.auth!.userId);
  await ActivityLogModel.create({
    agencyId: req.auth!.agencyId,
    containerId: container._id,
    actorName: actor?.name || 'User',
    actorUserId: actor?._id,
    action: 'details_updated',
    details: input,
  });

  await recomputeDerivedFields(String(container._id));

  const fresh = await ContainerModel.findById(container._id).populate('blId', 'blNumber shippingLine vesselName').populate('importerId', 'name');
  return ok(res, { container: listItemShape(fresh!) });
});

const changeStatusSchema = z.object({
  status: z.enum(STATUS_KEYS),
  note: z.string().optional(),
});

export const changeContainerStatus = asyncHandler(async (req: Request, res: Response) => {
  const input = changeStatusSchema.parse(req.body);
  const container = await ContainerModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!container) throw AppError.notFound('Container not found');

  const actor = await UserModel.findById(req.auth!.userId);
  container.status = input.status as ContainerStatus;
  container.statusHistory.push({ status: input.status as ContainerStatus, changedAt: new Date(), changedBy: actor?._id, changedByName: actor?.name, note: input.note });
  if (input.status === 'Cleared') container.dates.cleared = new Date();
  if (input.status === 'Delivered') container.dates.delivered = new Date();
  container.version += 1;
  await container.save();

  await ActivityLogModel.create({
    agencyId: req.auth!.agencyId,
    containerId: container._id,
    actorName: actor?.name || 'User',
    actorUserId: actor?._id,
    action: 'status_changed',
    details: { status: input.status, note: input.note },
  });
  await recomputeDerivedFields(String(container._id));

  const fresh = await ContainerModel.findById(container._id);
  return ok(res, { container: listItemShape(fresh!) });
});

const updateDatesSchema = z.object({
  arrival: z.string().datetime().optional(),
  doReceived: z.string().datetime().optional(),
  discharged: z.string().datetime().optional(),
  cleared: z.string().datetime().optional(),
  delivered: z.string().datetime().optional(),
});

export const updateContainerDates = asyncHandler(async (req: Request, res: Response) => {
  const input = updateDatesSchema.parse(req.body);
  const container = await ContainerModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!container) throw AppError.notFound('Container not found');

  for (const [key, value] of Object.entries(input)) {
    if (value) (container.dates as Record<string, Date>)[key] = new Date(value);
  }
  container.version += 1;
  await container.save();

  const actor = await UserModel.findById(req.auth!.userId);
  await ActivityLogModel.create({ agencyId: req.auth!.agencyId, containerId: container._id, actorName: actor?.name || 'User', actorUserId: actor?._id, action: 'dates_updated', details: input });
  await recomputeDerivedFields(String(container._id));

  const fresh = await ContainerModel.findById(container._id);
  return ok(res, { container: listItemShape(fresh!) });
});

const setShippingLineSchema = z.object({ shippingLine: z.string().trim().min(1) });

// The one piece the cascade in recomputeDerivedFields can't do on its own:
// letting a human say "no, it's actually this carrier" and having that
// stick. Without this, shippingLineDetection.manuallyEdited was checked on
// every recompute but never set anywhere — dead code that could never
// fire, and a wrong guess (or a BL typo) had no way to be corrected short
// of editing the database directly.
export const setShippingLine = asyncHandler(async (req: Request, res: Response) => {
  const { shippingLine } = setShippingLineSchema.parse(req.body);
  const container = await ContainerModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!container) throw AppError.notFound('Container not found');

  container.shippingLine = shippingLine;
  container.shippingLineDetection = { guess: shippingLine, confidence: 'high', source: 'manual', manuallyEdited: true };
  container.version += 1;
  await container.save();

  // Only feeds the agency-history fallback tier when the global table has
  // no answer for this prefix — recording a correction for a prefix the
  // global table already resolves would just be noise that tier never
  // reads (see recomputeDerivedFields and AgencyCarrierPrefixOverride).
  const prefix = container.containerNumber.trim().toUpperCase().slice(0, 4);
  if (!guessShippingLine(container.containerNumber).guess) {
    await AgencyCarrierPrefixOverrideModel.findOneAndUpdate(
      { agencyId: req.auth!.agencyId, prefix },
      { $set: { shippingLine, lastCorrectedAt: new Date() }, $inc: { correctionCount: 1 } },
      { upsert: true, setDefaultsOnInsert: true }
    );
  }

  const actor = await UserModel.findById(req.auth!.userId);
  await ActivityLogModel.create({
    agencyId: req.auth!.agencyId,
    containerId: container._id,
    actorName: actor?.name || 'User',
    actorUserId: actor?._id,
    action: 'shipping_line_corrected',
    details: { shippingLine },
  });
  await recomputeDerivedFields(String(container._id));

  const fresh = await ContainerModel.findById(container._id);
  return ok(res, { container: listItemShape(fresh!) });
});

// Refreshes live tracking for the container. Not purely cosmetic: this
// calls the real carrier API when one is configured for this carrier (see
// services/tracking/registry.ts — Maersk/CMA CGM/Hapag-Lloyd today, more
// once credentials are set), and only falls back to the BIC-prefix guess
// when no provider is configured or the live call itself fails.
export const refreshContainerTracking = asyncHandler(async (req: Request, res: Response) => {
  const container = await ContainerModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId }).populate('blId', 'vesselName');
  if (!container) throw AppError.notFound('Container not found');

  const guess = guessShippingLine(container.containerNumber);
  const carrierName = container.shippingLine || guess.guess;
  const bl = container.blId as unknown as { vesselName?: string } | null;
  const publicTrackingUrl = carrierName ? PUBLIC_TRACKER_URLS[carrierName] : undefined;

  // Real carrier API first (only exists once that carrier's own credentials
  // are configured — see services/tracking/registry.ts). Falls back to the
  // BIC-prefix guess when no provider is configured for this carrier, or
  // when the live call itself fails — the failure is labeled in `source`
  // rather than silently downgraded to the guess with no explanation.
  const provider = getTrackingProvider(carrierName);
  if (provider) {
    const result = await provider.fetchTracking(container.containerNumber);
    container.liveTracking = { ...result, publicTrackingUrl };
  } else {
    container.liveTracking = {
      resolved: !!guess.guess,
      carrierName: guess.guess,
      status: guess.guess ? 'Carrier identified — no live tracking source configured for this line' : 'Unable to identify carrier from container number',
      vesselName: container.vessel || bl?.vesselName,
      eta: container.liveTracking?.eta,
      source: 'bic_owner_code_table',
      publicTrackingUrl,
    };
  }
  await container.save();

  await ActivityLogModel.create({ agencyId: req.auth!.agencyId, containerId: container._id, actorName: 'System', action: 'tracking_refreshed' });

  return ok(res, { liveTracking: container.liveTracking });
});
