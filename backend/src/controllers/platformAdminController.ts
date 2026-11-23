import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { PlatformAdminModel } from '../models/PlatformAdmin';
import { AgencyModel, SubscriptionStatus } from '../models/Agency';
import { DriverModel } from '../models/Driver';
import { WarehouseModel } from '../models/Warehouse';
import { PaymentModel, PaymentStatus } from '../models/Payment';
import { GatewayDeviceModel } from '../models/GatewayDevice';
import { SubscriptionPlanModel } from '../models/SubscriptionPlan';
import { ContainerModel } from '../models/Container';
import { ExpenseModel, ExpenseStatus } from '../models/Expense';
import { hashPassword, comparePassword } from '../utils/password';
import { issueTokenPair, consumeRefreshToken, revokeAllForSubject, revokeAllForAgency } from '../services/tokenService';
import { summarizeExpenseStatuses } from '../utils/expenseSummary';
import crypto from 'crypto';
import { ADMIN_ROLES, AdminRole, checkAdminChange, effectiveRole } from '../services/adminAccess';
import { InstitutionAuditLogModel } from '../models/InstitutionAuditLog';
import { buildLogFilter, logView, oversightQuerySchema } from './institutionOversightController';
import { checkPinStrength } from '../services/pinRules';
import { readRefreshCookie, setRefreshCookie, clearRefreshCookie, requireCookieCsrfHeader } from '../utils/adminCookie';

const escapeRegex = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
import { InstitutionUserModel } from '../models/InstitutionUser';
import { institutionUserSummary } from './institutionAuthController';
import { AdminAuditLogModel } from '../models/AdminAuditLog';
import { CustomsSubmissionModel } from '../models/CustomsSubmission';
import { UserModel } from '../models/User';
import { TransportAssignmentModel } from '../models/TransportAssignment';
import { activeSince, weeklyCounts } from '../services/adoptionService';

function adminSummary(admin: { _id: unknown; name: string; email: string; isActive?: boolean; role?: string; lastLoginAt?: Date; createdAt?: Date }) {
  return {
    id: String(admin._id),
    role: effectiveRole(admin.role),
    name: admin.name,
    email: admin.email,
    isActive: admin.isActive,
    lastLoginAt: admin.lastLoginAt,
    createdAt: admin.createdAt,
  };
}

// ---- auth ----

const loginSchema = z.object({ email: z.string().trim().email(), password: z.string().min(1) });

export const adminLogin = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const admin = await PlatformAdminModel.findOne({ email: input.email.toLowerCase() });
  if (!admin || !admin.isActive) throw AppError.unauthorized('Email or password is incorrect', 'INVALID_CREDENTIALS');

  const matches = await comparePassword(input.password, admin.passwordHash);
  if (!matches) throw AppError.unauthorized('Email or password is incorrect', 'INVALID_CREDENTIALS');

  admin.lastLoginAt = new Date();
  await admin.save();

  const tokens = await issueTokenPair({ audience: 'admin-app', subjectId: admin._id });
  // The refresh token goes in an httpOnly cookie, out of reach of page scripts.
  setRefreshCookie(res, tokens.refreshToken);
  return ok(res, { admin: adminSummary(admin), accessToken: tokens.accessToken });
});

export const adminRefresh = asyncHandler(async (req: Request, res: Response) => {
  requireCookieCsrfHeader(req);
  const refreshToken = readRefreshCookie(req);
  if (!refreshToken) throw AppError.unauthorized('Not signed in', 'INVALID_REFRESH_TOKEN');
  const consumed = await consumeRefreshToken(refreshToken, 'admin-app');
  const admin = await PlatformAdminModel.findById(consumed.subjectId);
  if (!admin || !admin.isActive) {
    clearRefreshCookie(res);
    throw AppError.unauthorized('Admin account is inactive or no longer exists');
  }
  const tokens = await issueTokenPair({ audience: 'admin-app', subjectId: admin._id });
  setRefreshCookie(res, tokens.refreshToken);
  return ok(res, { admin: adminSummary(admin), accessToken: tokens.accessToken });
});

export const adminLogout = asyncHandler(async (req: Request, res: Response) => {
  requireCookieCsrfHeader(req);
  await revokeAllForSubject(req.auth!.platformAdminId!, 'admin-app');
  clearRefreshCookie(res);
  return ok(res, { message: 'Logged out' });
});

