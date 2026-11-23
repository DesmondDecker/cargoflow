import { Request, Response } from 'express';
import { z } from 'zod';
import { FilterQuery } from 'mongoose';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { UserModel } from '../models/User';
import { InstitutionUserModel } from '../models/InstitutionUser';
import { CustomsSubmissionDoc, CustomsSubmissionModel, HistoryEntry } from '../models/CustomsSubmission';
import { getNextGlobalSequence } from '../models/GlobalCounter';
import {
  FIELD_LABELS,
  SUBMISSION_FIELDS,
  SubmissionInput,
  approvalReference,
  canTransition,
  checkSubmission,
  normalizeSubmission,
  summarize,
  toCsv,
} from '../services/customs/customsRules';
import { buildApprovalEmail } from '../services/customs/approvalEmail';
import { sendMail } from '../services/emailService';
import { pushToUser } from '../services/notifyService';

// The customs-verification handoff: an agent (or a Customs officer on the
// agent's behalf) submits six fields, a Customs officer approves or returns
// the record, and AGL sees approved records and is emailed. Cargo Flow never
// decides anything here: the officer's decision is recorded with who made it
// and when, and nothing touches AGL's own systems.

// ---------------------------------------------------------------- shaping

function view(s: CustomsSubmissionDoc) {
  const enteredBy = s.enteredByInstitutionUserId ? String(s.enteredByInstitutionUserId) : undefined;
  const reviewedBy = s.reviewedByInstitutionUserId ? String(s.reviewedByInstitutionUserId) : undefined;
  return {
    _id: String(s._id),
    cvcNumber: s.cvcNumber,
    billOfLadingNumber: s.billOfLadingNumber,
    shippingAgency: s.shippingAgency,
    containerNumber: s.containerNumber,
    documentName: s.documentName,
    itsNumber: s.itsNumber,
    source: s.source,
    submittedByName: s.submittedByName,
    onBehalfOf: s.onBehalfOf,
    status: s.status,
    submittedAt: s.submittedAt,
    submissionCount: s.submissionCount,
    approvalReference: s.approvalReference,
    reviewedByName: s.reviewedByName,
    reviewedAt: s.reviewedAt,
    returnReason: s.returnReason,
    // Shown so an assisted record that the same officer entered and approved is visible as such.
    selfApproved: !!enteredBy && enteredBy === reviewedBy,
    email: { status: s.email?.status ?? 'none', attemptedAt: s.email?.attemptedAt },
    history: s.history,
    createdAt: s.createdAt,
  };
}

function parseSubmission(body: unknown): { fields: SubmissionInput; warnings: string[] } {
  const raw = z.object(Object.fromEntries(SUBMISSION_FIELDS.map((f) => [f, z.unknown().optional()]))).parse(body ?? {});
  const fields = normalizeSubmission(raw as Record<string, unknown>);
  const { errors, warnings } = checkSubmission(fields);
  if (Object.keys(errors).length > 0) {
    throw AppError.badRequest(Object.values(errors).join('. '), 'SUBMISSION_INVALID', errors);
  }
  return { fields, warnings };
}

const duplicate = () => AppError.conflict('A record with this CVC number is already pending or approved.', 'DUPLICATE_CVC');
const isDuplicateKey = (err: unknown) => (err as { code?: number })?.code === 11000;

const entry = (actorType: HistoryEntry['actorType'], actorName: string, action: HistoryEntry['action'], note?: string): HistoryEntry => ({ at: new Date(), actorType, actorName, action, note });

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function searchFilter(q?: string): FilterQuery<CustomsSubmissionDoc> {
  const text = (q ?? '').trim();
  if (!text) return {};
  const rx = new RegExp(escapeRegex(text), 'i');
  return { $or: [{ cvcNumber: rx }, { billOfLadingNumber: rx }, { containerNumber: rx }, { itsNumber: rx }, { approvalReference: rx }, { shippingAgency: rx }] };
}

function dateRange(field: string, from?: string, to?: string): FilterQuery<CustomsSubmissionDoc> {
  const range: Record<string, Date> = {};
  if (from && !Number.isNaN(Date.parse(from))) range.$gte = new Date(from);
  if (to && !Number.isNaN(Date.parse(to))) range.$lte = new Date(new Date(to).getTime() + (/^\d{4}-\d{2}-\d{2}$/.test(to) ? 86400000 - 1 : 0));
  return Object.keys(range).length ? { [field]: range } : {};
}

// ------------------------------------------------------- agent (agency app)

