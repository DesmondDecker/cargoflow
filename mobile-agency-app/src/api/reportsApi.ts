import { api } from './client';
import { ApiEnvelope, Importer, ImporterProfile, DailyDigest } from '../types/api';

export async function fetchImporters(params?: { search?: string; page?: number }) {
  const { data } = await api.get<ApiEnvelope<{ importers: Importer[]; pagination: { total: number; pages: number; page: number } }>>(
    '/importers',
    { params }
  );
  return data.data;
}

export async function fetchImporterProfile(id: string) {
  const { data } = await api.get<ApiEnvelope<ImporterProfile>>(`/importers/${id}`);
  return data.data;
}

export interface ImporterInput {
  name?: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
  addressLine2?: string;
  city?: string;
  country?: string;
  tin?: string;
}

export async function updateImporter(id: string, input: ImporterInput) {
  const { data } = await api.patch<ApiEnvelope<{ importer: Importer }>>(`/importers/${id}`, input);
  return data.data.importer;
}

export type IdSide = 'front' | 'back';

export async function uploadIdCard(importerId: string, side: IdSide, uri: string, contentType: 'image/jpeg' | 'image/png' | 'image/webp') {
  const { data: up } = await api.post<ApiEnvelope<{ uploadUrl: string; fileKey: string }>>(`/importers/${importerId}/id-card/upload-url`, { side, contentType });
  const blob = await (await fetch(uri)).blob();
  const put = await fetch(up.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': contentType }, body: blob });
  if (!put.ok) throw new Error('The photo could not be uploaded. Please try again.');
  const { data } = await api.post<ApiEnvelope<{ importer: Importer }>>(`/importers/${importerId}/id-card`, { side, fileKey: up.data.fileKey });
  return data.data.importer;
}

export async function getIdCardLink(importerId: string, side: IdSide) {
  const { data } = await api.get<ApiEnvelope<{ url: string; expiresIn: number }>>(`/importers/${importerId}/id-card/${side}`);
  return data.data;
}

export async function removeIdCard(importerId: string, side: IdSide) {
  await api.delete(`/importers/${importerId}/id-card/${side}`);
}

export async function createImporter(input: ImporterInput & { name: string }) {
  const { data } = await api.post<ApiEnvelope<{ importer: Importer }>>('/importers', input);
  return data.data;
}

export async function fetchLatestDigest() {
  const { data } = await api.get<ApiEnvelope<{ digest: DailyDigest }>>('/reports/daily-digest');
  return data.data;
}

export async function runDigestNow() {
  const { data } = await api.post<ApiEnvelope<{ digest: DailyDigest }>>('/reports/daily-digest/run');
  return data.data;
}

export interface ReportSummary {
  since?: string;
  containers: {
    total: number;
    open: number;
    addedInPeriod: number;
    byStatus: { status: string; count: number }[];
    byCarrier: { carrier: string; count: number }[];
    attention: { urgent: number; attention: number; normal: number };
  };
  finance: {
    byCurrency: { currency: string; approved: number; pending: number; rejected: number; count: number }[];
    approvedByCategory: { currency: string; category: string; total: number }[];
  };
  documents: { total: number; verified: number; needsReview: number };
}

export async function fetchReportSummary(days: string) {
  const { data } = await api.get<ApiEnvelope<ReportSummary>>('/reports/summary', { params: { days } });
  return data.data;
}