export const getOwnProfile = asyncHandler(async (req: Request, res: Response) => {
  const admin = await PlatformAdminModel.findById(req.auth!.platformAdminId);
  if (!admin) throw AppError.notFound('Admin not found');
  return ok(res, { admin: adminSummary(admin) });
});

const changeOwnPasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });

export const changeOwnPassword = asyncHandler(async (req: Request, res: Response) => {
  const input = changeOwnPasswordSchema.parse(req.body);
  const admin = await PlatformAdminModel.findById(req.auth!.platformAdminId);
  if (!admin) throw AppError.notFound('Admin not found');
  const matches = await comparePassword(input.currentPassword, admin.passwordHash);
  if (!matches) throw AppError.unauthorized('Current password is incorrect');
  admin.passwordHash = await hashPassword(input.newPassword);
  await admin.save();
  return ok(res, { message: 'Password updated' });
});

// ---- platform admin management (no public registration route) ----

export const listPlatformAdmins = asyncHandler(async (req: Request, res: Response) => {
  const admins = await PlatformAdminModel.find().sort({ createdAt: -1 });
  return ok(res, { admins: admins.map(adminSummary) });
});

const createAdminSchema = z.object({ name: z.string().trim().min(1), email: z.string().trim().email(), password: z.string().min(8), role: z.enum(ADMIN_ROLES).default('viewer') });

export const createPlatformAdmin = asyncHandler(async (req: Request, res: Response) => {
  const input = createAdminSchema.parse(req.body);
  const existing = await PlatformAdminModel.findOne({ email: input.email.toLowerCase() });
  if (existing) throw AppError.conflict('An admin with that email already exists');
  const passwordHash = await hashPassword(input.password);
  const admin = await PlatformAdminModel.create({ name: input.name, email: input.email.toLowerCase(), passwordHash, role: input.role });
  return ok(res, { admin: adminSummary(admin) }, 201);
});

export const deactivatePlatformAdmin = asyncHandler(async (req: Request, res: Response) => {
  if (req.params.id === req.auth!.platformAdminId) {
    throw AppError.badRequest('You cannot deactivate your own account');
  }
  const admin = await PlatformAdminModel.findById(req.params.id);
  if (!admin) throw AppError.notFound('Admin not found');
  const activeSupers = await countActiveSuperAdmins();
  const problem = checkAdminChange(req.auth!.platformAdminId!, { id: String(admin._id), role: effectiveRole(admin.role), isActive: !!admin.isActive }, { isActive: false }, activeSupers);
  if (problem) throw AppError.badRequest(problem);
  admin.isActive = false;
  await admin.save();
  await revokeAllForSubject(admin._id, 'admin-app');
  return ok(res, { admin: adminSummary(admin) });
});

// Accounts with no stored role count as super_admin, so count those too.
async function countActiveSuperAdmins(): Promise<number> {
  return PlatformAdminModel.countDocuments({ isActive: true, $or: [{ role: 'super_admin' }, { role: { $exists: false } }, { role: null }] });
}

const setRoleSchema = z.object({ role: z.enum(ADMIN_ROLES) });

export const setPlatformAdminRole = asyncHandler(async (req: Request, res: Response) => {
  const { role } = setRoleSchema.parse(req.body);
  const admin = await PlatformAdminModel.findById(req.params.id);
  if (!admin) throw AppError.notFound('Admin not found');
  const activeSupers = await countActiveSuperAdmins();
  const problem = checkAdminChange(req.auth!.platformAdminId!, { id: String(admin._id), role: effectiveRole(admin.role), isActive: !!admin.isActive }, { role: role as AdminRole }, activeSupers);
  if (problem) throw AppError.badRequest(problem);
  admin.role = role;
  await admin.save();
  return ok(res, { admin: adminSummary(admin) });
});

// ---- analytics ----