export const createSubmission = asyncHandler(async (req: Request, res: Response) => {
  const { fields, warnings } = parseSubmission(req.body);
  const user = await UserModel.findById(req.auth!.userId);
  const name = user?.name || 'Agent';

  try {
    const submission = await CustomsSubmissionModel.create({
      ...fields,
      source: 'agent',
      agencyId: req.auth!.agencyId,
      submittedByUserId: req.auth!.userId,
      submittedByName: name,
      status: 'pending',
      activeCvc: fields.cvcNumber,
      history: [entry('agent', name, 'submitted')],
    });
    return ok(res, { submission: view(submission), warnings }, 201);
  } catch (err) {
    if (isDuplicateKey(err)) throw duplicate();
    throw err;
  }
});

export const listMySubmissions = asyncHandler(async (req: Request, res: Response) => {
  const status = z.enum(['pending', 'approved', 'returned']).optional().parse(req.query.status);
  const filter: FilterQuery<CustomsSubmissionDoc> = { agencyId: req.auth!.agencyId, ...(status ? { status } : {}) };
  const items = await CustomsSubmissionModel.find(filter).sort({ createdAt: -1 }).limit(100);
  return ok(res, { submissions: items.map(view) });
});

export const getMySubmission = asyncHandler(async (req: Request, res: Response) => {
  const s = await CustomsSubmissionModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!s) throw AppError.notFound('Submission not found');
  return ok(res, { submission: view(s) });
});

// A returned record is corrected and sent back through the queue.
export const resubmit = asyncHandler(async (req: Request, res: Response) => {
  const { fields, warnings } = parseSubmission(req.body);
  const existing = await CustomsSubmissionModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!existing) throw AppError.notFound('Submission not found');
  if (!canTransition(existing.status, 'resubmit')) throw AppError.badRequest('Only a returned record can be corrected and resubmitted', 'NOT_RETURNED');

  const user = await UserModel.findById(req.auth!.userId);
  try {
    const updated = await CustomsSubmissionModel.findOneAndUpdate(
      { _id: existing._id, status: 'returned' },
      {
        $set: { ...fields, status: 'pending', submittedAt: new Date(), activeCvc: fields.cvcNumber },
        $inc: { submissionCount: 1 },
        $unset: { returnReason: '', reviewedAt: '', reviewedByName: '', reviewedByInstitutionUserId: '' },
        $push: { history: entry('agent', user?.name || 'Agent', 'resubmitted') },
      },
      { new: true }
    );
    if (!updated) throw AppError.conflict('This record was changed by someone else. Reload and try again.', 'CONFLICT');
    return ok(res, { submission: view(updated), warnings });
  } catch (err) {
    if (isDuplicateKey(err)) throw duplicate();
    throw err;
  }
});

// ----------------------------------------------------------- Customs review

export const listQueue = asyncHandler(async (req: Request, res: Response) => {
  const status = z.enum(['pending', 'approved', 'returned']).default('pending').parse(req.query.status || undefined);
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const filter: FilterQuery<CustomsSubmissionDoc> = { status, ...searchFilter(req.query.q as string | undefined) };
  // First in, first out for the queue; most recent decision first for history.
  const sort: Record<string, 1 | -1> = status === 'pending' ? { submittedAt: 1 } : { reviewedAt: -1 };

  const [items, total, pending, returned, approved] = await Promise.all([
    CustomsSubmissionModel.find(filter).sort(sort).skip((page - 1) * limit).limit(limit),
    CustomsSubmissionModel.countDocuments(filter),
    CustomsSubmissionModel.countDocuments({ status: 'pending' }),
    CustomsSubmissionModel.countDocuments({ status: 'returned' }),
    CustomsSubmissionModel.countDocuments({ status: 'approved' }),
  ]);
  return ok(res, { submissions: items.map(view), total, page, limit, counts: { pending, returned, approved } });
});

export const getQueueItem = asyncHandler(async (req: Request, res: Response) => {
  const s = await CustomsSubmissionModel.findById(req.params.id);
  if (!s) throw AppError.notFound('Submission not found');
  return ok(res, { submission: view(s) });
});

const assistedSchema = z.object({ onBehalfOf: z.string().trim().min(2, 'Say who the agent is').max(160) });

// An agent who cannot or prefers not to submit on their own gives the details
// to an officer, who enters them. It goes into the same queue as any other
// record and is reviewed the same way; the history shows who keyed it in.
export const createAssisted = asyncHandler(async (req: Request, res: Response) => {
  const { onBehalfOf } = assistedSchema.parse(req.body);
  const { fields, warnings } = parseSubmission(req.body);
  const officer = await InstitutionUserModel.findById(req.auth!.institutionUserId);
  const name = officer?.name || 'Customs officer';

  try {
    const submission = await CustomsSubmissionModel.create({
      ...fields,
      source: 'customs_assisted',
      onBehalfOf,
      enteredByInstitutionUserId: req.auth!.institutionUserId,
      submittedByName: `${name} (for ${onBehalfOf})`,
      status: 'pending',
      activeCvc: fields.cvcNumber,
      history: [entry('customs', name, 'submitted', `Entered on behalf of ${onBehalfOf}`)],
    });
    return ok(res, { submission: view(submission), warnings }, 201);
  } catch (err) {
    if (isDuplicateKey(err)) throw duplicate();
    throw err;
  }
});

