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
import { pushToAgencyUser, pushToDriver } from '../services/notifyService';
import { summarizeEarnings } from '../services/earningsService';

export const getMyJobs = asyncHandler(async (req: Request, res: Response) => {
  const jobs = await TransportAssignmentModel.find({
    driverId: req.auth!.driverId,
    status: { $in: ['pending', 'accepted', 'picked_up', 'in_transit'] },
  })
    .populate('containerId')
    .sort({ createdAt: -1 });
  return ok(res, { jobs });
});

// Finished jobs (delivered, declined, cancelled), newest first. getMyJobs only
// returns open work, so without this a driver could never look back at what
// they delivered.
export const getJobHistory = asyncHandler(async (req: Request, res: Response) => {
  const jobs = await TransportAssignmentModel.find({
    driverId: req.auth!.driverId,
    status: { $in: ['delivered', 'declined', 'cancelled'] },
  })
    .populate('containerId', 'containerNumber size shippingLine')
    .sort({ updatedAt: -1 })
    .limit(50);
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

  const [driver, respondedContainer] = await Promise.all([DriverModel.findById(job.driverId), ContainerModel.findById(job.containerId)]);
  await pushToAgencyUser(
    job.assignedByUserId,
    decision === 'accept' ? 'Driver accepted the job' : 'Driver declined the job',
    `${driver?.name || 'A driver'} ${decision === 'accept' ? 'accepted' : 'declined'} ${respondedContainer?.containerNumber || 'the container'}`,
    { screen: 'ContainerCaseFile', containerId: String(job.containerId) }
  );

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

  await pushToAgencyUser(job.assignedByUserId, 'Container delivered', `${container?.containerNumber || 'A container'} was delivered`, {
    screen: 'ContainerCaseFile',
    containerId: String(job.containerId),
  });

  return ok(res, { job });
});

const uploadUrlSchema = z.object({
  purpose: z.enum(['delivery_photo', 'delivery_signature', 'license_document']),
  contentType: z.string().trim().min(1),
  fileSizeBytes: z.number().int().positive().max(10 * 1024 * 1024).optional(),
});

export const getDriverUploadUrl = asyncHandler(async (req: Request, res: Response) => {
  const input = uploadUrlSchema.parse(req.body);
  const presigned = await createPresignedUploadUrl(input.purpose, input.contentType, req.auth!.driverId!, input.fileSizeBytes);
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
  fee: z.number().nonnegative().optional(),
  currency: z.string().trim().length(3).optional(),
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
    fee: input.fee,
    currency: input.currency,
    assignedByUserId: req.auth!.userId,
    status: 'pending',
  });

  container.status = 'Transport Required';
  container.transportAssignmentId = assignment._id;
  await container.save();

  await pushToDriver(input.driverId, 'New job', `${container.containerNumber}: ${input.pickupLocation} → ${input.destination}`, { screen: 'JobDetail', jobId: String(assignment._id) });

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


const verificationRequestSchema = z.object({
  licenseDocumentUrl: z.string().url(),
  location: z.string().trim().min(1).optional(),
  yearsExperience: z.number().int().min(0).max(70).optional(),
});

// A new driver starts 'unverified' and agencies only ever see 'verified'
// drivers (fetchCandidateDrivers), so without a way to ask for verification a
// driver could never receive work. This puts the account in the platform
// admin's review queue with the licence the driver uploaded.
export const requestVerification = asyncHandler(async (req: Request, res: Response) => {
  const input = verificationRequestSchema.parse(req.body);
  const driver = await DriverModel.findById(req.auth!.driverId);
  if (!driver) throw AppError.notFound('Driver not found');
  if (driver.verificationStatus === 'verified') throw AppError.badRequest('This account is already verified');
  if (driver.verificationStatus === 'pending') throw AppError.badRequest('Verification is already under review');

  const vehicleCount = await VehicleModel.countDocuments({ driverId: driver._id, isActive: true });
  if (vehicleCount === 0) throw AppError.badRequest('Add at least one vehicle before requesting verification', 'VEHICLE_REQUIRED');

  driver.licenseDocumentUrl = input.licenseDocumentUrl;
  if (input.location) driver.location = input.location;
  if (input.yearsExperience !== undefined) driver.yearsExperience = input.yearsExperience;
  driver.verificationStatus = 'pending';
  await driver.save();
  return ok(res, { driver: driverSummary(driver) });
});


const pushTokenSchema = z.object({ pushToken: z.string().min(1).nullable() });

export const setDriverPushToken = asyncHandler(async (req: Request, res: Response) => {
  const { pushToken } = pushTokenSchema.parse(req.body);
  await DriverModel.updateOne({ _id: req.auth!.driverId }, pushToken ? { $set: { pushToken } } : { $unset: { pushToken: '' } });
  return ok(res, { message: 'Push token updated' });
});

const driverPrefsSchema = z.object({ jobAlerts: z.boolean() });

export const getDriverNotificationPrefs = asyncHandler(async (req: Request, res: Response) => {
  const driver = await DriverModel.findById(req.auth!.driverId);
  if (!driver) throw AppError.notFound('Driver not found');
  return ok(res, { prefs: { jobAlerts: driver.notificationPrefs?.jobAlerts !== false }, pushRegistered: !!driver.pushToken });
});

export const setDriverNotificationPrefs = asyncHandler(async (req: Request, res: Response) => {
  const { jobAlerts } = driverPrefsSchema.parse(req.body);
  await DriverModel.updateOne({ _id: req.auth!.driverId }, { $set: { 'notificationPrefs.jobAlerts': jobAlerts } });
  return ok(res, { prefs: { jobAlerts } });
});

// Fees the agency agreed for delivered jobs. These are agreed amounts, not
// proof that the agency has paid: there is no payment record between an
// agency and a driver in the system, so nothing here claims "paid".
export const getEarnings = asyncHandler(async (req: Request, res: Response) => {
  const jobs = await TransportAssignmentModel.find({ driverId: req.auth!.driverId, status: 'delivered' })
    .populate('containerId', 'containerNumber')
    .sort({ updatedAt: -1 });

  const summary = summarizeEarnings(
    jobs.map((job) => ({
      id: String(job._id),
      containerNumber: (job.containerId as unknown as { containerNumber?: string } | null)?.containerNumber || '—',
      fee: job.fee,
      currency: job.currency,
      completedAt: job.proofOfDelivery?.completedAt || job.updatedAt,
    }))
  );

  return ok(res, summary);
});