export const getAnalytics = asyncHandler(async (req: Request, res: Response) => {
  const [totalAgencies, agenciesByStatus, totalContainers, paymentsByStatus, pendingReviewCount, newAgenciesLast30Days, revenueAgg, revenueByMonth] =
    await Promise.all([
      AgencyModel.countDocuments(),
      AgencyModel.aggregate([{ $group: { _id: '$subscription.status', count: { $sum: 1 } } }]),
      ContainerModel.countDocuments(),
      PaymentModel.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      PaymentModel.countDocuments({ status: 'submitted' }),
      AgencyModel.countDocuments({ createdAt: { $gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }),
      PaymentModel.aggregate([
        { $match: { status: 'activated' } },
        { $group: { _id: null, total: { $sum: '$amountExpected' }, activatedCount: { $sum: 1 } } },
      ]),
      PaymentModel.aggregate([
        { $match: { status: 'activated', activatedAt: { $ne: null } } },
        {
          $group: {
            _id: { year: { $year: '$activatedAt' }, month: { $month: '$activatedAt' } },
            total: { $sum: '$amountExpected' },
            count: { $sum: 1 },
          },
        },
        { $sort: { '_id.year': 1, '_id.month': 1 } },
      ]),
    ]);

  return ok(res, {
    totalAgencies,
    agenciesByStatus,
    newAgenciesLast30Days,
    paymentsByStatus,
    revenue: { total: revenueAgg[0]?.total || 0, activatedCount: revenueAgg[0]?.activatedCount || 0 },
    revenueByMonth,
    totalContainers,
    pendingReviewCount,
  });
});

// ---- agencies ----

export const listAgencies = asyncHandler(async (req: Request, res: Response) => {
  const agencies = await AgencyModel.find().sort({ createdAt: -1 });
  return ok(res, {
    agencies: agencies.map((a) => ({
      _id: String(a._id),
      name: a.name,
      agencyCode: a.agencyCode,
      isActive: a.isActive,
      subscription: a.subscription,
      createdAt: a.createdAt,
    })),
  });
});

const updateSubscriptionSchema = z.object({
  status: z.enum(['trialing', 'active', 'expired', 'canceled']),
  currentPeriodEnd: z.string().datetime().optional(),
  note: z.string().optional(),
});

export const updateAgencySubscription = asyncHandler(async (req: Request, res: Response) => {
  const input = updateSubscriptionSchema.parse(req.body);
  const agency = await AgencyModel.findById(req.params.id);
  if (!agency) throw AppError.notFound('Agency not found');

  agency.subscription.status = input.status as SubscriptionStatus;
  if (input.currentPeriodEnd) agency.subscription.currentPeriodEnd = new Date(input.currentPeriodEnd);
  await agency.save();

  return ok(res, { subscription: agency.subscription });
});

const updateActiveSchema = z.object({ isActive: z.boolean(), note: z.string().optional() });

export const updateAgencyActive = asyncHandler(async (req: Request, res: Response) => {
  const input = updateActiveSchema.parse(req.body);
  const agency = await AgencyModel.findById(req.params.id);
  if (!agency) throw AppError.notFound('Agency not found');
  agency.isActive = input.isActive;
  await agency.save();
  if (!input.isActive) await revokeAllForAgency(agency._id);
  return ok(res, { agency: { id: String(agency._id), isActive: agency.isActive } });
});

const resetPasswordSchema = z.object({ newPassword: z.string().min(8) });

// The recovery path: agencies have no self-service "forgot password" (the
// password is a shared secret, not tied to any one person's email), so a
// platform admin force-setting it is the only way back in if it's lost.
export const resetAgencyPassword = asyncHandler(async (req: Request, res: Response) => {
  const input = resetPasswordSchema.parse(req.body);
  const agency = await AgencyModel.findById(req.params.id);
  if (!agency) throw AppError.notFound('Agency not found');
  agency.passwordHash = await hashPassword(input.newPassword);
  await agency.save();
  // This is the password new staff join with. People log in with their own PIN, so nobody is signed out.
  return ok(res, { message: 'Join password reset. Staff already signed in are not affected.' });
});

const resetOwnerPinSchema = z.object({ newPin: z.string().refine((v) => checkPinStrength(v) === null, { message: 'PIN must be 6 digits and not an easy one like 123456.' }) });

// Recovery path for an agency whose owner forgot their PIN and has no other owner
// to reset it. Sets a new PIN for the agency's only active owner; with several
// owners it refuses, because it would be a guess which one is meant.
export const resetAgencyOwnerPin = asyncHandler(async (req: Request, res: Response) => {
  const { newPin } = resetOwnerPinSchema.parse(req.body);
  const agency = await AgencyModel.findById(req.params.id);
  if (!agency) throw AppError.notFound('Agency not found');
  const owners = await UserModel.find({ agencyId: agency._id, role: 'owner', isActive: true });
  if (owners.length === 0) throw AppError.badRequest('This agency has no active owner.');
  if (owners.length > 1) throw AppError.badRequest('This agency has several owners: one of them can reset the others from the app (Users & Permissions).');
  const owner = owners[0];
  owner.pinHash = await hashPassword(newPin);
  owner.pinFailedAttempts = 0;
  owner.pinLockedUntil = undefined;
  await owner.save();
  await revokeAllForSubject(owner._id, 'agency-app');
  return ok(res, { message: `PIN reset for ${owner.name}. Tell them the new PIN directly.` });
});

// ---- payments ----

export const listPayments = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as PaymentStatus | undefined;
  const filter = status ? { status } : {};
  const payments = await PaymentModel.find(filter).populate('agencyId', 'name').sort({ createdAt: -1 });
  return ok(res, { payments });
});