async function recipientsForApproval(): Promise<string[]> {
  const users = await InstitutionUserModel.find({ institution: 'agl', isActive: true, notifyByEmail: true });
  const extra = (process.env.AGL_NOTIFICATION_EMAILS || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return Array.from(new Set([...users.map((u) => u.email.toLowerCase()), ...extra]));
}

// Sends the approval email to AGL and records the outcome on the record. An
// email problem never undoes the approval; it is recorded, shown to Customs,
// and can be retried.
async function notifyAgl(id: unknown): Promise<void> {
  const s = await CustomsSubmissionModel.findById(id);
  if (!s || s.status !== 'approved' || !s.approvalReference || !s.reviewedAt) return;
  const to = await recipientsForApproval();
  const message = buildApprovalEmail(to, {
    fields: Object.fromEntries(SUBMISSION_FIELDS.map((f) => [f, s[f]])) as SubmissionInput,
    approvalReference: s.approvalReference,
    approvedAt: s.reviewedAt,
    approvedByName: s.reviewedByName || 'Customs officer',
    submittedByName: s.submittedByName,
    portalUrl: process.env.PORTAL_URL ? `${process.env.PORTAL_URL.replace(/\/$/, '')}/approved?q=${encodeURIComponent(s.approvalReference)}` : undefined,
  });
  const result = await sendMail(message);

  const attemptedAt = new Date();
  const email: CustomsSubmissionDoc['email'] =
    result.status === 'sent' ? { status: 'sent', attemptedAt, to } : result.status === 'failed' ? { status: 'failed', attemptedAt, to, error: result.error } : { status: 'not_configured', attemptedAt, to };
  const action = result.status === 'sent' ? 'email_sent' : result.status === 'failed' ? 'email_failed' : 'email_not_configured';
  const note = result.status === 'sent' ? `To ${to.join(', ')}` : result.status === 'failed' ? result.error : 'Email is not set up on this server';
  await CustomsSubmissionModel.updateOne({ _id: s._id }, { $set: { email }, $push: { history: entry('system', 'Cargo Flow', action, note) } });
}

export const approve = asyncHandler(async (req: Request, res: Response) => {
  const existing = await CustomsSubmissionModel.findById(req.params.id);
  if (!existing) throw AppError.notFound('Submission not found');
  if (!canTransition(existing.status, 'approve')) throw AppError.conflict(`This record is already ${existing.status}.`, 'ALREADY_DECIDED');

  const officer = await InstitutionUserModel.findById(req.auth!.institutionUserId);
  const now = new Date();
  const reference = approvalReference(now, await getNextGlobalSequence('customs-approval'));

  // Atomic: only a record that is still pending can be approved, so two
  // officers pressing Approve together cannot both succeed.
  const approved = await CustomsSubmissionModel.findOneAndUpdate(
    { _id: existing._id, status: 'pending' },
    {
      $set: { status: 'approved', approvalReference: reference, reviewedAt: now, reviewedByName: officer?.name || 'Customs officer', reviewedByInstitutionUserId: req.auth!.institutionUserId },
      $push: { history: entry('customs', officer?.name || 'Customs officer', 'approved', reference) },
    },
    { new: true }
  );
  if (!approved) throw AppError.conflict('This record was just decided by someone else.', 'ALREADY_DECIDED');

  await notifyAgl(approved._id);
  if (approved.source === 'agent') {
    await pushToUser(approved.submittedByUserId, 'Customs approved your submission', `${approved.containerNumber}: ${reference}`, { screen: 'CustomsSubmissions', submissionId: String(approved._id) });
  }
  const fresh = await CustomsSubmissionModel.findById(approved._id);
  return ok(res, { submission: view(fresh!) });
});

const returnSchema = z.object({ reason: z.string().trim().min(3, 'Say what needs correcting').max(500) });

export const returnSubmission = asyncHandler(async (req: Request, res: Response) => {
  const { reason } = returnSchema.parse(req.body);
  const existing = await CustomsSubmissionModel.findById(req.params.id);
  if (!existing) throw AppError.notFound('Submission not found');
  if (!canTransition(existing.status, 'return')) throw AppError.conflict(`This record is already ${existing.status}.`, 'ALREADY_DECIDED');

  const officer = await InstitutionUserModel.findById(req.auth!.institutionUserId);
  const name = officer?.name || 'Customs officer';
  const returned = await CustomsSubmissionModel.findOneAndUpdate(
    { _id: existing._id, status: 'pending' },
    {
      $set: { status: 'returned', returnReason: reason, reviewedAt: new Date(), reviewedByName: name, reviewedByInstitutionUserId: req.auth!.institutionUserId },
      $unset: { activeCvc: '' }, // frees the CVC number so the corrected record can be resubmitted
      $push: { history: entry('customs', name, 'returned', reason) },
    },
    { new: true }
  );
  if (!returned) throw AppError.conflict('This record was just decided by someone else.', 'ALREADY_DECIDED');

  if (returned.source === 'agent') {
    await pushToUser(returned.submittedByUserId, 'Customs returned your submission', `${returned.containerNumber}: ${reason}`, { screen: 'CustomsSubmissions', submissionId: String(returned._id) });
  }
  return ok(res, { submission: view(returned) });
});

export const resendEmail = asyncHandler(async (req: Request, res: Response) => {
  const s = await CustomsSubmissionModel.findById(req.params.id);
  if (!s) throw AppError.notFound('Submission not found');
  if (s.status !== 'approved') throw AppError.badRequest('Only an approved record has an email to send');
  await notifyAgl(s._id);
  return ok(res, { submission: view((await CustomsSubmissionModel.findById(s._id))!) });
});

// ----------------------------------------------- approved records (Customs + AGL)

function approvedFilter(req: Request): FilterQuery<CustomsSubmissionDoc> {
  return { status: 'approved', ...searchFilter(req.query.q as string | undefined), ...dateRange('reviewedAt', req.query.from as string | undefined, req.query.to as string | undefined) };
}

export const listApproved = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
  const filter = approvedFilter(req);
  const [items, total] = await Promise.all([
    CustomsSubmissionModel.find(filter).sort({ reviewedAt: -1 }).skip((page - 1) * limit).limit(limit),
    CustomsSubmissionModel.countDocuments(filter),
  ]);
  return ok(res, { submissions: items.map(view), total, page, limit });
});

