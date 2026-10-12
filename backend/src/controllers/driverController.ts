import { Request, Response } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../utils/asyncHandler';
import { ok } from '../utils/apiResponse';
import { AppError } from '../utils/AppError';
import { DriverModel } from '../models/Driver';
import { VehicleModel } from '../models/Vehicle';
import { TransportAssignmentModel } from '../models/TransportAssignment';
import { ContainerModel } from '../models/Container';
import { ActivityLogModel } from '../models/ActivityLog';
import { createPresignedUploadUrl } from '../services/storageService';
import { driverSummary } from './driverAuthController';

export const getMyJobs = asyncHandler(async (req: Request, res: Response) => {
  const jobs = await TransportAssignmentModel.find({
    driverId: req.auth!.driverId,
    status: { $in: ['pending', 'accepted', 'picked_up', 'in_transit'] },
  })
    .populate('containerId')
    .sort({ createdAt: -1 });
  return ok(res, { jobs });
});

export const getJobDetail = asyncHandler(async (req: Request, res: Response) => {
  const job = await TransportAssignmentModel.findOne({ _id: req.params.id, driverId: req.auth!.driverId }).populate('containerId');
  if (!job) throw AppError.notFound('Job not found');
  return ok(res, { job });
});

export const respondToJob = asyncHandler(async (req: Request, res: Response) => {
  const decisionSchema = z.object({ decision: z.enum(['accept', 'decline']) });
  const { decision } = decisionSchema.parse(req.body);

  const job = await TransportAssignmentModel.findOne({ _id: req.params.id, driverId: req.auth!.driverId });
  if (!job) throw AppError.notFound('Job not found');
  if (job.status !== 'pending') throw AppError.badRequest('This job has already been responded to');

  if (decision === 'accept') {
    job.status = 'accepted';
    await job.save();
    await ContainerModel.updateOne({ _id: job.containerId }, { $set: { status: 'Driver Assigned' } });
  } else {
    job.status = 'declined';
    await job.save();
    // Declining reverts the container so the agency can reassign — it must
    // not get stuck showing "Driver Assigned" with no actual driver working it.
    await ContainerModel.updateOne({ _id: job.containerId }, { $set: { status: 'Transport Required', transportAssignmentId: undefined } });
  }

  return ok(res, { job });
});

const statusUpdateSchema = z.object({ status: z.enum(['picked_up', 'in_transit']) });

export const updateJobStatus = asyncHandler(async (req: Request, res: Response) => {
  const { status } = statusUpdateSchema.parse(req.body);
  const job = await TransportAssignmentModel.findOne({ _id: req.params.id, driverId: req.auth!.driverId });
  if (!job) throw AppError.notFound('Job not found');
  if (job.status !== 'accepted' && !(job.status === 'picked_up' && status === 'in_transit')) {
    throw AppError.badRequest(`Cannot move to "${status}" from "${job.status}"`);
  }

  job.status = status;
  await job.save();

  const containerStatus = status === 'picked_up' ? 'Picked Up' : 'In Transit To Destination';
  await ContainerModel.updateOne({ _id: job.containerId }, { $set: { status: containerStatus } });

  return ok(res, { job });
});

const completeSchema = z.object({
  photoUrl: z.string().url().optional(),
  signatureUrl: z.string().url().optional(),
  gps: z.object({ lat: z.number(), lng: z.number() }).nullable().optional(),
  notes: z.string().optional(),
});

