import { api, setTokens } from './client';
import { ApiEnvelope, ContainerSize, Driver, Job, Vehicle, VehicleType } from '../types';

interface AuthResult {
  driver: Driver;
  accessToken: string;
  refreshToken: string;
}

export async function login(phone: string, password: string): Promise<Driver> {
  const { data } = await api.post<ApiEnvelope<AuthResult>>('/driver/auth/login', { phone, password });
  await setTokens(data.data.accessToken, data.data.refreshToken);
  return data.data.driver;
}

export async function signup(name: string, phone: string, password: string): Promise<Driver> {
  const { data } = await api.post<ApiEnvelope<AuthResult>>('/driver/auth/signup', { name, phone, password });
  await setTokens(data.data.accessToken, data.data.refreshToken);
  return data.data.driver;
}

export async function fetchMe(): Promise<Driver> {
  const { data } = await api.get<ApiEnvelope<{ driver: Driver }>>('/driver/me');
  return data.data.driver;
}

export async function fetchProfile() {
  const { data } = await api.get<ApiEnvelope<{ driver: Driver; vehicles: Vehicle[] }>>('/driver/profile');
  return data.data;
}

export async function setAvailability(availability: boolean): Promise<Driver> {
  const { data } = await api.patch<ApiEnvelope<{ driver: Driver }>>('/driver/availability', { availability });
  return data.data.driver;
}

export async function addVehicle(input: { vehicleType: VehicleType; plateNumber: string; containerCompatibility: ContainerSize[] }) {
  const { data } = await api.post<ApiEnvelope<{ vehicle: Vehicle }>>('/driver/vehicles', input);
  return data.data.vehicle;
}

export async function requestVerification(input: { licenseDocumentUrl: string; location?: string; yearsExperience?: number }): Promise<Driver> {
  const { data } = await api.post<ApiEnvelope<{ driver: Driver }>>('/driver/verification/request', input);
  return data.data.driver;
}

export async function fetchJobs(): Promise<Job[]> {
  const { data } = await api.get<ApiEnvelope<{ jobs: Job[] }>>('/driver/jobs');
  return data.data.jobs;
}

export async function fetchJobHistory(): Promise<Job[]> {
  const { data } = await api.get<ApiEnvelope<{ jobs: Job[] }>>('/driver/jobs/history');
  return data.data.jobs;
}

export async function fetchJob(id: string): Promise<Job> {
  const { data } = await api.get<ApiEnvelope<{ job: Job }>>(`/driver/jobs/${id}`);
  return data.data.job;
}

export async function respondToJob(id: string, decision: 'accept' | 'decline'): Promise<Job> {
  const { data } = await api.post<ApiEnvelope<{ job: Job }>>(`/driver/jobs/${id}/respond`, { decision });
  return data.data.job;
}

export async function updateJobStatus(id: string, status: 'picked_up' | 'in_transit'): Promise<Job> {
  const { data } = await api.patch<ApiEnvelope<{ job: Job }>>(`/driver/jobs/${id}/status`, { status });
  return data.data.job;
}

export async function completeJob(
  id: string,
  input: { photoUrl?: string; signatureUrl?: string; gps?: { lat: number; lng: number } | null; notes?: string }
): Promise<Job> {
  const { data } = await api.post<ApiEnvelope<{ job: Job }>>(`/driver/jobs/${id}/complete`, input);
  return data.data.job;
}

type UploadPurpose = 'delivery_photo' | 'delivery_signature' | 'license_document';

// The file bytes go straight to storage on a short-lived presigned URL; the
// API only hands out the URL and later stores the resulting file address.
// Needs R2 configured on the server (the API answers 501 otherwise).
export async function uploadFile(purpose: UploadPurpose, uri: string, contentType: string): Promise<string> {
  const { data } = await api.post<ApiEnvelope<{ uploadUrl: string; fileUrl: string }>>('/driver/upload-url', { purpose, contentType });
  const blob = await (await fetch(uri)).blob();
  const put = await fetch(data.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
  if (!put.ok) throw new Error('Upload failed. Please try again.');
  return data.data.fileUrl;
}

export async function setPushToken(pushToken: string | null): Promise<void> {
  await api.patch('/driver/push-token', { pushToken });
}

export async function fetchNotificationPrefs() {
  const { data } = await api.get<ApiEnvelope<{ prefs: { jobAlerts: boolean }; pushRegistered: boolean }>>('/driver/notification-prefs');
  return data.data;
}

export async function updateNotificationPrefs(prefs: { jobAlerts: boolean }) {
  const { data } = await api.patch<ApiEnvelope<{ prefs: { jobAlerts: boolean } }>>('/driver/notification-prefs', prefs);
  return data.data.prefs;
}

export interface EarningsTotals {
  currency: string;
  week: number;
  month: number;
  allTime: number;
  jobs: number;
}

export interface EarningsData {
  totals: EarningsTotals[];
  recent: { jobId: string; containerNumber: string; fee: number; currency: string; completedAt: string }[];
  deliveredWithoutFee: number;
}

export async function fetchEarnings(): Promise<EarningsData> {
  const { data } = await api.get<ApiEnvelope<EarningsData>>('/driver/earnings');
  return data.data;
}
