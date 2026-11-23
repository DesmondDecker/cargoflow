import { api } from './client';

export type Institution = 'customs' | 'agl';
export type Status = 'pending' | 'approved' | 'returned';

export interface PortalUser {
  id: string;
  name: string;
  email: string;
  institution: Institution;
  isSupervisor?: boolean;
}

export const FIELDS = [
  { key: 'cvcNumber', label: 'CVC number' },
  { key: 'billOfLadingNumber', label: 'Bill of lading number' },
  { key: 'shippingAgency', label: 'Shipping agency' },
  { key: 'containerNumber', label: 'Container number' },
  { key: 'documentName', label: 'Document name' },
  { key: 'itsNumber', label: 'ITS number' },
] as const;

export type FieldKey = (typeof FIELDS)[number]['key'];
export type SixFields = Record<FieldKey, string>;

export interface HistoryEntry {
  at: string;
  actorType: 'agent' | 'customs' | 'system';
  actorName: string;
  action: string;
  note?: string;
}

export interface Submission extends SixFields {
  _id: string;
  source: 'agent' | 'customs_assisted';
  submittedByName: string;
  onBehalfOf?: string;
  status: Status;
  submittedAt: string;
  submissionCount: number;
  approvalReference?: string;
  reviewedByName?: string;
  reviewedAt?: string;
  returnReason?: string;
  selfApproved: boolean;
  email: { status: 'none' | 'sent' | 'failed' | 'not_configured'; attemptedAt?: string };
  history: HistoryEntry[];
}

export interface Page<T> {
  submissions: T[];
  total: number;
  page: number;
  limit: number;
}

export async function login(email: string, password: string) {
  const { data } = await api.post<{ data: { user: PortalUser; accessToken: string; refreshToken: string } }>('/institution/auth/login', { email, password });
  return data.data;
}
export async function me() {
  const { data } = await api.get<{ data: { user: PortalUser } }>('/institution/auth/me');
  return data.data.user;
}
export async function logout() {
  await api.post('/institution/auth/logout');
}
export async function changePassword(currentPassword: string, newPassword: string) {
  await api.patch('/institution/auth/password', { currentPassword, newPassword });
}

export async function fetchQueue(params: { status: Status; q?: string; page?: number }) {
  const { data } = await api.get<{ data: Page<Submission> & { counts: Record<Status, number> } }>('/customs/queue', { params });
  return data.data;
}
export async function fetchQueueItem(id: string) {
  const { data } = await api.get<{ data: { submission: Submission } }>(`/customs/queue/${id}`);
  return data.data.submission;
}
export async function approve(id: string) {
  const { data } = await api.post<{ data: { submission: Submission } }>(`/customs/queue/${id}/approve`);
  return data.data.submission;
}
export async function returnSubmission(id: string, reason: string) {
  const { data } = await api.post<{ data: { submission: Submission } }>(`/customs/queue/${id}/return`, { reason });
  return data.data.submission;
}
export async function resendEmail(id: string) {
  const { data } = await api.post<{ data: { submission: Submission } }>(`/customs/queue/${id}/resend-email`);
  return data.data.submission;
}
export async function createAssisted(input: SixFields & { onBehalfOf: string }) {
  const { data } = await api.post<{ data: { submission: Submission; warnings: string[] } }>('/customs/queue', input);
  return data.data;
}

export async function fetchApproved(params: { q?: string; from?: string; to?: string; page?: number }) {
  const { data } = await api.get<{ data: Page<Submission> }>('/customs/approved', { params });
  return data.data;
}
export async function fetchApprovedItem(id: string) {
  const { data } = await api.get<{ data: { submission: Submission } }>(`/customs/approved/${id}`);
  return data.data.submission;
}
export async function downloadApprovedCsv(params: { q?: string; from?: string; to?: string }) {
  const { data } = await api.get<Blob>('/customs/approved.csv', { params, responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `customs-approvals-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export interface Report {
  from: string;
  to: string;
  summary: {
    total: number;
    pending: number;
    approved: number;
    returned: number;
    returnRate: number | null;
    reviewMinutes: { median: number | null; p90: number | null; average: number | null };
    withinTenMinutesPct: number | null;
    emailDelaySeconds: { median: number | null };
  };
  assistedShare: number | null;
  byDay: { date: string; submitted: number; approved: number; returned: number }[];
}
export async function fetchReport(params: { from?: string; to?: string }) {
  const { data } = await api.get<{ data: Report }>('/customs/reports/summary', { params });
  return data.data;
}

export interface OversightEntry {
  id: string;
  at: string;
  userId?: string;
  userName: string;
  email?: string;
  institution?: Institution;
  action: string;
  outcome: 'ok' | 'denied' | 'failed';
  statusCode?: number;
  targetLabel?: string;
  detail?: string;
  ip?: string;
}
export interface OversightFilters {
  user?: string;
  action?: string;
  outcome?: string;
  q?: string;
  from?: string;
  to?: string;
}
export interface StaffRow {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  isSupervisor: boolean;
  lastLoginAt?: string;
  last30Days: { approvals: number; returns: number; recordsViewed: number; exports: number; refusedRequests: number; failedSignIns: number; selfApproved: number };
}

export async function fetchOversightLog(params: OversightFilters & { page?: number }) {
  const { data } = await api.get<{ data: { entries: OversightEntry[]; total: number; page: number; limit: number } }>('/institution/oversight/log', { params });
  return data.data;
}
export async function fetchOversightStaff() {
  const { data } = await api.get<{ data: { institution: Institution; staff: StaffRow[] } }>('/institution/oversight/staff');
  return data.data;
}
export async function downloadOversightCsv(params: OversightFilters) {
  const { data } = await api.get<Blob>('/institution/oversight/log.csv', { params, responseType: 'blob' });
  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = `staff-activity-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
