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

function adminSummary(admin: { _id: unknown; name: string; email: string; isActive?: boolean; lastLoginAt?: Date; createdAt?: Date }) {
  return {
    id: String(admin._id),
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
  return ok(res, { admin: adminSummary(admin), ...tokens });
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export const adminRefresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const consumed = await consumeRefreshToken(refreshToken, 'admin-app');
  const admin = await PlatformAdminModel.findById(consumed.subjectId);
  if (!admin || !admin.isActive) throw AppError.unauthorized('Admin account is inactive or no longer exists');
  const tokens = await issueTokenPair({ audience: 'admin-app', subjectId: admin._id });
  return ok(res, tokens);
});

export const adminLogout = asyncHandler(async (req: Request, res: Response) => {
  await revokeAllForSubject(req.auth!.platformAdminId!, 'admin-app');
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

const createAdminSchema = z.object({ name: z.string().trim().min(1), email: z.string().trim().email(), password: z.string().min(8) });

export const createPlatformAdmin = asyncHandler(async (req: Request, res: Response) => {
  const input = createAdminSchema.parse(req.body);
  const existing = await PlatformAdminModel.findOne({ email: input.email.toLowerCase() });
  if (existing) throw AppError.conflict('An admin with that email already exists');
  const passwordHash = await hashPassword(input.password);
  const admin = await PlatformAdminModel.create({ name: input.name, email: input.email.toLowerCase(), passwordHash });
  return ok(res, { admin: adminSummary(admin) }, 201);
});

export const deactivatePlatformAdmin = asyncHandler(async (req: Request, res: Response) => {
  if (req.params.id === req.auth!.platformAdminId) {
    throw AppError.badRequest('You cannot deactivate your own account');
  }
  const admin = await PlatformAdminModel.findById(req.params.id);
  if (!admin) throw AppError.notFound('Admin not found');
  admin.isActive = false;
  await admin.save();
  await revokeAllForSubject(admin._id, 'admin-app');
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
  await revokeAllForAgency(agency._id);
  return ok(res, { message: 'Password reset. All staff sessions have been signed out.' });
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
  const [expenses, summary] = await Promise.all([
    ExpenseModel.find(filter).populate('agencyId', 'name agencyCode').populate('containerId', 'containerNumber').sort({ createdAt: -1 }),
    ExpenseModel.aggregate([
      { $match: status === 'all' ? {} : { status } },
      { $group: { _id: '$status', count: { $sum: 1 }, total: { $sum: '$amount' } } },
    ]),
  ]);

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

export const listPlans = asyncHandler(async (req: Request, res: Response) => {
  const plans = await SubscriptionPlanModel.find({ isActive: true }).sort({ amount: 1 });
  return ok(res, { plans: plans.map((p) => ({ id: p.planId, name: p.name, amount: p.amount, currency: p.currency, periodDays: p.periodDays, description: p.description })) });
});

// ---- drivers (platform admin view) ----

export const listDriversForAdmin = asyncHandler(async (req: Request, res: Response) => {
  const search = (req.query.search as string | undefined)?.trim();
  const filter = search ? { $or: [{ name: new RegExp(search, 'i') }, { phone: new RegExp(search, 'i') }] } : {};
  const drivers = await DriverModel.find(filter).sort({ createdAt: -1 });
  return ok(res, {
    drivers: drivers.map((d) => ({
      _id: String(d._id),
      name: d.name,
      phone: d.phone,
      verificationStatus: d.verificationStatus,
      availability: d.availability,
      isActive: d.isActive,
      ratingAverage: d.ratingCount > 0 ? Math.round((d.ratingTotal / d.ratingCount) * 10) / 10 : 0,
      ratingCount: d.ratingCount,
      createdAt: d.createdAt,
    })),
  });
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
    ? { $or: [{ businessName: new RegExp(search, 'i') }, { ownerName: new RegExp(search, 'i') }, { phone: new RegExp(search, 'i') }] }
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
