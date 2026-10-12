import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { WarehouseModel, AMENITIES } from '../models/Warehouse';
import { hashPassword, comparePassword } from '../utils/password';
import { issueTokenPair, consumeRefreshToken } from '../services/tokenService';

function warehouseSummary(w: {
  _id: unknown;
  ownerName: string;
  phone: string;
  businessName: string;
  location: string;
  coordinates?: { lat: number; lng: number } | null;
  capacityUnit: string;
  totalCapacity: number;
  availableCapacity: number;
  pricePerUnitPerDay: number;
  amenities: string[];
  photos: string[];
  verificationStatus: string;
  isActive: boolean;
  ratingTotal: number;
  ratingCount: number;
}) {
  return {
    id: String(w._id),
    ownerName: w.ownerName,
    phone: w.phone,
    businessName: w.businessName,
    location: w.location,
    coordinates: w.coordinates ?? null,
    capacityUnit: w.capacityUnit,
    totalCapacity: w.totalCapacity,
    availableCapacity: w.availableCapacity,
    pricePerUnitPerDay: w.pricePerUnitPerDay,
    amenities: w.amenities,
    photos: w.photos,
    verificationStatus: w.verificationStatus,
    isActive: w.isActive,
    ratingAverage: w.ratingCount > 0 ? Math.round((w.ratingTotal / w.ratingCount) * 10) / 10 : 0,
    ratingCount: w.ratingCount,
  };
}

const signupSchema = z.object({
  ownerName: z.string().trim().min(1),
  phone: z.string().trim().min(1),
  password: z.string().min(8),
  businessName: z.string().trim().min(1),
  location: z.string().trim().min(1),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).optional(),
  capacityUnit: z.enum(['sqm', 'container_slot']),
  totalCapacity: z.number().positive(),
  pricePerUnitPerDay: z.number().nonnegative(),
  amenities: z.array(z.enum(AMENITIES)).optional(),
  deviceId: z.string().optional(),
});

// Warehouse owner identity mirrors Driver's: its own collection, its own JWT
// audience ('warehouse-app'), phone+password. A new listing starts
// unverified — same reasoning as an unverified driver not showing up in
// "Find a Driver" until a platform admin verifies it, so agencies aren't
// booking space with someone who was never checked out.
export const warehouseSignup = asyncHandler(async (req: Request, res: Response) => {
  const input = signupSchema.parse(req.body);
  const existing = await WarehouseModel.findOne({ phone: input.phone });
  if (existing) throw AppError.conflict('An account with that phone number already exists', 'PHONE_TAKEN');

  const passwordHash = await hashPassword(input.password);
  const warehouse = await WarehouseModel.create({
    ownerName: input.ownerName,
    phone: input.phone,
    passwordHash,
    businessName: input.businessName,
    location: input.location,
    coordinates: input.coordinates ?? null,
    capacityUnit: input.capacityUnit,
    totalCapacity: input.totalCapacity,
    availableCapacity: input.totalCapacity,
    pricePerUnitPerDay: input.pricePerUnitPerDay,
    amenities: input.amenities ?? [],
  });

  const tokens = await issueTokenPair({ audience: 'warehouse-app', subjectId: warehouse._id, deviceId: input.deviceId });
  return ok(res, { warehouse: warehouseSummary(warehouse), ...tokens }, 201);
});

const loginSchema = z.object({ phone: z.string().trim().min(1), password: z.string().min(1), deviceId: z.string().optional() });

export const warehouseLogin = asyncHandler(async (req: Request, res: Response) => {
  const input = loginSchema.parse(req.body);
  const warehouse = await WarehouseModel.findOne({ phone: input.phone });
  if (!warehouse || !warehouse.isActive) throw AppError.unauthorized('Phone number or password is incorrect', 'INVALID_CREDENTIALS');

  const matches = await comparePassword(input.password, warehouse.passwordHash);
  if (!matches) throw AppError.unauthorized('Phone number or password is incorrect', 'INVALID_CREDENTIALS');

  const tokens = await issueTokenPair({ audience: 'warehouse-app', subjectId: warehouse._id, deviceId: input.deviceId });
  return ok(res, { warehouse: warehouseSummary(warehouse), ...tokens });
});

const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export const warehouseRefresh = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = refreshSchema.parse(req.body);
  const consumed = await consumeRefreshToken(refreshToken, 'warehouse-app');
  const warehouse = await WarehouseModel.findById(consumed.subjectId);
  if (!warehouse || !warehouse.isActive) throw AppError.unauthorized('Warehouse account is inactive or no longer exists');
  const tokens = await issueTokenPair({ audience: 'warehouse-app', subjectId: warehouse._id, deviceId: consumed.deviceId });
  return ok(res, tokens);
});

export const warehouseMe = asyncHandler(async (req: Request, res: Response) => {
  const warehouse = await WarehouseModel.findById(req.auth!.warehouseId);
  if (!warehouse) throw AppError.notFound('Warehouse not found');
  return ok(res, { warehouse: warehouseSummary(warehouse) });
});

export { warehouseSummary };
