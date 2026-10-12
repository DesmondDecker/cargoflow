import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { BillOfLadingModel } from '../models/BillOfLading';
import { ImporterModel } from '../models/Importer';

// Not part of the mobile client's committed API surface (no billOfLadingApi.ts
// was in the repo), but a container can't be created without one — added so
// the system is actually usable end-to-end. Wire up whatever screen captures
// a BL to these two endpoints.
const createSchema = z.object({
  importerId: z.string().min(1),
  blNumber: z.string().trim().min(1),
  shippingLine: z.string().trim().optional(),
  vesselName: z.string().trim().optional(),
  portOfLoading: z.string().trim().optional(),
  portOfDischarge: z.string().trim().optional(),
  etd: z.string().datetime().optional(),
  eta: z.string().datetime().optional(),
});

export const createBillOfLading = asyncHandler(async (req: Request, res: Response) => {
  const input = createSchema.parse(req.body);
  const importer = await ImporterModel.findOne({ _id: input.importerId, agencyId: req.auth!.agencyId });
  if (!importer) throw AppError.notFound('Importer not found');

  const bl = await BillOfLadingModel.create({
    agencyId: req.auth!.agencyId,
    importerId: importer._id,
    blNumber: input.blNumber,
    shippingLine: input.shippingLine,
    vesselName: input.vesselName,
    portOfLoading: input.portOfLoading,
    portOfDischarge: input.portOfDischarge,
    etd: input.etd ? new Date(input.etd) : undefined,
    eta: input.eta ? new Date(input.eta) : undefined,
  });

  return ok(res, { billOfLading: bl }, 201);
});

export const fetchBillsOfLading = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { agencyId: req.auth!.agencyId };
  if (req.query.importerId) filter.importerId = req.query.importerId;
  const bills = await BillOfLadingModel.find(filter).sort({ createdAt: -1 });
  return ok(res, { billsOfLading: bills });
});
