import { Request, Response } from 'express';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { DailyDigestModel } from '../models/DailyDigest';
import { computeDailyDigest } from '../services/digestService';

export const fetchLatestDigest = asyncHandler(async (req: Request, res: Response) => {
  const latest = await DailyDigestModel.findOne({ agencyId: req.auth!.agencyId }).sort({ dateKey: -1 });
  if (!latest) {
    // No digest has ever run for this agency (e.g. brand new) — compute one
    // on the fly rather than returning a 404 for a screen the app expects
    // to always be able to show something on.
    const digest = await computeDailyDigest(req.auth!.agencyId!);
    return ok(res, { digest });
  }
  return ok(res, { digest: latest.payload });
});

export const runDigestNow = asyncHandler(async (req: Request, res: Response) => {
  const digest = await computeDailyDigest(req.auth!.agencyId!);
  return ok(res, { digest });
});
