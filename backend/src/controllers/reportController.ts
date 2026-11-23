import { Request, Response } from 'express';
import { ContainerModel } from '../models/Container';
import { ExpenseModel } from '../models/Expense';
import { CargoDocumentModel } from '../models/CargoDocument';
import { TERMINAL_STATUSES } from '../constants/containerPipeline';
import { periodStart, summarizeContainers, summarizeExpenses } from '../services/reportService';
import { toCsv } from '../services/customs/customsRules';
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


// ---- Reports and exports ---------------------------------------------------
// What an agency can see about its own work, and spreadsheets of it. Everything
// is scoped to the signed-in agency. Expense figures are per currency, never
// converted or added across currencies.

const dateCell = (d?: Date) => (d ? d.toISOString().slice(0, 10) : '');

export const getReportSummary = asyncHandler(async (req: Request, res: Response) => {
  const agencyId = req.auth!.agencyId;
  const since = periodStart(req.query.days);

  const [containers, expenses, documents] = await Promise.all([
    ContainerModel.find({ agencyId }).select('status shippingLine attentionLevel createdAt'),
    ExpenseModel.find({ agencyId, ...(since ? { createdAt: { $gte: since } } : {}) }).select('category amount currency status'),
    CargoDocumentModel.find({ agencyId, deletedAt: null }).select('reviewStatus'),
  ]);

  const verified = documents.filter((d) => d.reviewStatus === 'verified').length;
  return ok(res, {
    since,
    containers: summarizeContainers(
      containers.map((c) => ({ status: c.status, shippingLine: c.shippingLine, attentionLevel: c.attentionLevel, createdAt: c.createdAt })),
      [...TERMINAL_STATUSES],
      since
    ),
    finance: summarizeExpenses(expenses.map((e) => ({ category: e.category, amount: e.amount, currency: e.currency, status: e.status }))),
    documents: { total: documents.length, verified, needsReview: documents.length - verified },
  });
});

export const exportContainersCsv = asyncHandler(async (req: Request, res: Response) => {
  const items = await ContainerModel.find({ agencyId: req.auth!.agencyId })
    .populate('importerId', 'name')
    .populate('blId', 'blNumber vesselName')
    .sort({ createdAt: -1 })
    .limit(5000);
  const header = ['Container number', 'Bill of lading', 'Client', 'Shipping line', 'Vessel', 'Size', 'Status', 'Attention', 'Reasons', 'Arrival', 'Discharged', 'Cleared', 'Delivered', 'Added'];
  const rows = items.map((c) => {
    const importer = c.importerId as unknown as { name?: string } | null;
    const bl = c.blId as unknown as { blNumber?: string; vesselName?: string } | null;
    return [c.containerNumber, bl?.blNumber, importer?.name, c.shippingLine, c.vessel || bl?.vesselName, c.size, c.status, c.attentionLevel, c.attentionReasons.join('; '), dateCell(c.dates.arrival), dateCell(c.dates.discharged), dateCell(c.dates.cleared), dateCell(c.dates.delivered), dateCell(c.createdAt)];
  });
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="containers-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(toCsv([header, ...rows]));
});

export const exportExpensesCsv = asyncHandler(async (req: Request, res: Response) => {
  const since = periodStart(req.query.days);
  const items = await ExpenseModel.find({ agencyId: req.auth!.agencyId, ...(since ? { createdAt: { $gte: since } } : {}) })
    .populate('containerId', 'containerNumber')
    .sort({ createdAt: -1 })
    .limit(5000);
  const header = ['Date', 'Container', 'Category', 'Description', 'Amount', 'Currency', 'Status'];
  const rows = items.map((e) => [dateCell(e.createdAt), (e.containerId as unknown as { containerNumber?: string } | null)?.containerNumber, e.category, e.description, e.amount, e.currency, e.status]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="expenses-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(toCsv([header, ...rows]));
});
