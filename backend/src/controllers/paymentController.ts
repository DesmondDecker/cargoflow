import { Request, Response } from 'express';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { PaymentModel } from '../models/Payment';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan';

// Agency-side of the subscription-payment flow — not present in the mobile
// client's committed API files (no paymentApi.ts was uploaded), added so a
// payment record can actually be created for a platform admin to verify.
// merchantNumber is a placeholder to be replaced with the agency's real
// mobile-money merchant/till number once that's decided (see README).
const createPaymentSchema = z.object({
  planId: z.string().min(1),
  paymentMethod: z.enum(['orange_money', 'afrimoney']),
  payerPhoneNumber: z.string().trim().optional(),
});

export const createPayment = asyncHandler(async (req: Request, res: Response) => {
  const input = createPaymentSchema.parse(req.body);
  const plan = await SubscriptionPlanModel.findOne({ planId: input.planId, isActive: true });
  if (!plan) throw AppError.notFound('Subscription plan not found');

  const payment = await PaymentModel.create({
    agencyId: req.auth!.agencyId,
    planId: plan.planId,
    amountExpected: plan.amount,
    currency: plan.currency,
    paymentMethod: input.paymentMethod,
    merchantNumber: process.env.MERCHANT_NUMBER_PLACEHOLDER || 'SET_MERCHANT_NUMBER',
    referenceCode: uuidv4().slice(0, 8).toUpperCase(),
    payerPhoneNumber: input.payerPhoneNumber,
    status: 'pending',
  });

  return ok(res, { payment }, 201);
});

const submitTransactionSchema = z.object({ submittedTransactionId: z.string().trim().min(1) });

export const submitPaymentTransaction = asyncHandler(async (req: Request, res: Response) => {
  const input = submitTransactionSchema.parse(req.body);
  const payment = await PaymentModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!payment) throw AppError.notFound('Payment not found');
  if (payment.status !== 'pending') throw AppError.badRequest('This payment has already been submitted');

  payment.submittedTransactionId = input.submittedTransactionId;
  payment.status = 'submitted';
  await payment.save();

  return ok(res, { payment });
});

export const fetchMyPayments = asyncHandler(async (req: Request, res: Response) => {
  const payments = await PaymentModel.find({ agencyId: req.auth!.agencyId }).sort({ createdAt: -1 });
  return ok(res, { payments });
});