export const completeJob = asyncHandler(async (req: Request, res: Response) => {
  const input = completeSchema.parse(req.body);
  const job = await TransportAssignmentModel.findOne({ _id: req.params.id, driverId: req.auth!.driverId });
  if (!job) throw AppError.notFound('Job not found');
  if (job.status !== 'in_transit' && job.status !== 'picked_up') {
    throw AppError.badRequest('Job must be picked up or in transit before it can be completed');
  }

  job.status = 'delivered';
  job.proofOfDelivery = {
    photoUrl: input.photoUrl,
    signatureUrl: input.signatureUrl,
    gps: input.gps ?? null,
    notes: input.notes,
    completedAt: new Date(),
  };
  await job.save();

  await ContainerModel.updateOne({ _id: job.containerId }, { $set: { status: 'Delivered' } });
  const container = await ContainerModel.findById(job.containerId);
  await ActivityLogModel.create({
    agencyId: job.agencyId,
    containerId: job.containerId,
    actorName: 'Driver',
    action: 'delivery_completed',
    description: `Container ${container?.containerNumber || ''} was marked delivered`.trim(),
    details: { transportAssignmentId: job._id },
  });

  return ok(res, { job });
});

const uploadUrlSchema = z.object({
  purpose: z.enum(['delivery_photo', 'delivery_signature', 'license_document']),
  contentType: z.string().min(1),
});

export const getDriverUploadUrl = asyncHandler(async (req: Request, res: Response) => {
  const input = uploadUrlSchema.parse(req.body);
  const presigned = await createPresignedUploadUrl(input.purpose, input.contentType, req.auth!.driverId!);
  return ok(res, presigned);
});

export const getMyProfile = asyncHandler(async (req: Request, res: Response) => {
  const driver = await DriverModel.findById(req.auth!.driverId);
  if (!driver) throw AppError.notFound('Driver not found');
  const vehicles = await VehicleModel.find({ driverId: driver._id, isActive: true });
  return ok(res, { driver: driverSummary(driver), vehicles });
});

const availabilitySchema = z.object({ availability: z.boolean() });

export const setAvailability = asyncHandler(async (req: Request, res: Response) => {
  const { availability } = availabilitySchema.parse(req.body);
  const driver = await DriverModel.findByIdAndUpdate(req.auth!.driverId, { availability }, { new: true });
  if (!driver) throw AppError.notFound('Driver not found');
  return ok(res, { driver: driverSummary(driver) });
});

const addVehicleSchema = z.object({
  vehicleType: z.enum(['20ft Truck', '40ft Truck', 'Flatbed', 'Low Bed', 'Pickup', 'Van', 'Other']),
  plateNumber: z.string().trim().min(1),
  containerCompatibility: z.array(z.enum(['20ft', '40ft', '40ft HC', '45ft'])).min(1),
});

export const addVehicle = asyncHandler(async (req: Request, res: Response) => {
  const input = addVehicleSchema.parse(req.body);
  const vehicle = await VehicleModel.create({ driverId: req.auth!.driverId, ...input });
  return ok(res, { vehicle }, 201);
});

// ---- called by agency staff, not the driver ----
// Matches cargoflow-mobile's transportApi.ts exactly: candidates are scoped
// to one container (so its size can be matched against vehicle
// compatibility), not a bare driver list.