export const verifyPayment = asyncHandler(async (req: Request, res: Response) => {
  const payment = await PaymentModel.findById(req.params.id);
  if (!payment) throw AppError.notFound('Payment not found');
  if (payment.status !== 'submitted') throw AppError.badRequest('Only a submitted payment can be verified');

  payment.status = 'verified';
  payment.verificationMethod = payment.verificationMethod || 'manual';
  payment.verifiedAt = new Date();
  await payment.save();

  // Manual verification activates the subscription directly — the
  // auto-SMS-match + activation-code path is the same end state via a
  // different route (see gatewayController), not implemented in this pass.
  const agency = await AgencyModel.findById(payment.agencyId);
  if (agency) {
    const plan = await SubscriptionPlanModel.findOne({ planId: payment.planId });
    agency.subscription.status = 'active';
    agency.subscription.planId = payment.planId;
    agency.subscription.currentPeriodEnd = new Date(Date.now() + (plan?.periodDays || 30) * 24 * 60 * 60 * 1000);
    await agency.save();
    payment.status = 'activated';
    payment.activatedAt = new Date();
    await payment.save();
  }

  return ok(res, { payment });
});

const rejectPaymentSchema = z.object({ reason: z.string().trim().min(1) });

export const rejectPayment = asyncHandler(async (req: Request, res: Response) => {
  const input = rejectPaymentSchema.parse(req.body);
  const payment = await PaymentModel.findById(req.params.id);
  if (!payment) throw AppError.notFound('Payment not found');
  payment.status = 'rejected';
  payment.rejectionReason = input.reason;
  await payment.save();
  return ok(res, { payment });
});

// ---- expenses ----

export const listExpensesForAdmin = asyncHandler(async (req: Request, res: Response) => {
  const status = (req.query.status as ExpenseStatus | 'all' | undefined) || 'all';
  const filter = status === 'all' ? {} : { status };
  const expenses = await ExpenseModel.find(filter).populate('agencyId', 'name agencyCode').populate('containerId', 'containerNumber').sort({ createdAt: -1 });

  const statusSummary = summarizeExpenseStatuses(expenses.map((e) => ({ status: e.status, amount: e.amount })));
  return ok(res, {
    expenses: expenses.map((expense) => ({
      _id: String(expense._id),
      agencyId: expense.agencyId,
      containerId: expense.containerId,
      category: expense.category,
      amount: expense.amount,
      currency: expense.currency,
      description: expense.description,
      evidenceUrls: expense.evidenceUrls,
      status: expense.status,
      rejectionReason: expense.rejectionReason,
      createdAt: expense.createdAt,
      approvedAt: expense.approvedAt,
    })),
    summary: status === 'all' ? statusSummary : {
      pending: status === 'pending' ? { count: statusSummary.pending.count, total: statusSummary.pending.total } : { count: 0, total: 0 },
      approved: status === 'approved' ? { count: statusSummary.approved.count, total: statusSummary.approved.total } : { count: 0, total: 0 },
      rejected: status === 'rejected' ? { count: statusSummary.rejected.count, total: statusSummary.rejected.total } : { count: 0, total: 0 },
      total: expenses.length,
    },
  });
});

export const approveExpenseForAdmin = asyncHandler(async (req: Request, res: Response) => {
  const expense = await ExpenseModel.findById(req.params.id);
  if (!expense) throw AppError.notFound('Expense not found');
  if (expense.status !== 'pending') throw AppError.badRequest('Only a pending expense can be approved');

  expense.status = 'approved';
  expense.approvedAt = new Date();
  await expense.save();

  return ok(res, { expense: {
    _id: String(expense._id),
    agencyId: expense.agencyId,
    containerId: expense.containerId,
    category: expense.category,
    amount: expense.amount,
    currency: expense.currency,
    description: expense.description,
    evidenceUrls: expense.evidenceUrls,
    status: expense.status,
    rejectionReason: expense.rejectionReason,
    createdAt: expense.createdAt,
    approvedAt: expense.approvedAt,
  } });
});

