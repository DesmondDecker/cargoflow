import crypto from 'crypto';
import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { AgencyModel } from '../models/Agency';
import { UserModel } from '../models/User';
import { hashPassword, comparePassword } from '../utils/password';
import { issueTokenPair, consumeRefreshToken, revokeAllForSubject } from '../services/tokenService';
import { ActivityLogModel } from '../models/ActivityLog';
import { checkPinStrength, isLocked, afterFailure, afterSuccess, canResetPin, PIN_LOCK_MINUTES } from '../services/pinRules';

function generateAgencyCode(): string {
  // 6 chars, unambiguous alphabet (no 0/O/1/I) — matches the "e.g. K3F9XQ" placeholder shown in the app.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[crypto.randomInt(alphabet.length)];
  return code;
}

async function uniqueAgencyCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateAgencyCode();
    const existing = await AgencyModel.findOne({ agencyCode: code });
    if (!existing) return code;
  }
  throw AppError.internal('Could not generate a unique agency code, please retry');
}

function agencySummary(agency: { _id: unknown; name: string; agencyCode: string }) {
  return { id: String(agency._id), name: agency.name, agencyCode: agency.agencyCode };
}

function userSummary(user: {
  _id: unknown;
  agencyId: unknown;
  name: string;
  phone?: string;
  email?: string;
  role: string;
  isActive: boolean;
  lastLoginAt?: Date;
}) {
  return {
    id: String(user._id),
    agencyId: String(user.agencyId),
    name: user.name,
    phone: user.phone,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    lastLoginAt: user.lastLoginAt,
  };
}

const pinField = z.string().refine((v) => checkPinStrength(v) === null, { message: 'PIN must be 6 digits and not an easy one like 123456.' });

const registerSchema = z.object({
  agencyName: z.string().trim().min(1),
  ownerName: z.string().trim().min(1),
  ownerPhone: z.string().trim().optional(),
  ownerEmail: z.string().trim().email().optional(),
  password: z.string().min(8), // agency join password: only used to let new staff join
  pin: pinField, // the owner's own login PIN
  deviceId: z.string().optional(),
  deviceLabel: z.string().optional(),
});

// registerAgency creates BOTH the Agency and its first User (owner) — if the
// second write fails, the first must not be left behind as an orphan with no
// way to log in and no way for the owner to retry (the agency code would
// already be taken). A Mongo transaction requires a replica set, which this
// project deliberately doesn't run (see docker-compose.yml), so instead: on
// any failure after the Agency is created, delete it before rethrowing.
export const registerAgency = asyncHandler(async (req: Request, res: Response) => {
  const input = registerSchema.parse(req.body);

  const agencyCode = await uniqueAgencyCode();
  const passwordHash = await hashPassword(input.password);
  const agency = await AgencyModel.create({ name: input.agencyName, agencyCode, passwordHash });

  try {
    const user = await UserModel.create({
      agencyId: agency._id,
      name: input.ownerName,
      phone: input.ownerPhone,
      email: input.ownerEmail,
      role: 'owner',
      pinHash: await hashPassword(input.pin),
      lastLoginAt: new Date(),
    });

    await ActivityLogModel.create({
      agencyId: agency._id,
      actorName: user.name,
      actorUserId: user._id,
      action: 'agency_registered',
      description: `${user.name} registered ${agency.name} on CargoFlow`,
    });

    const tokens = await issueTokenPair({
      audience: 'agency-app',
      subjectId: user._id,
      agencyId: agency._id,
      role: user.role,
      deviceId: input.deviceId,
    });

    return ok(res, { agency: agencySummary(agency), user: userSummary(user), ...tokens }, 201);
  } catch (err) {
    await AgencyModel.deleteOne({ _id: agency._id });
    throw err;
  }
});

const joinSchema = z.object({
  agencyCode: z.string().trim().min(1),
  password: z.string().min(1),
  pin: pinField, // the new person's own login PIN
  name: z.string().trim().min(1),
  phone: z.string().trim().optional(),
  email: z.string().trim().email().optional(),
  deviceId: z.string().optional(),
  deviceLabel: z.string().optional(),
});

export const joinAgency = asyncHandler(async (req: Request, res: Response) => {
  const input = joinSchema.parse(req.body);

  const agency = await AgencyModel.findOne({ agencyCode: input.agencyCode.trim().toUpperCase() });
  if (!agency) throw AppError.unauthorized('Agency code or password is incorrect', 'INVALID_CREDENTIALS');
  if (!agency.isActive) throw AppError.forbidden('This agency account is suspended', 'AGENCY_SUSPENDED');

  const passwordMatches = await comparePassword(input.password, agency.passwordHash);
  if (!passwordMatches) throw AppError.unauthorized('Agency code or password is incorrect', 'INVALID_CREDENTIALS');

  const existingByName = await UserModel.findOne({ agencyId: agency._id, name: input.name }).collation({ locale: 'en', strength: 2 });
  if (existingByName) {
    throw AppError.conflict('Someone in this agency already uses that name — ask your supervisor, or enter your name slightly differently.', 'NAME_TAKEN');
  }

  const user = await UserModel.create({
    agencyId: agency._id,
    name: input.name,
    phone: input.phone,
    email: input.email,
    role: 'staff',
    pinHash: await hashPassword(input.pin),
    lastLoginAt: new Date(),
  });

  await ActivityLogModel.create({
    agencyId: agency._id,
    actorName: user.name,
    actorUserId: user._id,
    action: 'staff_joined',
    description: `${user.name} joined the agency`,
  });

  const tokens = await issueTokenPair({
    audience: 'agency-app',
    subjectId: user._id,
    agencyId: agency._id,
    role: user.role,
    deviceId: input.deviceId,
  });

  return ok(res, { agency: agencySummary(agency), user: userSummary(user), ...tokens }, 201);
});

