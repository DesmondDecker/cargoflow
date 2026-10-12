import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { WarehouseModel, AMENITIES } from '../models/Warehouse';
import { WarehouseBookingModel } from '../models/WarehouseBooking';
import { ContainerModel } from '../models/Container';
import { ActivityLogModel } from '../models/ActivityLog';
import { createPresignedUploadUrl } from '../services/storageService';
import { warehouseSummary } from './warehouseAuthController';

// ---- owner-facing: manage the listing itself ----

export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const warehouse = await WarehouseModel.findById(req.auth!.warehouseId);
  if (!warehouse) throw AppError.notFound('Warehouse not found');
  return ok(res, { warehouse: warehouseSummary(warehouse) });
});

const updateListingSchema = z.object({
  businessName: z.string().trim().min(1).optional(),
  location: z.string().trim().min(1).optional(),
  coordinates: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
  pricePerUnitPerDay: z.number().nonnegative().optional(),
  amenities: z.array(z.enum(AMENITIES)).optional(),
  isActive: z.boolean().optional(),
});

export const updateListing = asyncHandler(async (req: Request, res: Response) => {
  const input = updateListingSchema.parse(req.body);
  const warehouse = await WarehouseModel.findByIdAndUpdate(req.auth!.warehouseId, { $set: input }, { new: true });
  if (!warehouse) throw AppError.notFound('Warehouse not found');
  return ok(res, { warehouse: warehouseSummary(warehouse) });
});

// Capacity is edited separately from the rest of the listing because raising
// totalCapacity must raise availableCapacity by the same delta, not just
// overwrite it — overwriting would silently un-reserve space already
// promised to a confirmed booking.
const updateCapacitySchema = z.object({ totalCapacity: z.number().positive() });

export const updateCapacity = asyncHandler(async (req: Request, res: Response) => {
  const { totalCapacity } = updateCapacitySchema.parse(req.body);
  const warehouse = await WarehouseModel.findById(req.auth!.warehouseId);
  if (!warehouse) throw AppError.notFound('Warehouse not found');

  const reserved = warehouse.totalCapacity - warehouse.availableCapacity;
  if (totalCapacity < reserved) {
    throw AppError.badRequest(`Cannot set capacity below the ${reserved} ${warehouse.capacityUnit} currently reserved by active bookings`);
  }
  warehouse.totalCapacity = totalCapacity;
  warehouse.availableCapacity = totalCapacity - reserved;
  await warehouse.save();
  return ok(res, { warehouse: warehouseSummary(warehouse) });
});

const addPhotosSchema = z.object({ photoUrls: z.array(z.string().url()).min(1) });

export const addPhotos = asyncHandler(async (req: Request, res: Response) => {
  const { photoUrls } = addPhotosSchema.parse(req.body);
  const warehouse = await WarehouseModel.findByIdAndUpdate(
    req.auth!.warehouseId,
    { $push: { photos: { $each: photoUrls } } },
    { new: true }
  );
  if (!warehouse) throw AppError.notFound('Warehouse not found');
  return ok(res, { warehouse: warehouseSummary(warehouse) });
});

const uploadUrlSchema = z.object({
  purpose: z.enum(['warehouse_photo', 'storage_condition_photo']),
  contentType: z.string().min(1),
});

export const getWarehouseUploadUrl = asyncHandler(async (req: Request, res: Response) => {
  const input = uploadUrlSchema.parse(req.body);
  const presigned = await createPresignedUploadUrl(input.purpose, input.contentType, req.auth!.warehouseId!);
  return ok(res, presigned);
});

// ---- owner-facing: bookings on this warehouse ----

export const getMyBookings = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { warehouseId: req.auth!.warehouseId };
  if (req.query.status) filter.status = req.query.status;

  const bookings = await WarehouseBookingModel.find(filter)
    .populate('containerId', 'containerNumber status')
    .populate('agencyId', 'name')
    .sort({ createdAt: -1 });
  return ok(res, { bookings });
});

export const getBookingDetail = asyncHandler(async (req: Request, res: Response) => {
  const booking = await WarehouseBookingModel.findOne({ _id: req.params.id, warehouseId: req.auth!.warehouseId }).populate('containerId');
  if (!booking) throw AppError.notFound('Booking not found');
  return ok(res, { booking });
});