export const rejectExpenseForAdmin = asyncHandler(async (req: Request, res: Response) => {
  const input = z.object({ reason: z.string().trim().min(1) }).parse(req.body);
  const expense = await ExpenseModel.findById(req.params.id);
  if (!expense) throw AppError.notFound('Expense not found');
  if (expense.status !== 'pending') throw AppError.badRequest('Only a pending expense can be rejected');

  expense.status = 'rejected';
  expense.rejectionReason = input.reason;
  await expense.save();

  return ok(res, { expense: {
    _id: String(expense._id),
    agencyId: expense.agencyId,
    containerId: expense.containerId,
    category: expense.category,
    amount: expense.amount,
    currency: expense.currency,
    description: expense.description,
    evidenceUrls: expense.evidenceUrls,
    status: expense.status,
    rejectionReason: expense.rejectionReason,
    createdAt: expense.createdAt,
    approvedAt: expense.approvedAt,
  } });
});

// ---- gateway devices ----

export const listGatewayDevices = asyncHandler(async (req: Request, res: Response) => {
  const devices = await GatewayDeviceModel.find().sort({ createdAt: -1 });
  return ok(res, { devices });
});

const createGatewayDeviceSchema = z.object({ name: z.string().trim().min(1) });

export const createGatewayDevice = asyncHandler(async (req: Request, res: Response) => {
  const input = createGatewayDeviceSchema.parse(req.body);
  const apiKey = crypto.randomBytes(24).toString('hex');
  const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
  const device = await GatewayDeviceModel.create({ name: input.name, apiKeyHash });
  // The raw key is only ever returned here, at creation — it's not
  // recoverable afterward (only the hash is stored), same pattern as the
  // agency password reset flow: shown once, share it directly.
  return ok(res, { device, apiKey }, 201);
});

export const deactivateGatewayDevice = asyncHandler(async (req: Request, res: Response) => {
  const device = await GatewayDeviceModel.findById(req.params.id);
  if (!device) throw AppError.notFound('Device not found');
  device.isActive = false;
  await device.save();
  return ok(res, { device });
});

// ---- plans ----

const planShape = (p: { planId: string; name: string; amount: number; currency: string; periodDays: number; description?: string; isActive: boolean }) => ({
  id: p.planId,
  name: p.name,
  amount: p.amount,
  currency: p.currency,
  periodDays: p.periodDays,
  description: p.description,
  isActive: p.isActive,
});

export const listPlans = asyncHandler(async (req: Request, res: Response) => {
  const includeInactive = req.query.includeInactive === '1';
  const plans = await SubscriptionPlanModel.find(includeInactive ? {} : { isActive: true }).sort({ amount: 1 });
  return ok(res, { plans: plans.map(planShape) });
});

// Plan editing. A change applies to payments made from then on; agencies
// already subscribed keep what they paid for until it ends.
const planFields = {
  name: z.string().trim().min(2).max(80),
  amount: z.number().min(0).max(1_000_000_000),
  currency: z.string().trim().length(3),
  periodDays: z.number().int().min(1).max(3650),
  description: z.string().trim().max(300),
  isActive: z.boolean(),
};

export const createPlan = asyncHandler(async (req: Request, res: Response) => {
  const input = z
    .object({ planId: z.string().trim().min(2).max(40).regex(/^[a-z0-9_-]+$/, 'Use lowercase letters, digits, - or _'), ...planFields, description: planFields.description.optional(), isActive: planFields.isActive.optional() })
    .parse(req.body);
  if (await SubscriptionPlanModel.findOne({ planId: input.planId })) throw AppError.conflict('A plan with this id already exists', 'PLAN_EXISTS');
  const plan = await SubscriptionPlanModel.create({ ...input, currency: input.currency.toUpperCase(), description: input.description ?? '' });
  return ok(res, { plan: planShape(plan) }, 201);
});

export const updatePlan = asyncHandler(async (req: Request, res: Response) => {
  const patch = z.object(planFields).partial().parse(req.body);
  if (Object.keys(patch).length === 0) throw AppError.badRequest('Nothing to change');
  if (patch.currency) patch.currency = patch.currency.toUpperCase();
  const plan = await SubscriptionPlanModel.findOneAndUpdate({ planId: req.params.planId }, { $set: patch }, { new: true });
  if (!plan) throw AppError.notFound('Plan not found');
  return ok(res, { plan: planShape(plan) });
});