const loginSchema = z.object({
  agencyCode: z.string().trim().min(1),
  identifier: z.string().trim().min(1), // name or phone
  pin: z.string().min(1),
  deviceId: z.string().optional(),
  deviceLabel: z.string().optional(),
});

const BAD_LOGIN = 'Agency code, name/phone, or PIN is incorrect';

// Login proves WHO you are: agency code + your name/phone + your own PIN.
// The shared agency password is no longer accepted here (it only lets new
// staff join), so knowing it and a colleague's name gets an attacker nowhere.
export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);

  const agency = await AgencyModel.findOne({ agencyCode: input.agencyCode.trim().toUpperCase() });
  if (!agency) throw AppError.unauthorized(BAD_LOGIN, 'INVALID_CREDENTIALS');
  if (!agency.isActive) throw AppError.forbidden('This agency account is suspended', 'AGENCY_SUSPENDED');

  const user = await UserModel.findOne({
    agencyId: agency._id,
    $or: [{ name: input.identifier }, { phone: input.identifier }],
  })
    .collation({ locale: 'en', strength: 2 })
    .select('+pinHash');
  if (!user || !user.isActive) throw AppError.unauthorized(BAD_LOGIN, 'INVALID_CREDENTIALS');

  if (isLocked({ failedAttempts: user.pinFailedAttempts ?? 0, lockedUntil: user.pinLockedUntil })) {
    throw AppError.tooMany(`Too many wrong PINs. Try again in ${PIN_LOCK_MINUTES} minutes, or ask an owner to reset your PIN.`, 'PIN_LOCKED');
  }
  // An account created before PINs existed has no PIN yet: it cannot sign in
  // until an owner/admin sets one (so the old shared-password path stays closed).
  if (!user.pinHash) throw AppError.unauthorized('This account has no PIN yet. Ask an owner to set one for you.', 'PIN_NOT_SET');

  const pinMatches = await comparePassword(input.pin, user.pinHash);
  if (!pinMatches) {
    const next = afterFailure({ failedAttempts: user.pinFailedAttempts ?? 0 });
    await UserModel.updateOne({ _id: user._id }, { $set: { pinFailedAttempts: next.failedAttempts, ...(next.lockedUntil ? { pinLockedUntil: next.lockedUntil } : {}) } });
    throw AppError.unauthorized(BAD_LOGIN, 'INVALID_CREDENTIALS');
  }

  const reset = afterSuccess();
  user.pinFailedAttempts = reset.failedAttempts;
  user.pinLockedUntil = reset.lockedUntil;
  user.lastLoginAt = new Date();
  await user.save();

  const tokens = await issueTokenPair({
    audience: 'agency-app',
    subjectId: user._id,
    agencyId: agency._id,
    role: user.role,
    deviceId: input.deviceId,
  });

  return ok(res, { agency: agencySummary(agency), user: userSummary(user), ...tokens });
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export const refresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const consumed = await consumeRefreshToken(refreshToken, 'agency-app');

  const user = await UserModel.findById(consumed.subjectId);
  if (!user || !user.isActive) throw AppError.unauthorized('Account is inactive or no longer exists');
  const agency = await AgencyModel.findById(user.agencyId);
  if (!agency || !agency.isActive) throw AppError.forbidden('Agency account is suspended', 'AGENCY_SUSPENDED');

  const tokens = await issueTokenPair({
    audience: 'agency-app',
    subjectId: user._id,
    agencyId: agency._id,
    role: user.role,
    deviceId: consumed.deviceId,
  });

  return ok(res, tokens);
});

export const me = asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.findById(req.auth!.userId);
  if (!user) throw AppError.notFound('User not found');
  const agency = await AgencyModel.findById(user.agencyId);
  if (!agency) throw AppError.notFound('Agency not found');
  return ok(res, { user: userSummary(user), agency: agencySummary(agency) });
});

const setPushTokenSchema = z.object({ pushToken: z.string().min(1).nullable() });

