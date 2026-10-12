import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { ContainerModel } from '../models/Container';
import { BillOfLadingModel } from '../models/BillOfLading';
import { ImporterModel } from '../models/Importer';
import { guessShippingLine } from '../services/carrierDetection';
import { PUBLIC_TRACKER_URLS } from '../services/tracking/registry';

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
  const normalized = code.trim().toUpperCase();
  const carrier = guessShippingLine(normalized);
  const publicTrackingUrl = carrier.guess ? PUBLIC_TRACKER_URLS[carrier.guess] : `https://www.google.com/search?q=${encodeURIComponent(`${normalized} shipping tracking`)}`;

  if (!publicTrackingUrl) return null;
  return {
    code: normalized,
    carrierName: carrier.guess,
    publicTrackingUrl,
  };
}

// Powers the mobile app's barcode/QR "resolve" flow: scan a code, find out
// what it is. Tries container number first (most common scan target), then
// BL number, then the agency's own join code (so a staff member scanning
// their supervisor's onboarding QR lands somewhere sensible) — first match
// wins, in that priority order.
export const resolveCode = asyncHandler(async (req: Request, res: Response) => {
  const code = decodeURIComponent(req.params.code).trim().toUpperCase();
  const agencyId = req.auth!.agencyId;

  const container = await ContainerModel.findOne({ agencyId, containerNumber: code });
  if (container) return ok(res, { type: 'container', id: String(container._id), containerNumber: container.containerNumber });

  const bl = await BillOfLadingModel.findOne({ agencyId, blNumber: code });
  if (bl) return ok(res, { type: 'bill_of_lading', id: String(bl._id), blNumber: bl.blNumber });

  const external = buildExternalTrackingLookup(code);
  if (external) {
    return ok(res, {
      type: 'external_tracking',
      ...external,
    });
  }

  return ok(res, { type: 'unknown', code });
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
