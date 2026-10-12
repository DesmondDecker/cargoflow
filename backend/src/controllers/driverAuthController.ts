import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { DriverModel } from '../models/Driver';
import { hashPassword, comparePassword } from '../utils/password';
import { issueTokenPair, consumeRefreshToken } from '../services/tokenService';

function driverSummary(d: {
  _id: unknown;
  name: string;
  phone: string;
  verificationStatus: string;
  availability: boolean;
  isActive: boolean;
  ratingTotal: number;
  ratingCount: number;
}) {
  return {
    id: String(d._id),
    name: d.name,
    phone: d.phone,
    verificationStatus: d.verificationStatus,
    availability: d.availability,
    isActive: d.isActive,
    ratingAverage: d.ratingCount > 0 ? Math.round((d.ratingTotal / d.ratingCount) * 10) / 10 : 0,
    ratingCount: d.ratingCount,
  };
}

const signupSchema = z.object({
  name: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  password: z.string().min(8),
  deviceId: z.string().optional(),
});

// Driver identity is completely separate from agency staff — its own
// collection, its own JWT audience ('driver-app'), phone+password instead of
// agency-code+shared-password. New drivers start unverified; an agency's
// "Find a Driver" search and a platform admin's verification queue are what
// move verificationStatus forward (not built as endpoints in this pass —
// see README follow-ups).
export const driverSignup = asyncHandler(async (req: Request, res: Response) => {
  const input = signupSchema.parse(req.body);
  const existing = await DriverModel.findOne({ phone: input.phone });
  if (existing) throw AppError.conflict('An account with that phone number already exists', 'PHONE_TAKEN');

  const passwordHash = await hashPassword(input.password);
  const driver = await DriverModel.create({ name: input.name, phone: input.phone, passwordHash });

  const tokens = await issueTokenPair({ audience: 'driver-app', subjectId: driver._id, deviceId: input.deviceId });
  return ok(res, { driver: driverSummary(driver), ...tokens }, 201);
});

const loginSchema = z.object({ phone: z.string().trim().min(1), password: z.string().min(1), deviceId: z.string().optional() });

export const driverLogin = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const driver = await DriverModel.findOne({ phone: input.phone });
  if (!driver || !driver.isActive) throw AppError.unauthorized('Phone number or password is incorrect', 'INVALID_CREDENTIALS');

  const matches = await comparePassword(input.password, driver.passwordHash);
  if (!matches) throw AppError.unauthorized('Phone number or password is incorrect', 'INVALID_CREDENTIALS');

  const tokens = await issueTokenPair({ audience: 'driver-app', subjectId: driver._id, deviceId: input.deviceId });
  return ok(res, { driver: driverSummary(driver), ...tokens });
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export const driverRefresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const consumed = await consumeRefreshToken(refreshToken, 'driver-app');
  const driver = await DriverModel.findById(consumed.subjectId);
  if (!driver || !driver.isActive) throw AppError.unauthorized('Driver account is inactive or no longer exists');
  const tokens = await issueTokenPair({ audience: 'driver-app', subjectId: driver._id, deviceId: consumed.deviceId });
  return ok(res, tokens);
});

export const driverMe = asyncHandler(async (req: Request, res: Response) => {
  const driver = await DriverModel.findById(req.auth!.driverId);
  if (!driver) throw AppError.notFound('Driver not found');
  return ok(res, { driver: driverSummary(driver) });
});

export { driverSummary };
