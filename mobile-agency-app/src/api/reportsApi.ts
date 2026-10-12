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

export async function createImporter(input: { name: string; contactPerson?: string; phone?: string; email?: string; address?: string }) {
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