// ---- audit log and adoption ----

export const listAuditLog = asyncHandler(async (req: Request, res: Response) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 50));
  const q = (req.query.q as string | undefined)?.trim();
  const filter = q ? { $or: [{ adminName: new RegExp(escapeRegex(q), 'i') }, { path: new RegExp(escapeRegex(q), 'i') }] } : {};
  const [items, total] = await Promise.all([AdminAuditLogModel.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit), AdminAuditLogModel.countDocuments(filter)]);
  return ok(res, {
    total,
    page,
    limit,
    entries: items.map((e) => ({ _id: String(e._id), adminName: e.adminName, method: e.method, route: e.route, path: e.path, summary: e.summary, statusCode: e.statusCode, createdAt: e.createdAt })),
  });
});

// Registered vs active, side by side. Active = someone from the agency signed
// in during the last 30 days (drivers: had job activity). Growth is weekly for
// the last 12 weeks.
export const getAdoption = asyncHandler(async (_req: Request, res: Response) => {
  const since30 = activeSince(30);
  const since12w = activeSince(12 * 7 + 7);
  const [agencies, users, activeUsers, drivers, verifiedDrivers, activeDriverIds, customsTotal, customsApproved, newAgencies, newUsers, newContainers, newSubmissions] = await Promise.all([
    AgencyModel.countDocuments(),
    UserModel.countDocuments({ isActive: true }),
    UserModel.find({ isActive: true, lastLoginAt: { $gte: since30 } }).select('agencyId'),
    DriverModel.countDocuments({ isActive: true }),
    DriverModel.countDocuments({ isActive: true, verificationStatus: 'verified' }),
    TransportAssignmentModel.distinct('driverId', { updatedAt: { $gte: since30 } }),
    CustomsSubmissionModel.countDocuments(),
    CustomsSubmissionModel.countDocuments({ status: 'approved' }),
    AgencyModel.find({ createdAt: { $gte: since12w } }).select('createdAt').limit(50000),
    UserModel.find({ createdAt: { $gte: since12w } }).select('createdAt').limit(50000),
    ContainerModel.find({ createdAt: { $gte: since12w } }).select('createdAt').limit(50000),
    CustomsSubmissionModel.find({ createdAt: { $gte: since12w } }).select('createdAt').limit(50000),
  ]);
  return ok(res, {
    registered: { agencies, users, drivers, verifiedDrivers },
    active30Days: { agencies: new Set(activeUsers.map((u) => String(u.agencyId))).size, users: activeUsers.length, drivers: activeDriverIds.length },
    customs: { submitted: customsTotal, approved: customsApproved },
    weekly: {
      agencies: weeklyCounts(newAgencies.map((a) => a.createdAt), 12),
      users: weeklyCounts(newUsers.map((u) => u.createdAt), 12),
      containers: weeklyCounts(newContainers.map((c) => c.createdAt), 12),
      customsSubmissions: weeklyCounts(newSubmissions.map((c) => c.createdAt), 12),
    },
  });
});

// ---- drivers (platform admin view) ----

export const listDriversForAdmin = asyncHandler(async (req: Request, res: Response) => {
  const search = (req.query.search as string | undefined)?.trim();
  const filter = search ? { $or: [{ name: new RegExp(escapeRegex(search), 'i') }, { phone: new RegExp(escapeRegex(search), 'i') }] } : {};
  const drivers = await DriverModel.find(filter).sort({ createdAt: -1 });
  return ok(res, {
    drivers: drivers.map((d) => ({
      _id: String(d._id),
      name: d.name,
      phone: d.phone,
      verificationStatus: d.verificationStatus,
      licenseDocumentUrl: d.licenseDocumentUrl,
      sponsored: d.sponsored,
      sponsoredUntil: d.sponsoredUntil,
      location: d.location,
      yearsExperience: d.yearsExperience,
      availability: d.availability,
      isActive: d.isActive,
      ratingAverage: d.ratingCount > 0 ? Math.round((d.ratingTotal / d.ratingCount) * 10) / 10 : 0,
      ratingCount: d.ratingCount,
      createdAt: d.createdAt,
    })),
  });
});

const setDriverVerificationSchema = z.object({ verificationStatus: z.enum(['unverified', 'pending', 'verified', 'rejected']) });