export const fetchCandidateDrivers = asyncHandler(async (req: Request, res: Response) => {
  const container = await ContainerModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!container) throw AppError.notFound('Container not found');

  const sizeMap: Record<string, string> = { '20ft': '20ft', '40ft': '40ft', '40ft-hc': '40ft HC', other: '40ft' };
  const containerSize = sizeMap[container.size] || undefined;

  const vehicleFilter: Record<string, unknown> = { isActive: true };
  if (containerSize) vehicleFilter.containerCompatibility = containerSize;

  const vehicles = await VehicleModel.find(vehicleFilter).populate({
    path: 'driverId',
    match: { isActive: true, availability: true, verificationStatus: 'verified' },
  });

  const byDriver = new Map<string, { driver: NonNullable<typeof vehicles[number]['driverId']>; vehicles: typeof vehicles }>();
  for (const v of vehicles) {
    if (!v.driverId) continue; // populate match filtered this driver out
    const key = String((v.driverId as { _id: unknown })._id);
    if (!byDriver.has(key)) byDriver.set(key, { driver: v.driverId, vehicles: [] });
    byDriver.get(key)!.vehicles.push(v);
  }

  const now = new Date();
  const drivers = await Promise.all(
    Array.from(byDriver.values()).map(async ({ driver, vehicles: matchingVehicles }) => {
      const d = driver as unknown as {
        _id: unknown; name: string; phone: string; location?: string; yearsExperience?: number;
        ratingTotal: number; ratingCount: number; sponsored: boolean; sponsoredUntil?: Date | null;
      };
      const completedJobs = await TransportAssignmentModel.countDocuments({ driverId: d._id, status: 'delivered' });
      return {
        _id: String(d._id),
        name: d.name,
        phone: d.phone,
        location: d.location,
        yearsExperience: d.yearsExperience,
        sponsored: d.sponsored && !!d.sponsoredUntil && d.sponsoredUntil > now,
        ratingAverage: d.ratingCount > 0 ? Math.round((d.ratingTotal / d.ratingCount) * 10) / 10 : 0,
        ratingCount: d.ratingCount,
        completedJobs,
        matchingVehicles: matchingVehicles.map((v) => ({ _id: String(v._id), vehicleType: v.vehicleType, plateNumber: v.plateNumber, containerCompatibility: v.containerCompatibility })),
      };
    })
  );
  // Same reasoning as the warehouse candidate search: a currently-boosted
  // driver goes first regardless of rating — that's the entire value of
  // paying for the placement.
  drivers.sort((a, b) => Number(b.sponsored) - Number(a.sponsored) || b.ratingAverage - a.ratingAverage);

  return ok(res, { containerSize, drivers });
});

const assignDriverSchema = z.object({
  driverId: z.string().min(1),
  vehicleId: z.string().min(1),
  pickupLocation: z.string().trim().min(1),
  destination: z.string().trim().min(1),
  requiredDate: z.string().datetime().optional(),
  contactName: z.string().trim().optional(),
  contactPhone: z.string().trim().optional(),
});

export const assignDriver = asyncHandler(async (req: Request, res: Response) => {
  const input = assignDriverSchema.parse(req.body);
  const container = await ContainerModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!container) throw AppError.notFound('Container not found');

  const assignment = await TransportAssignmentModel.create({
    agencyId: req.auth!.agencyId,
    containerId: container._id,
    driverId: input.driverId,
    vehicleId: input.vehicleId,
    pickupLocation: input.pickupLocation,
    destination: input.destination,
    requiredDate: input.requiredDate ? new Date(input.requiredDate) : undefined,
    contactName: input.contactName,
    contactPhone: input.contactPhone,
    status: 'pending',
  });

  container.status = 'Transport Required';
  container.transportAssignmentId = assignment._id;
  await container.save();

  return ok(res, { assignment }, 201);
});

export const fetchAgencyTransportJobs = asyncHandler(async (req: Request, res: Response) => {
  const filter: Record<string, unknown> = { agencyId: req.auth!.agencyId };
  if (req.query.status) filter.status = req.query.status;
  if (req.query.containerId) filter.containerId = req.query.containerId;

  const jobs = await TransportAssignmentModel.find(filter)
    .populate('containerId', 'containerNumber status')
    .populate('driverId', 'name phone ratingTotal ratingCount')
    .populate('vehicleId', 'vehicleType plateNumber')
    .sort({ createdAt: -1 });

  return ok(res, { jobs });
});

const rateDriverSchema = z.object({ stars: z.number().min(1).max(5), comment: z.string().optional() });

export const rateDriver = asyncHandler(async (req: Request, res: Response) => {
  const input = rateDriverSchema.parse(req.body);
  const assignment = await TransportAssignmentModel.findOne({ _id: req.params.id, agencyId: req.auth!.agencyId });
  if (!assignment) throw AppError.notFound('Assignment not found');
  if (assignment.status !== 'delivered') throw AppError.badRequest('Can only rate a completed delivery');
  if (assignment.rating) throw AppError.conflict('This delivery has already been rated');

  assignment.rating = { stars: input.stars, comment: input.comment };
  await assignment.save();

  await DriverModel.updateOne({ _id: assignment.driverId }, { $inc: { ratingTotal: input.stars, ratingCount: 1 } });

  return ok(res, { assignment });
});
