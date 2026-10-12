import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { AgencyModel } from '../models/Agency';
import { UserModel } from '../models/User';
import { hashPassword, comparePassword } from '../utils/password';
import { issueTokenPair, consumeRefreshToken, revokeAllForAgency } from '../services/tokenService';
import { ActivityLogModel } from '../models/ActivityLog';

function generateAgencyCode(): string {
  // 6 chars, unambiguous alphabet (no 0/O/1/I) — matches the "e.g. K3F9XQ" placeholder shown in the app.
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) code += alphabet[Math.floor(Math.random() * alphabet.length)];
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

const registerSchema = z.object({
  agencyName: z.string().trim().min(1),
  ownerName: z.string().trim().min(1),
  ownerPhone: z.string().trim().optional(),
  ownerEmail: z.string().trim().email().optional(),
  password: z.string().min(8),
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
  password: z.string().min(1),
  deviceId: z.string().optional(),
  deviceLabel: z.string().optional(),
});

export const login = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);

  const agency = await AgencyModel.findOne({ agencyCode: input.agencyCode.trim().toUpperCase() });
  if (!agency) throw AppError.unauthorized('Agency code, name/phone, or password is incorrect', 'INVALID_CREDENTIALS');
  if (!agency.isActive) throw AppError.forbidden('This agency account is suspended', 'AGENCY_SUSPENDED');

  const passwordMatches = await comparePassword(input.password, agency.passwordHash);
  if (!passwordMatches) throw AppError.unauthorized('Agency code, name/phone, or password is incorrect', 'INVALID_CREDENTIALS');

  const user = await UserModel.findOne({
    agencyId: agency._id,
    $or: [{ name: input.identifier }, { phone: input.identifier }],
  }).collation({ locale: 'en', strength: 2 });
  if (!user || !user.isActive) throw AppError.unauthorized('Agency code, name/phone, or password is incorrect', 'INVALID_CREDENTIALS');

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

const changeAgencyPasswordSchema = z.object({ currentPassword: z.string().min(1), newPassword: z.string().min(8) });

// Only owner/admin can rotate the shared agency password — enforced via
// requireRole('owner','admin') on the route. Revokes every OTHER session
// (all staff + this device's other tokens stay logged in only if they also
// re-authenticate) since the whole point of a shared secret is that once
// it's changed, no one who only knew the old one should still have access.
export const changeAgencyPassword = asyncHandler(async (req: Request, res: Response) => {
  const input = changeAgencyPasswordSchema.parse(req.body);
  const agency = await AgencyModel.findById(req.auth!.agencyId);
  if (!agency) throw AppError.notFound('Agency not found');

  const matches = await comparePassword(input.currentPassword, agency.passwordHash);
  if (!matches) throw AppError.unauthorized('Current password is incorrect');

  agency.passwordHash = await hashPassword(input.newPassword);
  await agency.save();
  await revokeAllForAgency(agency._id);

  return ok(res, { message: 'Agency password updated. All other sessions have been signed out.' });
});
