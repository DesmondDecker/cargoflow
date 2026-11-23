import { api } from './client';
import {
  Agency,
  Analytics,
  ApiEnvelope,
  Driver,
  Expense,
  GatewayDevice,
  Payment,
  AdminRole,
  PlatformAdmin,
  SubscriptionPlan,
  SubscriptionStatus,
  Warehouse,
} from '../types';

export async function login(email: string, password: string) {
  const { data } = await api.post<ApiEnvelope<{ admin: { id: string; name: string; email: string; role?: string }; accessToken: string }>>(
    '/platform-admin/login',
    { email, password }
  );
  return data.data;
}

export async function fetchAnalytics() {
  const { data } = await api.get<ApiEnvelope<Analytics>>('/platform-admin/analytics');
  return data.data;
}

export async function fetchAgencies() {
  const { data } = await api.get<ApiEnvelope<{ agencies: Agency[] }>>('/platform-admin/agencies');
  return data.data.agencies;
}

export async function updateAgencySubscription(
  agencyId: string,
  status: SubscriptionStatus,
  options?: { currentPeriodEnd?: string; note?: string }
) {
  const { data } = await api.patch<ApiEnvelope<{ subscription: Agency['subscription'] }>>(
    `/platform-admin/agencies/${agencyId}/subscription`,
    { status, ...options }
  );
  return data.data;
}

export async function fetchPayments(status?: string) {
  const { data } = await api.get<ApiEnvelope<{ payments: Payment[] }>>('/platform-admin/payments', { params: { status } });
  return data.data.payments;
}

export async function fetchExpenses(status?: string) {
  const { data } = await api.get<ApiEnvelope<{ expenses: Expense[] }>>('/platform-admin/expenses', { params: { status } });
  return data.data.expenses;
}

export async function approveExpense(expenseId: string) {
  const { data } = await api.post<ApiEnvelope<{ expense: Expense }>>(`/platform-admin/expenses/${expenseId}/approve`);
  return data.data.expense;
}

export async function rejectExpense(expenseId: string, reason: string) {
  const { data } = await api.post<ApiEnvelope<{ expense: Expense }>>(`/platform-admin/expenses/${expenseId}/reject`, { reason });
  return data.data.expense;
}

export async function verifyPayment(paymentId: string) {
  const { data } = await api.post<ApiEnvelope<{ payment: Payment }>>(`/platform-admin/payments/${paymentId}/verify`);
  return data.data.payment;
}

export async function rejectPayment(paymentId: string, reason: string) {
  const { data } = await api.post<ApiEnvelope<{ payment: Payment }>>(`/platform-admin/payments/${paymentId}/reject`, { reason });
  return data.data.payment;
}

export async function fetchGatewayDevices() {
  const { data } = await api.get<ApiEnvelope<{ devices: GatewayDevice[] }>>('/platform-admin/gateway-devices');
  return data.data.devices;
}

export async function createGatewayDevice(name: string) {
  const { data } = await api.post<ApiEnvelope<{ device: GatewayDevice; apiKey: string }>>('/platform-admin/gateway-devices', { name });
  return data.data;
}

export async function deactivateGatewayDevice(deviceId: string) {
  await api.patch(`/platform-admin/gateway-devices/${deviceId}/deactivate`);
}

export async function fetchPlans() {
  const { data } = await api.get<ApiEnvelope<{ plans: SubscriptionPlan[] }>>('/platform-admin/plans');
  return data.data.plans;
}

export async function updateAgencyActive(agencyId: string, isActive: boolean, note?: string) {
  const { data } = await api.patch<ApiEnvelope<{ agency: { id: string; isActive: boolean } }>>(
    `/platform-admin/agencies/${agencyId}/status`,
    { isActive, note }
  );
  return data.data.agency;
}

export async function resetAgencyPassword(agencyId: string, newPassword: string) {
  await api.patch(`/platform-admin/agencies/${agencyId}/reset-password`, { newPassword });
}

export async function resetAgencyOwnerPin(agencyId: string, newPin: string) {
  await api.patch(`/platform-admin/agencies/${agencyId}/reset-owner-pin`, { newPin });
}

export async function fetchDrivers(search?: string) {
  const { data } = await api.get<ApiEnvelope<{ drivers: Driver[] }>>('/platform-admin/drivers', { params: { search } });
  return data.data.drivers;
}

export async function setDriverVerification(driverId: string, verificationStatus: Driver['verificationStatus']) {
  await api.patch(`/platform-admin/drivers/${driverId}/verification`, { verificationStatus });
}

export async function resetDriverPassword(driverId: string, newPassword: string) {
  await api.patch(`/platform-admin/drivers/${driverId}/reset-password`, { newPassword });
}

export async function fetchOwnAdminProfile() {
  const { data } = await api.get<ApiEnvelope<{ admin: PlatformAdmin & { lastLoginAt?: string } }>>('/platform-admin/me');
  return data.data.admin;
}

export async function changeOwnPassword(currentPassword: string, newPassword: string) {
  await api.patch('/platform-admin/me/password', { currentPassword, newPassword });
}

