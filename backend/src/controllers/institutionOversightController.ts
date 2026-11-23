import { Request, Response } from 'express';
import { FilterQuery, Types } from 'mongoose';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { InstitutionAuditLogDoc, InstitutionAuditLogModel } from '../models/InstitutionAuditLog';
import { InstitutionUserModel } from '../models/InstitutionUser';
import { CustomsSubmissionModel } from '../models/CustomsSubmission';
import { toCsv } from '../services/customs/customsRules';

// Supervisors' oversight of Customs / AGL staff. Read-only by design: a
// supervisor can see what their staff did, but nothing here changes or deletes
// an entry. A supervisor only ever sees their OWN institution (Customs sees
// Customs staff, AGL sees AGL staff); the institution filter is forced from
// their account and cannot be overridden by a query parameter.

const querySchema = z.object({
  user: z.string().regex(/^[a-f0-9]{24}$/i).optional(),
  action: z.string().max(80).optional(), // exact (record.approve) or a family (record. / approved. / auth.)
  outcome: z.enum(['ok', 'denied', 'failed']).optional(),
  q: z.string().max(80).optional(), // container / CVC / name text
  from: z.string().optional(),
  to: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

const escapeRegex = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export function buildLogFilter(q: z.infer<typeof querySchema>, institution?: 'customs' | 'agl'): FilterQuery<InstitutionAuditLogDoc> {
  const filter: FilterQuery<InstitutionAuditLogDoc> = {};
  if (institution) filter.institution = institution;
  if (q.user) filter.institutionUserId = new Types.ObjectId(q.user);
  if (q.outcome) filter.outcome = q.outcome;
  if (q.action) filter.action = q.action.endsWith('.') ? new RegExp(`^${escapeRegex(q.action)}`) : q.action;
  if (q.q?.trim()) {
    const rx = new RegExp(escapeRegex(q.q.trim()), 'i');
    filter.$or = [{ userName: rx }, { targetLabel: rx }, { detail: rx }, { email: rx }];
  }
  const range: Record<string, Date> = {};
  if (q.from && !Number.isNaN(Date.parse(q.from))) range.$gte = new Date(q.from);
  if (q.to && !Number.isNaN(Date.parse(q.to))) range.$lte = new Date(new Date(q.to).getTime() + (/^\d{4}-\d{2}-\d{2}$/.test(q.to) ? 86400000 - 1 : 0));
  if (Object.keys(range).length) filter.createdAt = range;
  return filter;
}

export function logView(e: InstitutionAuditLogDoc) {
  return {
    id: String(e._id),
    at: e.createdAt,
    userId: e.institutionUserId ? String(e.institutionUserId) : undefined,
    userName: e.userName,
    email: e.email,
    institution: e.institution,
    action: e.action,
    outcome: e.outcome,
    statusCode: e.statusCode,
    targetId: e.targetId,
    targetLabel: e.targetLabel,
    detail: e.detail,
    ip: e.ip,
  };
}

export const listLog = asyncHandler(async (req: Request, res: Response) => {
  const q = querySchema.parse(req.query);
  const filter = buildLogFilter(q, req.auth!.institution);
  const [items, total] = await Promise.all([
    InstitutionAuditLogModel.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit),
    InstitutionAuditLogModel.countDocuments(filter),
  ]);
  return ok(res, { entries: items.map(logView), total, page: q.page, limit: q.limit });
});

export const exportLogCsv = asyncHandler(async (req: Request, res: Response) => {
  const q = querySchema.parse(req.query);
  const items = await InstitutionAuditLogModel.find(buildLogFilter(q, req.auth!.institution)).sort({ createdAt: -1 }).limit(10000);
  const header = ['Time (UTC)', 'Person', 'Email', 'Action', 'Outcome', 'Status', 'Record', 'Detail', 'IP'];
  const rows = items.map((e) => [e.createdAt.toISOString(), e.userName, e.email, e.action, e.outcome, e.statusCode, e.targetLabel, e.detail, e.ip]);
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="staff-activity-${new Date().toISOString().slice(0, 10)}.csv"`);
  res.send(toCsv([header, ...rows]));
});

// One row per staff member of the supervisor's institution: last sign-in, what
// they did in the last 30 days, and the things worth a second look (refused
// requests, failed sign-ins, Customs records an officer both entered and approved).
export const staffSummary = asyncHandler(async (req: Request, res: Response) => {
  const institution = req.auth!.institution!;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const staff = await InstitutionUserModel.find({ institution }).sort({ name: 1 });

  const counts = await InstitutionAuditLogModel.aggregate<{ _id: { u: Types.ObjectId; a: string; o: string }; n: number }>([
    { $match: { institution, institutionUserId: { $in: staff.map((s) => s._id) }, createdAt: { $gte: since } } },
    { $group: { _id: { u: '$institutionUserId', a: '$action', o: '$outcome' }, n: { $sum: 1 } } },
  ]);
  const tally = (id: Types.ObjectId, test: (a: string, o: string) => boolean) => counts.filter((c) => String(c._id.u) === String(id) && test(c._id.a, c._id.o)).reduce((sum, c) => sum + c.n, 0);

  const selfApproved = institution === 'customs'
    ? await CustomsSubmissionModel.aggregate<{ _id: Types.ObjectId; n: number }>([
        { $match: { status: 'approved', reviewedAt: { $gte: since }, enteredByInstitutionUserId: { $exists: true }, $expr: { $eq: ['$enteredByInstitutionUserId', '$reviewedByInstitutionUserId'] } } },
        { $group: { _id: '$reviewedByInstitutionUserId', n: { $sum: 1 } } },
      ])
    : [];

  return ok(res, {
    institution,
    since,
    staff: staff.map((s) => ({
      id: String(s._id),
      name: s.name,
      email: s.email,
      isActive: s.isActive,
      isSupervisor: !!s.isSupervisor,
      lastLoginAt: s.lastLoginAt,
      last30Days: {
        approvals: tally(s._id, (a, o) => a === 'record.approve' && o === 'ok'),
        returns: tally(s._id, (a, o) => a === 'record.return' && o === 'ok'),
        recordsViewed: tally(s._id, (a) => a === 'record.view' || a === 'approved.view'),
        exports: tally(s._id, (a, o) => a === 'approved.export_csv' && o === 'ok'),
        refusedRequests: tally(s._id, (_a, o) => o === 'denied'),
        failedSignIns: tally(s._id, (a, o) => a === 'auth.login' && o === 'failed'),
        selfApproved: selfApproved.find((r) => String(r._id) === String(s._id))?.n ?? 0,
      },
    })),
  });
});

export { querySchema as oversightQuerySchema };
