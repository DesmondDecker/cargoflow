import { api } from './client';
import {
  Agency,
  Analytics,
  ApiEnvelope,
  Driver,
  Expense,
  GatewayDevice,
  Payment,
  PlatformAdmin,
  SubscriptionPlan,
  SubscriptionStatus,
} from '../types';

export async function login(email: string, password: string) {
  const { data } = await api.post<ApiEnvelope<{ admin: { id: string; name: string; email: string }; accessToken: string; refreshToken: string }>>(
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

export async function fetchDrivers(search?: string) {
  const { data } = await api.get<ApiEnvelope<{ drivers: Driver[] }>>('/platform-admin/drivers', { params: { search } });
  return data.data.drivers;
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

export async function createPlatformAdmin(name: string, email: string, password: string) {
  const { data } = await api.post<ApiEnvelope<{ admin: PlatformAdmin }>>('/platform-admin/admins', { name, email, password });
  return data.data.admin;
}

export async function deactivatePlatformAdmin(adminId: string) {
  await api.patch(`/platform-admin/admins/${adminId}/deactivate`);
}