export async function fetchPlatformAdmins() {
  const { data } = await api.get<ApiEnvelope<{ admins: PlatformAdmin[] }>>('/platform-admin/admins');
  return data.data.admins;
}

export async function createPlatformAdmin(name: string, email: string, password: string, role: AdminRole) {
  const { data } = await api.post<ApiEnvelope<{ admin: PlatformAdmin }>>('/platform-admin/admins', { name, email, password, role });
  return data.data.admin;
}

export async function setPlatformAdminRole(adminId: string, role: AdminRole) {
  await api.patch(`/platform-admin/admins/${adminId}/role`, { role });
}

export async function deactivatePlatformAdmin(adminId: string) {
  await api.patch(`/platform-admin/admins/${adminId}/deactivate`);
}

export interface InstitutionUser {
  id: string;
  name: string;
  email: string;
  institution: 'customs' | 'agl';
  isActive: boolean;
  notifyByEmail: boolean;
  isSupervisor?: boolean;
  lastLoginAt?: string;
  createdAt?: string;
}

export async function fetchInstitutionUsers(): Promise<InstitutionUser[]> {
  const { data } = await api.get<{ data: { users: InstitutionUser[] } }>('/platform-admin/institution-users');
  return data.data.users;
}

export async function createInstitutionUser(input: { name: string; email: string; institution: 'customs' | 'agl'; password: string; notifyByEmail?: boolean; isSupervisor?: boolean }) {
  await api.post('/platform-admin/institution-users', input);
}

export async function updateInstitutionUser(id: string, patch: { name?: string; isActive?: boolean; notifyByEmail?: boolean; isSupervisor?: boolean }) {
  await api.patch(`/platform-admin/institution-users/${id}`, patch);
}

export async function resetInstitutionUserPassword(id: string, password: string) {
  await api.patch(`/platform-admin/institution-users/${id}/reset-password`, { password });
}

export async function fetchWarehouses(search?: string) {
  const { data } = await api.get<ApiEnvelope<{ warehouses: Warehouse[] }>>('/platform-admin/warehouses', { params: { search } });
  return data.data.warehouses;
}

export async function setWarehouseVerification(id: string, verificationStatus: Warehouse['verificationStatus']) {
  await api.patch(`/platform-admin/warehouses/${id}/verification`, { verificationStatus });
}

// A boost needs an end date, so turning it on without one is refused by the server.
export async function setWarehouseSponsorship(id: string, sponsored: boolean, sponsoredUntil?: string) {
  await api.patch(`/platform-admin/warehouses/${id}/sponsorship`, { sponsored, sponsoredUntil });
}

export async function setDriverSponsorship(id: string, sponsored: boolean, sponsoredUntil?: string) {
  await api.patch(`/platform-admin/drivers/${id}/sponsorship`, { sponsored, sponsoredUntil });
}

export interface Plan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  periodDays: number;
  description?: string;
  isActive: boolean;
}

export async function fetchAllPlans(): Promise<Plan[]> {
  const { data } = await api.get<{ data: { plans: Plan[] } }>('/platform-admin/plans', { params: { includeInactive: 1 } });
  return data.data.plans;
}

export async function createPlan(input: { planId: string; name: string; amount: number; currency: string; periodDays: number; description?: string }) {
  await api.post('/platform-admin/plans', input);
}

export async function updatePlan(id: string, patch: Partial<Omit<Plan, 'id'>>) {
  await api.patch(`/platform-admin/plans/${id}`, patch);
}

export interface AuditEntry {
  _id: string;
  adminName: string;
  method: string;
  route: string;
  path: string;
  summary: Record<string, unknown>;
  statusCode: number;
  createdAt: string;
}

export async function fetchAuditLog(params: { page: number; q?: string }) {
  const { data } = await api.get<{ data: { entries: AuditEntry[]; total: number; page: number; limit: number } }>('/platform-admin/audit-log', { params });
  return data.data;
}

export interface WeekCount {
  weekStart: string;
  count: number;
}

export interface Adoption {
  registered: { agencies: number; users: number; drivers: number; verifiedDrivers: number };
  active30Days: { agencies: number; users: number; drivers: number };
  customs: { submitted: number; approved: number };
  weekly: { agencies: WeekCount[]; users: WeekCount[]; containers: WeekCount[]; customsSubmissions: WeekCount[] };
}

export async function fetchAdoption(): Promise<Adoption> {
  const { data } = await api.get<{ data: Adoption }>('/platform-admin/adoption');
  return data.data;
}

export interface InstitutionAuditEntry {
  id: string;
  at: string;
  userName: string;
  email?: string;
  institution?: 'customs' | 'agl';
  action: string;
  outcome: 'ok' | 'denied' | 'failed';
  targetLabel?: string;
  detail?: string;
  ip?: string;
}

export async function fetchInstitutionAudit(params: { institution?: string; action?: string; outcome?: string; q?: string; from?: string; to?: string; page?: number }) {
  const { data } = await api.get<{ data: { entries: InstitutionAuditEntry[]; total: number; page: number; limit: number } }>('/platform-admin/institution-audit', { params });
  return data.data;
}
