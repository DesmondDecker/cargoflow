import { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { ExpenseModel, EXPENSE_CATEGORIES } from '../models/Expense';
import { ContainerModel } from '../models/Container';
import { UserModel } from '../models/User';
import { ActivityLogModel } from '../models/ActivityLog';
import { createPresignedUploadUrl } from '../services/storageService';

function expenseShape(e: {
  _id: unknown; containerId?: unknown; category: string; amount: number; currency: string;
  description?: string; evidenceUrls: string[]; recordedByUserId: unknown; status: string;
  approvedByUserId?: unknown; approvedAt?: Date; rejectionReason?: string; createdAt: Date;
}) {
  return {
    _id: String(e._id),
    containerId: e.containerId ? String(e.containerId) : undefined,
    category: e.category,
    amount: e.amount,
    currency: e.currency,
    description: e.description,
    evidenceUrls: e.evidenceUrls,
    recordedByUserId: String(e.recordedByUserId),
    status: e.status,
    approvedByUserId: e.approvedByUserId ? String(e.approvedByUserId) : undefined,
    approvedAt: e.approvedAt,
    rejectionReason: e.rejectionReason,
    createdAt: e.createdAt,
  };
}

const createExpenseSchema = z.object({
  containerId: z.string().optional(),
  category: z.enum(EXPENSE_CATEGORIES),
  amount: z.number().positive(),
  currency: z.string().trim().min(1).max(6).optional(),
  description: z.string().trim().optional(),
  evidenceUrls: z.array(z.string().url()).optional(),
});

export const createExpense = asyncHandler(async (req: Request, res: Response) => {
  const input = createExpenseSchema.parse(req.body);

  if (input.containerId) {
    const container = await ContainerModel.findOne({ _id: input.containerId, agencyId: req.auth!.agencyId });
    if (!container) throw AppError.notFound('Container not found');
  }

  const expense = await ExpenseModel.create({
    agencyId: req.auth!.agencyId,
    containerId: input.containerId,
    category: input.category,
    amount: input.amount,
    currency: input.currency || 'SLE',
    description: input.description,
    evidenceUrls: input.evidenceUrls || [],
    recordedByUserId: req.auth!.userId,
    status: 'pending',
  });

  const actor = await UserModel.findById(req.auth!.userId);
  await ActivityLogModel.create({
    agencyId: req.auth!.agencyId,
    containerId: input.containerId,
    actorName: actor?.name || 'User',
    actorUserId: actor?._id,
    action: 'expense_recorded',
    description: `${actor?.name || 'A staff member'} recorded a ${input.category} expense of ${expense.currency} ${input.amount}`,
    details: { expenseId: expense._id },
  });

  return ok(res, { expense: expenseShape(expense) }, 201);
});

export const listExpenses = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { agencyId: req.auth!.agencyId };
  if (req.query.containerId) filter.containerId = req.query.containerId;
  if (req.query.status) filter.status = req.query.status;
  if (req.query.category) filter.category = req.query.category;

  const expenses = await ExpenseModel.find(filter).sort({ createdAt: -1 }).limit(200);
  return ok(res, { expenses: expenses.map(expenseShape) });
});

const decisionSchema = z.object({ rejectionReason: z.string().trim().optional() });

// requireRole('owner', 'admin') is applied at the route level — a staff
// member can record an expense but not approve their own or anyone else's.
export const approveExpense = asyncHandler(async (req: Request, res: Response) => {
  const expense = await ExpenseModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!expense) throw AppError.notFound('Expense not found');
  if (expense.status !== 'pending') throw AppError.badRequest('Only a pending expense can be approved or rejected');

  expense.status = 'approved';
  expense.approvedByUserId = new Types.ObjectId(req.auth!.userId);
  expense.approvedAt = new Date();
  await expense.save();
  return ok(res, { expense: expenseShape(expense) });
});

export const rejectExpense = asyncHandler(async (req: Request, res: Response) => {
  const input = decisionSchema.parse(req.body);
  const expense = await ExpenseModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!expense) throw AppError.notFound('Expense not found');
  if (expense.status !== 'pending') throw AppError.badRequest('Only a pending expense can be approved or rejected');

  expense.status = 'rejected';
  expense.rejectionReason = input.rejectionReason;
  await expense.save();
  return ok(res, { expense: expenseShape(expense) });
});

const uploadUrlSchema = z.object({ contentType: z.string().min(1) });

export const getExpenseUploadUrl = asyncHandler(async (req: Request, res: Response) => {
  const { contentType } = uploadUrlSchema.parse(req.body);
  const presigned = await createPresignedUploadUrl('expense_evidence', contentType, req.auth!.agencyId!);
  return ok(res, presigned);
});
