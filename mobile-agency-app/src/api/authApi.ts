import { api } from './client';
import { AgencySummary, ApiEnvelope, AuthUser } from '../types/api';

interface AuthResponse {
  agency: AgencySummary;
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

export async function registerAgency(input: {
  agencyName: string;
  ownerName: string;
  ownerPhone?: string;
  ownerEmail?: string;
  password: string;
  pin: string;
  deviceId: string;
  deviceLabel?: string;
}) {
  const { data } = await api.post<ApiEnvelope<AuthResponse>>('/auth/register-agency', input);
  return data.data;
}

export async function joinAgency(input: {
  agencyCode: string;
  password: string;
  pin: string;
  name: string;
  phone?: string;
  email?: string;
  deviceId: string;
  deviceLabel?: string;
}) {
  const { data } = await api.post<ApiEnvelope<AuthResponse>>('/auth/join', input);
  return data.data;
}

export async function login(input: {
  agencyCode: string;
  identifier: string;
  pin: string;
  deviceId: string;
  deviceLabel?: string;
}) {
  const { data } = await api.post<ApiEnvelope<AuthResponse>>('/auth/login', input);
  return data.data;
}

export async function fetchMe() {
  const { data } = await api.get<ApiEnvelope<{ user: AuthUser; agency: AgencySummary }>>('/auth/me');
  return data.data;
}

export async function setPushToken(pushToken: string | null) {
  const { data } = await api.patch<ApiEnvelope<{ message: string }>>('/auth/push-token', { pushToken });
  return data.data;
}

export async function fetchNotificationPrefs() {
  const { data } = await api.get<ApiEnvelope<{ prefs: { dailySummary: boolean; driverUpdates: boolean }; pushRegistered: boolean }>>('/auth/notification-prefs');
  return data.data;
}

export async function updateNotificationPrefs(prefs: { dailySummary?: boolean; driverUpdates?: boolean }) {
  const { data } = await api.patch<ApiEnvelope<{ prefs: { dailySummary: boolean; driverUpdates: boolean } }>>('/auth/notification-prefs', prefs);
  return data.data.prefs;
}

export interface TeamMember {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  role: 'owner' | 'admin' | 'staff';
  isActive: boolean;
  lastLoginAt?: string;
}

export async function fetchTeam() {
  const { data } = await api.get<ApiEnvelope<{ users: TeamMember[]; you: string }>>('/agency/users');
  return data.data;
}

export async function updateTeamMember(id: string, change: { role?: TeamMember['role']; isActive?: boolean }) {
  const { data } = await api.patch<ApiEnvelope<{ user: TeamMember }>>(`/agency/users/${id}`, change);
  return data.data.user;
}

export async function changeAgencyPassword(currentPassword: string, newPassword: string) {
  await api.patch('/auth/agency-password', { currentPassword, newPassword });
}

export async function changeMyPin(currentPin: string, newPin: string, deviceId?: string) {
  const { data } = await api.patch<ApiEnvelope<{ message: string; accessToken: string; refreshToken: string }>>('/auth/pin', { currentPin, newPin, deviceId });
  return data.data;
}

export async function resetTeamMemberPin(id: string, newPin: string) {
  const { data } = await api.patch<ApiEnvelope<{ message: string }>>(`/agency/users/${id}/pin`, { newPin });
  return data.data.message;
}
