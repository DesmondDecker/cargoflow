import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { ContainerModel } from '../models/Container';
import { BillOfLadingModel } from '../models/BillOfLading';
import { ImporterModel } from '../models/Importer';
import { SavedTrackingModel } from '../models/SavedTracking';
import { detectShippingIdentifier, guessShippingLine } from '../services/carrierDetection';
import { getTrackingProvider, PUBLIC_TRACKER_URLS } from '../services/tracking/registry';
import { scacFor } from '../services/tracking/carrierScac';
import { applyTrackingResult, genericPublicTracking, TrackingContainer } from '../services/tracking/trackingRefresh';

export function normalizeTrackingCodes(input?: string | string[]): string[] {
  const source = Array.isArray(input) ? input.join(' ') : (input ?? '');
  const seen = new Set<string>();
  const values: string[] = [];

  for (const raw of source.split(/[\n\r,;]+|\s+/)) {
    const cleaned = raw.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    if (!cleaned || seen.has(cleaned)) continue;
    seen.add(cleaned);
    values.push(cleaned);
  }

  return values;
}

export function buildExternalTrackingLookup(code: string) {
  const detection = detectShippingIdentifier(code);
  const normalized = detection.normalizedCode;
  const carrierName = detection.carrierName;
  const publicTrackingUrl = carrierName ? PUBLIC_TRACKER_URLS[carrierName] : `https://www.google.com/search?q=${encodeURIComponent(`${normalized} shipping tracking`)}`;

  if (!publicTrackingUrl) return null;
  return {
    code: normalized,
    carrierName,
    publicTrackingUrl,
    detection,
  };
}

// Powers the mobile app's barcode/QR "resolve" flow: scan a code, find out
// what it is. Tries container number first (most common scan target), then
// BL number, then the agency's own join code (so a staff member scanning
// their supervisor's onboarding QR lands somewhere sensible) — first match
// wins, in that priority order.
export const resolveCode = asyncHandler(async (req: Request, res: Response) => {
  const detection = detectShippingIdentifier(decodeURIComponent(req.params.code));
  const code = detection.normalizedCode;
  const agencyId = req.auth!.agencyId;

  const container = await ContainerModel.findOne({ agencyId, containerNumber: code });
  if (container) {
    const carrierName = container.shippingLine || detection.carrierName;
    return ok(res, {
      type: 'container',
      id: String(container._id),
      containerNumber: container.containerNumber,
      carrierName,
      detection: {
        ...detection,
        type: 'container',
        carrierName,
        confidence: 'high',
        carrierConfidence: carrierName ? 'high' : 'low',
        source: 'agency_record',
      },
    });
  }

  const bl = await BillOfLadingModel.findOne({ agencyId, blNumber: code });
  if (bl) {
    const linkedContainer = await ContainerModel.findOne({ agencyId, blId: bl._id }).select('shippingLine containerNumber');
    const carrierName = bl.shippingLine || linkedContainer?.shippingLine || detection.carrierName;
    return ok(res, {
      type: 'bill_of_lading',
      id: String(bl._id),
      blNumber: bl.blNumber,
      carrierName,
      detection: {
        ...detection,
        type: 'bill_of_lading',
        carrierName,
        confidence: 'high',
        carrierConfidence: carrierName ? 'high' : 'low',
        source: 'agency_record',
      },
    });
  }

  const external = buildExternalTrackingLookup(code);
  if (external) {
    return ok(res, {
      type: 'external_tracking',
      ...external,
    });
  }

  return ok(res, { type: 'unknown', code, detection });
});