const respondSchema = z.object({ decision: z.enum(['accept', 'decline']) });

export const respondToBooking = asyncHandler(async (req: Request, res: Response) => {
  const { decision } = respondSchema.parse(req.body);
  const booking = await WarehouseBookingModel.findOne({ _id: req.params.id, warehouseId: req.auth!.warehouseId });
  if (!booking) throw AppError.notFound('Booking not found');
  if (booking.status !== 'requested') throw AppError.badRequest('This booking has already been responded to');

  if (decision === 'accept') {
    const warehouse = await WarehouseModel.findById(booking.warehouseId);
    if (!warehouse) throw AppError.notFound('Warehouse not found');
    if (warehouse.availableCapacity < booking.unitsBooked) {
      throw AppError.conflict('Not enough available capacity to accept this booking', 'INSUFFICIENT_CAPACITY');
    }
    warehouse.availableCapacity -= booking.unitsBooked;
    await warehouse.save();
    booking.status = 'confirmed';
  } else {
    booking.status = 'declined';
  }
  await booking.save();

  // Deliberately not touching container.status here: ContainerStatus has no
  // storage states yet, and a booking can run in parallel with the
  // container's own clearance/transport lifecycle rather than replacing a
  // step in it. The container's ActivityLog is enough of a breadcrumb for now.

  return ok(res, { booking });
});

const conditionSchema = z.object({
  photoUrls: z.array(z.string().url()).optional(),
  notes: z.string().optional(),
  gps: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
});

export const checkInBooking = asyncHandler(async (req: Request, res: Response) => {
  const input = conditionSchema.parse(req.body);
  const booking = await WarehouseBookingModel.findOne({ _id: req.params.id, warehouseId: req.auth!.warehouseId });
  if (!booking) throw AppError.notFound('Booking not found');
  if (booking.status !== 'confirmed') throw AppError.badRequest('Booking must be confirmed before check-in');

  booking.checkIn = { ...input, recordedBy: 'warehouse', completedAt: new Date() };
  booking.status = 'in_storage';
  await booking.save();
  return ok(res, { booking });
});

export const checkOutBooking = asyncHandler(async (req: Request, res: Response) => {
  const input = conditionSchema.parse(req.body);
  const booking = await WarehouseBookingModel.findOne({ _id: req.params.id, warehouseId: req.auth!.warehouseId });
  if (!booking) throw AppError.notFound('Booking not found');
  if (booking.status !== 'in_storage') throw AppError.badRequest('Booking must be in storage before check-out');

  booking.checkOut = { ...input, recordedBy: 'warehouse', completedAt: new Date() };
  booking.status = 'collected';
  booking.collectedAt = new Date();
  await booking.save();

  await WarehouseModel.updateOne({ _id: booking.warehouseId }, { $inc: { availableCapacity: booking.unitsBooked } });

  return ok(res, { booking });
});

// ---- agency-facing: called from a container's case file, mirrors driverController's candidate/assign pair ----

export const fetchCandidateWarehouses = asyncHandler(async (req: Request, res: Response) => {
  const container = await ContainerModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!container) throw AppError.notFound('Container not found');

  const filter: Record<string, unknown> = {
    isActive: true,
    verificationStatus: 'verified',
    availableCapacity: { $gt: 0 },
  };
  if (typeof req.query.location === 'string' && req.query.location.trim()) {
    filter.location = new RegExp(req.query.location.trim(), 'i');
  }

  const now = new Date();
  // Fetch a wider pool than the final cap so a currently-boosted warehouse
  // outside the top-30-by-rating still gets pulled to the front — the whole
  // point of paying for a boost is showing up even when you wouldn't on
  // rating alone.
  const pool = await WarehouseModel.find(filter).sort({ ratingTotal: -1 }).limit(60);
  const isBoosted = (w: { sponsored: boolean; sponsoredUntil?: Date | null }) =>
    w.sponsored && !!w.sponsoredUntil && w.sponsoredUntil > now;
  const warehouses = [...pool].sort((a, b) => Number(isBoosted(b)) - Number(isBoosted(a))).slice(0, 30);

  return ok(res, {
    warehouses: warehouses.map((w) => ({
      _id: String(w._id),
      businessName: w.businessName,
      location: w.location,
      coordinates: w.coordinates ?? null,
      capacityUnit: w.capacityUnit,
      availableCapacity: w.availableCapacity,
      pricePerUnitPerDay: w.pricePerUnitPerDay,
      amenities: w.amenities,
      photos: w.photos,
      sponsored: isBoosted(w),
      ratingAverage: w.ratingCount > 0 ? Math.round((w.ratingTotal / w.ratingCount) * 10) / 10 : 0,
      ratingCount: w.ratingCount,
    })),
  });
});

