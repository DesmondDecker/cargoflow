import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { ShipmentPaymentModel, SHIPMENT_PAYMENT_METHODS } from '../models/ShipmentPayment';
import { ContainerModel } from '../models/Container';
import { ImporterModel } from '../models/Importer';
import { UserModel } from '../models/User';
import { ActivityLogModel } from '../models/ActivityLog';

function paymentShape(p: {
  _id: unknown; importerId: unknown; containerId?: unknown; amount: number; currency: string;
  paymentMethod: string; paidAt: Date; recordedByUserId: unknown; notes?: string; createdAt: Date;
}) {
  return {
    _id: String(p._id),
    importerId: String(p.importerId),
    containerId: p.containerId ? String(p.containerId) : undefined,
    amount: p.amount,
    currency: p.currency,
    paymentMethod: p.paymentMethod,
    paidAt: p.paidAt,
    recordedByUserId: String(p.recordedByUserId),
    notes: p.notes,
    createdAt: p.createdAt,
  };
}

const recordPaymentSchema = z.object({
  importerId: z.string().min(1),
  containerId: z.string().optional(),
  amount: z.number().positive(),
  currency: z.string().trim().min(1).max(6).optional(),
  paymentMethod: z.enum(SHIPMENT_PAYMENT_METHODS),
  paidAt: z.string().datetime().optional(),
  notes: z.string().trim().optional(),
});

export const recordPayment = asyncHandler(async (req: Request, res: Response) => {
  const input = recordPaymentSchema.parse(req.body);

  const importer = await ImporterModel.findOne({ _id: input.importerId, agencyId: req.auth!.agencyId });
  if (!importer) throw AppError.notFound('Importer not found');
  if (input.containerId) {
    const container = await ContainerModel.findOne({ _id: input.containerId, agencyId: req.auth!.agencyId });
    if (!container) throw AppError.notFound('Container not found');
  }

  const payment = await ShipmentPaymentModel.create({
    agencyId: req.auth!.agencyId,
    importerId: input.importerId,
    containerId: input.containerId,
    amount: input.amount,
    currency: input.currency || 'SLE',
    paymentMethod: input.paymentMethod,
    paidAt: input.paidAt ? new Date(input.paidAt) : new Date(),
    recordedByUserId: req.auth!.userId,
    notes: input.notes,
  });

  const actor = await UserModel.findById(req.auth!.userId);
  await ActivityLogModel.create({
    agencyId: req.auth!.agencyId,
    containerId: input.containerId,
    actorName: actor?.name || 'User',
    actorUserId: actor?._id,
    action: 'payment_recorded',
    description: `${actor?.name || 'A staff member'} recorded a payment of ${payment.currency} ${input.amount} from ${importer.name}`,
    details: { paymentId: payment._id },
  });

  return ok(res, { payment: paymentShape(payment) }, 201);
});

export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { agencyId: req.auth!.agencyId };
  if (req.query.containerId) filter.containerId = req.query.containerId;
  if (req.query.importerId) filter.importerId = req.query.importerId;

  const payments = await ShipmentPaymentModel.find(filter).sort({ paidAt: -1 }).limit(200);
  return ok(res, { payments: payments.map(paymentShape) });
});

export const getPayment = asyncHandler(async (req: Request, res: Response) => {
  const payment = await ShipmentPaymentModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!payment) throw AppError.notFound('Payment not found');
  return ok(res, { payment: paymentShape(payment) });
});
