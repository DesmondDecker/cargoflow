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
  deviceId: string;
  deviceLabel?: string;
}) {
  const { data } = await api.post<ApiEnvelope<AuthResponse>>('/auth/register-agency', input);
  return data.data;
}

export async function joinAgency(input: {
  agencyCode: string;
  password: string;
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
  password: string;
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