export const trackCodes = asyncHandler(async (req: Request, res: Response) => {
  const rawCodes = typeof req.query.codes === 'string' ? req.query.codes : Array.isArray(req.query.codes) ? req.query.codes.join(',') : '';
  const submitted = normalizeTrackingCodes(rawCodes || (req.body && typeof req.body.codes === 'string' ? req.body.codes : Array.isArray(req.body?.codes) ? req.body.codes.join(',') : ''));

  if (!submitted.length) return ok(res, { results: [] });

  const agencyId = req.auth!.agencyId;
  const results = [] as Array<{ code: string; type: 'container' | 'bill_of_lading' | 'unknown'; id?: string; containerNumber?: string; blNumber?: string; containerId?: string }>;

  for (const code of submitted) {
    const container = await ContainerModel.findOne({ agencyId, containerNumber: code }).populate('blId', 'blNumber');
    if (container) {
      results.push({
        code,
        type: 'container',
        id: String(container._id),
        containerNumber: container.containerNumber,
        containerId: String(container._id),
        blNumber: (container.blId as { blNumber?: string } | null)?.blNumber,
      });
      continue;
    }

    const bl = await BillOfLadingModel.findOne({ agencyId, blNumber: code });
    if (bl) {
      const linkedContainer = await ContainerModel.findOne({ agencyId, blId: bl._id });
      results.push({
        code,
        type: 'bill_of_lading',
        id: String(bl._id),
        blNumber: bl.blNumber,
        containerNumber: linkedContainer?.containerNumber,
        containerId: linkedContainer ? String(linkedContainer._id) : undefined,
      });
      continue;
    }

    results.push({ code, type: 'unknown' });
  }

  return ok(res, { results });
});

// Performs an on-demand lookup without creating an agency container record.
// Results are transient unless explicitly saved through the saved-tracking
// endpoints below.
export const trackUnregisteredContainer = asyncHandler(async (req: Request, res: Response) => {
  const code = typeof req.query.code === 'string' ? req.query.code.trim().toUpperCase() : '';
  const referenceType = req.query.referenceType === 'bill_of_lading' ? 'bill_of_lading' : 'container';
  const normalizedCode = code.replace(/[^A-Z0-9]/g, '');
  const valid = referenceType === 'bill_of_lading' ? /^[A-Z0-9]{5,35}$/.test(normalizedCode) : /^[A-Z]{4}\d{7}$/.test(normalizedCode);
  if (!valid) {
    if (referenceType === 'bill_of_lading') {
      throw AppError.badRequest('Enter a bill of lading number containing 5 to 35 letters or digits.');
    }
    throw AppError.badRequest('Enter a container number in the format 4 letters followed by 7 digits.');
  }

  let carrierName: string | undefined;
  let trackingCode = normalizedCode;
  let trackingType: 'container' | 'bill_of_lading' = referenceType;

  if (referenceType === 'bill_of_lading') {
    const billOfLading = await BillOfLadingModel.findOne({ agencyId: req.auth!.agencyId, blNumber: normalizedCode });
    const linkedContainer = billOfLading
      ? await ContainerModel.findOne({ agencyId: req.auth!.agencyId, blId: billOfLading._id })
      : null;
    carrierName = billOfLading?.shippingLine || linkedContainer?.shippingLine;

    if (linkedContainer) {
      trackingCode = linkedContainer.containerNumber;
      trackingType = 'container';
      carrierName ||= guessShippingLine(linkedContainer.containerNumber).guess;
    } else {
      carrierName ||= Object.keys(PUBLIC_TRACKER_URLS).find((name) => scacFor(name) === normalizedCode.slice(0, 4));
    }

    const selectedCarrier = typeof req.query.carrierName === 'string' ? req.query.carrierName : undefined;
    if (selectedCarrier && !PUBLIC_TRACKER_URLS[selectedCarrier]) {
      throw AppError.badRequest('Select a supported shipping line.');
    }
    if (selectedCarrier) carrierName = selectedCarrier;
    if (!carrierName) {
      throw AppError.badRequest('Select the shipping line for this bill of lading, then try again.');
    }
  } else {
    carrierName = guessShippingLine(normalizedCode).guess;
  }

  const context = {
    guessedCarrier: carrierName,
    publicTrackingUrl: carrierName ? PUBLIC_TRACKER_URLS[carrierName] : undefined,
  };
  const provider = getTrackingProvider(carrierName);
  let tracking;

  if (provider) {
    const result = await provider.fetchTracking(trackingCode, { carrierName, referenceType: trackingType });
    const transientContainer: TrackingContainer = {};
    applyTrackingResult(transientContainer, result, context);
    tracking = transientContainer.liveTracking;
  } else {
    tracking = genericPublicTracking({}, context);
  }

  return ok(res, {
    containerNumber: normalizedCode,
    trackingNumber: normalizedCode,
    trackingType: referenceType,
    matchedContainerNumber: tracking?.matchedContainerNumber,
    tracking,
    saved: false,
  });
});