const bookSchema = z.object({
  warehouseId: z.string().min(1),
  unitsBooked: z.number().positive(),
  startDate: z.string().datetime(),
  endDate: z.string().datetime(),
  contactName: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
  notes: z.string().optional(),
});

export const bookWarehouse = asyncHandler(async (req: Request, res: Response) => {
  const input = bookSchema.parse(req.body);
  const container = await ContainerModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!container) throw AppError.notFound('Container not found');

  const warehouse = await WarehouseModel.findOne({ _id: input.warehouseId, isActive: true, verificationStatus: 'verified' });
  if (!warehouse) throw AppError.notFound('Warehouse not found or not accepting bookings');
  if (warehouse.availableCapacity < input.unitsBooked) {
    throw AppError.conflict('Warehouse does not have enough available capacity', 'INSUFFICIENT_CAPACITY');
  }

  const start = new Date(input.startDate);
  const end = new Date(input.endDate);
  if (end <= start) throw AppError.badRequest('endDate must be after startDate');
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));

  const booking = await WarehouseBookingModel.create({
    agencyId: req.auth!.agencyId,
    containerId: container._id,
    warehouseId: warehouse._id,
    unitsBooked: input.unitsBooked,
    startDate: start,
    endDate: end,
    pricePerUnitPerDay: warehouse.pricePerUnitPerDay,
    estimatedTotalPrice: warehouse.pricePerUnitPerDay * input.unitsBooked * days,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    notes: input.notes,
    status: 'requested',
  });

  await ActivityLogModel.create({
    agencyId: req.auth!.agencyId,
    containerId: container._id,
    actorName: 'Agency Staff',
    action: 'storage_requested',
    description: `Storage requested at ${warehouse.businessName} for container ${container.containerNumber}`,
    details: { warehouseBookingId: booking._id },
  });

  return ok(res, { booking }, 201);
});

export const fetchAgencyWarehouseBookings = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { agencyId: req.auth!.agencyId };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.containerId) filter.containerId = req.query.containerId;

  const bookings = await WarehouseBookingModel.find(filter)
    .populate('containerId', 'containerNumber status')
    .populate('warehouseId', 'businessName location phone ratingTotal ratingCount')
    .sort({ createdAt: -1 });

  return ok(res, { bookings });
});

const cancelSchema = z.object({ reason: z.string().optional() });

export const cancelBooking = asyncHandler(async (req: Request, res: Response) => {
  cancelSchema.parse(req.body ?? {});
  const booking = await WarehouseBookingModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!booking) throw AppError.notFound('Booking not found');
  if (!['requested', 'confirmed'].includes(booking.status)) {
    throw AppError.badRequest('Only a requested or confirmed booking can be cancelled');
  }

  if (booking.status === 'confirmed') {
    await WarehouseModel.updateOne({ _id: booking.warehouseId }, { $inc: { availableCapacity: booking.unitsBooked } });
  }
  booking.status = 'cancelled';
  await booking.save();
  return ok(res, { booking });
});

const rateWarehouseSchema = z.object({ stars: z.number().min(1).max(5), comment: z.string().optional() });

export const rateWarehouse = asyncHandler(async (req: Request, res: Response) => {
  const input = rateWarehouseSchema.parse(req.body);
  const booking = await WarehouseBookingModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!booking) throw AppError.notFound('Booking not found');
  if (booking.status !== 'collected') throw AppError.badRequest('Can only rate a completed storage booking');
  if (booking.rating) throw AppError.conflict('This booking has already been rated');

  booking.rating = { stars: input.stars, comment: input.comment };
  await booking.save();

  await WarehouseModel.updateOne({ _id: booking.warehouseId }, { $inc: { ratingTotal: input.stars, ratingCount: 1 } });

  return ok(res, { booking });
});