export const setDriverVerification = asyncHandler(async (req: Request, res: Response) => {
  const { verificationStatus } = setDriverVerificationSchema.parse(req.body);
  const driver = await DriverModel.findByIdAndUpdate(req.params.id, { $set: { verificationStatus } }, { new: true });
  if (!driver) throw AppError.notFound('Driver not found');
  return ok(res, { driver: { _id: String(driver._id), verificationStatus: driver.verificationStatus } });
});

// ---- Customs / AGL accounts -------------------------------------------------
// The institutions' own staff, created here (not self-registered) so that only
// people the institution has nominated can reach the customs workflow.

const createInstitutionUserSchema = z.object({
  name: z.string().trim().min(2).max(120),
  email: z.string().trim().email(),
  institution: z.enum(['customs', 'agl']),
  password: z.string().min(10).max(100),
  notifyByEmail: z.boolean().optional(),
  isSupervisor: z.boolean().optional(),
});

export const listInstitutionUsers = asyncHandler(async (_req: Request, res: Response) => {
  const users = await InstitutionUserModel.find().sort({ institution: 1, name: 1 });
  return ok(res, { users: users.map((u) => ({ ...institutionUserSummary(u), lastLoginAt: u.lastLoginAt, createdAt: u.createdAt })) });
});

export const createInstitutionUser = asyncHandler(async (req: Request, res: Response) => {
  const input = createInstitutionUserSchema.parse(req.body);
  if (await InstitutionUserModel.findOne({ email: input.email.toLowerCase() })) throw AppError.conflict('An account with this email already exists', 'EMAIL_TAKEN');
  const user = await InstitutionUserModel.create({
    name: input.name,
    email: input.email,
    institution: input.institution,
    passwordHash: await hashPassword(input.password),
    notifyByEmail: input.notifyByEmail ?? true,
    isSupervisor: input.isSupervisor ?? false,
  });
  return ok(res, { user: institutionUserSummary(user) }, 201);
});

const updateInstitutionUserSchema = z.object({
  name: z.string().trim().min(2).max(120).optional(),
  isActive: z.boolean().optional(),
  notifyByEmail: z.boolean().optional(),
  isSupervisor: z.boolean().optional(),
});

export const updateInstitutionUser = asyncHandler(async (req: Request, res: Response) => {
  const input = updateInstitutionUserSchema.parse(req.body);
  const user = await InstitutionUserModel.findByIdAndUpdate(req.params.id, { $set: input }, { new: true });
  if (!user) throw AppError.notFound('User not found');
  if (input.isActive === false) await revokeAllForSubject(user._id, 'institution-portal');
  return ok(res, { user: institutionUserSummary(user) });
});

export const resetInstitutionUserPassword = asyncHandler(async (req: Request, res: Response) => {
  const { password } = z.object({ password: z.string().min(10).max(100) }).parse(req.body);
  const user = await InstitutionUserModel.findById(req.params.id);
  if (!user) throw AppError.notFound('User not found');
  user.passwordHash = await hashPassword(password);
  await user.save();
  await revokeAllForSubject(user._id, 'institution-portal');
  return ok(res, { message: 'Password reset' });
});

export const resetDriverPassword = asyncHandler(async (req: Request, res: Response) => {
  const input = resetPasswordSchema.parse(req.body);
  const driver = await DriverModel.findById(req.params.id);
  if (!driver) throw AppError.notFound('Driver not found');
  driver.passwordHash = await hashPassword(input.newPassword);
  await driver.save();
  await revokeAllForSubject(driver._id, 'driver-app');
  return ok(res, { message: 'Password reset.' });
});

// ---- warehouses (platform admin view) ----
// Same reasoning as drivers: a listing starts unverified and never appears
// in an agency's "Find Storage" results until an admin moves it forward
// here — the check that keeps agencies from booking space with someone
// who was never vetted.

export const listWarehousesForAdmin = asyncHandler(async (req: Request, res: Response) => {
  const search = (req.query.search as string | undefined)?.trim();
  const filter = search
    ? { $or: [{ businessName: new RegExp(escapeRegex(search), 'i') }, { ownerName: new RegExp(escapeRegex(search), 'i') }, { phone: new RegExp(escapeRegex(search), 'i') }] }
    : {};
  const warehouses = await WarehouseModel.find(filter).sort({ createdAt: -1 });
  return ok(res, {
    warehouses: warehouses.map((w) => ({
      _id: String(w._id),
      businessName: w.businessName,
      ownerName: w.ownerName,
      phone: w.phone,
      location: w.location,
      capacityUnit: w.capacityUnit,
      totalCapacity: w.totalCapacity,
      availableCapacity: w.availableCapacity,
      verificationStatus: w.verificationStatus,
      isActive: w.isActive,
      ratingAverage: w.ratingCount > 0 ? Math.round((w.ratingTotal / w.ratingCount) * 10) / 10 : 0,
      ratingCount: w.ratingCount,
      sponsored: w.sponsored,
      sponsoredUntil: w.sponsoredUntil,
      createdAt: w.createdAt,
    })),
  });
});