export const getApproved = asyncHandler(async (req: Request, res: Response) => {
  const s = await CustomsSubmissionModel.findOne({ _id: req.params.id, status: 'approved' });
  if (!s) throw AppError.notFound('Approved record not found');
  return ok(res, { submission: view(s) });
});

export const exportApprovedCsv = asyncHandler(async (req: Request, res: Response) => {
  const items = await CustomsSubmissionModel.find(approvedFilter(req)).sort({ reviewedAt: -1 }).limit(5000);
  const header = ['Approval reference', 'Approved at (UTC)', 'Approved by', ...SUBMISSION_FIELDS.map((f) => FIELD_LABELS[f]), 'Submitted by', 'Source'];
  const rows = items.map((s) => [s.approvalReference, s.reviewedAt?.toISOString(), s.reviewedByName, ...SUBMISSION_FIELDS.map((f) => s[f]), s.submittedByName, s.source === 'agent' ? 'Agent' : 'Customs-assisted']);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="customs-approvals-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(toCsv([header, ...rows]));
});

export const reportSummary = asyncHandler(async (req: Request, res: Response) => {
  const to = req.query.to && !Number.isNaN(Date.parse(String(req.query.to))) ? new Date(String(req.query.to)) : new Date();
  const from = req.query.from && !Number.isNaN(Date.parse(String(req.query.from))) ? new Date(String(req.query.from)) : new Date(to.getTime() - 30 * 86400000);
  const records = await CustomsSubmissionModel.find({ submittedAt: { $gte: from, $lte: to } }).select('status submittedAt reviewedAt email source').limit(20000);

  const summary = summarize(records.map((r) => ({ status: r.status, submittedAt: r.submittedAt, reviewedAt: r.reviewedAt, emailSentAt: r.email?.status === 'sent' ? r.email.attemptedAt : undefined })));

  const byDay = new Map<string, { date: string; submitted: number; approved: number; returned: number }>();
  for (const r of records) {
    const day = r.submittedAt.toISOString().slice(0, 10);
    const row = byDay.get(day) || { date: day, submitted: 0, approved: 0, returned: 0 };
    row.submitted += 1;
    if (r.status === 'approved') row.approved += 1;
    if (r.status === 'returned') row.returned += 1;
    byDay.set(day, row);
  }
  return ok(res, {
    from,
    to,
    summary,
    assistedShare: records.length ? Math.round((records.filter((r) => r.source === 'customs_assisted').length / records.length) * 1000) / 10 : null,
    byDay: Array.from(byDay.values()).sort((a, b) => a.date.localeCompare(b.date)),
  });
});