// Called after login/app-start with an Expo push token (or null to clear
// it, e.g. on logout / notifications disabled). One token per user — a
// second device registering just overwrites it, so notifications only ever
// reach the most recently active device, not every device someone has
// logged in from.
export const setPushToken = asyncHandler(async (req: Request, res: Response) => {
  const { pushToken } = setPushTokenSchema.parse(req.body);
  await UserModel.updateOne({ _id: req.auth!.userId }, { $set: { pushToken: pushToken || undefined }, $unset: pushToken ? {} : { pushToken: '' } });
  return ok(res, { message: 'Push token updated' });
});

const notificationPrefsSchema = z
  .object({ dailySummary: z.boolean().optional(), driverUpdates: z.boolean().optional() })
  .refine((v) => v.dailySummary !== undefined || v.driverUpdates !== undefined, { message: 'Nothing to update' });

const prefsView = (u: { notificationPrefs?: { dailySummary?: boolean; driverUpdates?: boolean } }) => ({
  dailySummary: u.notificationPrefs?.dailySummary !== false,
  driverUpdates: u.notificationPrefs?.driverUpdates !== false,
});

export const getNotificationPrefs = asyncHandler(async (req: Request, res: Response) => {
  const user = await UserModel.findById(req.auth!.userId);
  if (!user) throw AppError.notFound('User not found');
  return ok(res, { prefs: prefsView(user), pushRegistered: !!user.pushToken });
});

export const setNotificationPrefs = asyncHandler(async (req: Request, res: Response) => {
  const input = notificationPrefsSchema.parse(req.body);
  const set: Record<string, boolean> = {};
  if (input.dailySummary !== undefined) set['notificationPrefs.dailySummary'] = input.dailySummary;
  if (input.driverUpdates !== undefined) set['notificationPrefs.driverUpdates'] = input.driverUpdates;
  await UserModel.updateOne({ _id: req.auth!.userId }, { $set: set });
  const user = await UserModel.findById(req.auth!.userId);
  return ok(res, { prefs: prefsView(user ?? {}) });
});

const changeAgencyPasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });

// The agency password now only gates JOINING. Changing it stops anyone who
// only knew the old one from joining; people already signed in with their own
// PIN are unaffected, so no sessions are revoked.
export const changeAgencyPassword = asyncHandler(async (req: Request, res: Response) => {
  const input = changeAgencyPasswordSchema.parse(req.body);
  const agency = await AgencyModel.findById(req.auth!.agencyId);
  if (!agency) throw AppError.notFound('Agency not found');

  const matches = await comparePassword(input.currentPassword, agency.passwordHash);
  if (!matches) throw AppError.unauthorized('Current password is incorrect');

  agency.passwordHash = await hashPassword(input.newPassword);
  await agency.save();

  return ok(res, { message: 'Agency join password updated. Staff already signed in are not affected.' });
});

const changePinSchema = z.object({ currentPin: z.string().min(1), newPin: pinField });

// Change your own PIN. Signs out your other devices.
export const changeMyPin = asyncHandler(async (req: Request, res: Response) => {
  const input = changePinSchema.parse(req.body);
  const user = await UserModel.findById(req.auth!.userId).select('+pinHash');
  if (!user) throw AppError.notFound('User not found');
  if (user.pinHash && !(await comparePassword(input.currentPin, user.pinHash))) {
    throw AppError.unauthorized('Current PIN is incorrect', 'INVALID_CREDENTIALS');
  }
  user.pinHash = await hashPassword(input.newPin);
  await user.save();
  await revokeAllForSubject(user._id, 'agency-app');
  const tokens = await issueTokenPair({ audience: 'agency-app', subjectId: user._id, agencyId: user.agencyId, role: user.role, deviceId: req.body?.deviceId });
  return ok(res, { message: 'PIN changed. Other devices were signed out.', ...tokens });
});

const resetPinSchema = z.object({ newPin: pinField });

// Owner/admin sets a temporary PIN for a teammate who forgot theirs (or for
// an account from before PINs existed). Ends that person's sessions and clears
// any lockout.
export const resetUserPin = asyncHandler(async (req: Request, res: Response) => {
  const { newPin } = resetPinSchema.parse(req.body);
  const [actor, target] = await Promise.all([
    UserModel.findOne({ _id: req.auth!.userId, agencyId: req.auth!.agencyId }),
    UserModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId }),
  ]);
  if (!actor || !target) throw AppError.notFound('User not found');
  const problem = canResetPin({ id: String(actor._id), role: actor.role }, { id: String(target._id), role: target.role });
  if (problem) throw AppError.forbidden(problem, 'CHANGE_NOT_ALLOWED');

  target.pinHash = await hashPassword(newPin);
  target.pinFailedAttempts = 0;
  target.pinLockedUntil = undefined;
  await target.save();
  await revokeAllForSubject(target._id, 'agency-app');
  await ActivityLogModel.create({
    agencyId: actor.agencyId,
    actorName: actor.name,
    actorUserId: actor._id,
    action: 'pin_reset',
    description: `${actor.name} reset the PIN for ${target.name}`,
  });
  return ok(res, { message: `PIN reset for ${target.name}. Tell them the new PIN in person.` });
});