const setVerificationSchema = z.object({ verificationStatus: z.enum(['unverified', 'pending', 'verified', 'rejected']) });

export const setWarehouseVerification = asyncHandler(async (req: Request, res: Response) => {
  const { verificationStatus } = setVerificationSchema.parse(req.body);
  const warehouse = await WarehouseModel.findByIdAndUpdate(req.params.id, { $set: { verificationStatus } }, { new: true });
  if (!warehouse) throw AppError.notFound('Warehouse not found');
  return ok(res, { warehouse: { _id: String(warehouse._id), verificationStatus: warehouse.verificationStatus } });
});

export const resetWarehousePassword = asyncHandler(async (req: Request, res: Response) => {
  const input = resetPasswordSchema.parse(req.body);
  const warehouse = await WarehouseModel.findById(req.params.id);
  if (!warehouse) throw AppError.notFound('Warehouse not found');
  warehouse.passwordHash = await hashPassword(input.newPassword);
  await warehouse.save();
  await revokeAllForSubject(warehouse._id, 'warehouse-app');
  return ok(res, { message: 'Password reset.' });
});

// ---- sponsorship (paid placement boost — no self-service payment flow
// yet, so this is a platform-admin action taken after a driver/warehouse
// pays outside the app, same way verification works) ----

const setSponsorshipSchema = z.object({
  sponsored: z.boolean(),
  sponsoredUntil: z.string().datetime().nullable(),
});

export const setWarehouseSponsorship = asyncHandler(async (req: Request, res: Response) => {
  const input = setSponsorshipSchema.parse(req.body);
  if (input.sponsored && !input.sponsoredUntil) {
    throw AppError.badRequest('sponsoredUntil is required when turning sponsorship on — a boost needs an end date');
  }
  const warehouse = await WarehouseModel.findByIdAndUpdate(
    req.params.id,
    { $set: { sponsored: input.sponsored, sponsoredUntil: input.sponsoredUntil ? new Date(input.sponsoredUntil) : null } },
    { new: true }
  );
  if (!warehouse) throw AppError.notFound('Warehouse not found');
  return ok(res, { warehouse: { _id: String(warehouse._id), sponsored: warehouse.sponsored, sponsoredUntil: warehouse.sponsoredUntil } });
});

export const setDriverSponsorship = asyncHandler(async (req: Request, res: Response) => {
  const input = setSponsorshipSchema.parse(req.body);
  if (input.sponsored && !input.sponsoredUntil) {
    throw AppError.badRequest('sponsoredUntil is required when turning sponsorship on — a boost needs an end date');
  }
  const driver = await DriverModel.findByIdAndUpdate(
    req.params.id,
    { $set: { sponsored: input.sponsored, sponsoredUntil: input.sponsoredUntil ? new Date(input.sponsoredUntil) : null } },
    { new: true }
  );
  if (!driver) throw AppError.notFound('Driver not found');
  return ok(res, { driver: { _id: String(driver._id), sponsored: driver.sponsored, sponsoredUntil: driver.sponsoredUntil } });
});

// Platform-wide view of the Customs/AGL supervisors' log (both institutions, and the
// supervisors' own activity, so the people doing the oversight are overseen too).
export const listInstitutionAudit = asyncHandler(async (req: Request, res: Response) => {
  const q = oversightQuerySchema.parse(req.query);
  const institution = req.query.institution === 'customs' || req.query.institution === 'agl' ? req.query.institution : undefined;
  const filter = buildLogFilter(q, institution);
  const [items, total] = await Promise.all([
    InstitutionAuditLogModel.find(filter).sort({ createdAt: -1 }).skip((q.page - 1) * q.limit).limit(q.limit),
    InstitutionAuditLogModel.countDocuments(filter),
  ]);
  return ok(res, { entries: items.map(logView), total, page: q.page, limit: q.limit });
});