const savedTrackingSchema = z.object({
  containerNumber: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{5,35}$/),
  trackingType: z.enum(['container', 'bill_of_lading']).default('container'),
  tracking: z.object({
    resolved: z.boolean(),
    carrierName: z.string().optional(),
    status: z.string().optional(),
    vesselName: z.string().optional(),
    eta: z.string().datetime().optional(),
    source: z.string().min(1),
    publicTrackingUrl: z.string().url().optional(),
    originPlace: z.string().optional(),
    destinationPlace: z.string().optional(),
    departedAt: z.string().datetime().optional(),
    latestEvent: z.object({
      description: z.string(),
      location: z.string().optional(),
      facility: z.string().optional(),
      at: z.string().datetime().optional(),
    }).optional(),
    eventsCompleted: z.number().optional(),
    carrierUpdatedNote: z.string().optional(),
    checkedAt: z.string().datetime().optional(),
  }),
});

export const saveUnregisteredTracking = asyncHandler(async (req: Request, res: Response) => {
  const input = savedTrackingSchema.parse(req.body);
  const savedTrackingIdentity = input.trackingType === 'container'
    ? { $or: [{ trackingType: 'container' }, { trackingType: { $exists: false } }] }
    : { trackingType: input.trackingType };
  const saved = await SavedTrackingModel.findOneAndUpdate(
    { agencyId: req.auth!.agencyId, containerNumber: input.containerNumber, ...savedTrackingIdentity },
    { $set: { tracking: input.tracking, trackingType: input.trackingType } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  return ok(res, { savedTracking: saved });
});

export const listSavedTracking = asyncHandler(async (req: Request, res: Response) => {
  const savedTracking = await SavedTrackingModel.find({ agencyId: req.auth!.agencyId }).sort({ updatedAt: -1 }).limit(100);
  return ok(res, { savedTracking });
});

export const deleteSavedTracking = asyncHandler(async (req: Request, res: Response) => {
  const containerNumber = req.params.containerNumber.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  const trackingType = req.query.trackingType === 'bill_of_lading' ? 'bill_of_lading' : 'container';
  const valid = trackingType === 'bill_of_lading' ? /^[A-Z0-9]{5,35}$/.test(containerNumber) : /^[A-Z]{4}\d{7}$/.test(containerNumber);
  if (!valid) {
    throw AppError.badRequest(`Invalid ${trackingType === 'bill_of_lading' ? 'bill of lading' : 'container'} number.`);
  }
  const typeFilter = trackingType === 'container'
    ? { $or: [{ trackingType: 'container' }, { trackingType: { $exists: false } }] }
    : { trackingType };
  const deleted = await SavedTrackingModel.findOneAndDelete({ agencyId: req.auth!.agencyId, containerNumber, ...typeFilter });
  if (!deleted) throw AppError.notFound('Saved tracking not found.');
  return res.status(204).send();
});

export const globalSearch = asyncHandler(async (req: Request, res: Response) => {
  const q = ((req.query.q as string) || '').trim();
  if (!q) throw AppError.badRequest('Query parameter "q" is required');
  const agencyId = req.auth!.agencyId;
  const regex = new RegExp(q, 'i');

  const [containers, billsOfLading, importers] = await Promise.all([
    ContainerModel.find({ agencyId, containerNumber: regex }).limit(10).select('containerNumber status attentionLevel'),
    BillOfLadingModel.find({ agencyId, blNumber: regex }).limit(10).select('blNumber shippingLine'),
    ImporterModel.find({ agencyId, name: regex }).limit(10).select('name'),
  ]);

  return ok(res, {
    results: {
      containers: containers.map((c) => ({ _id: String(c._id), containerNumber: c.containerNumber, status: c.status, attentionLevel: c.attentionLevel })),
      billsOfLading: billsOfLading.map((b) => ({ _id: String(b._id), blNumber: b.blNumber, shippingLine: b.shippingLine })),
      importers: importers.map((i) => ({ _id: String(i._id), name: i.name })),
    },
  });
});
