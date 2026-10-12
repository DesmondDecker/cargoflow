import { api } from './client';
import { ApiEnvelope } from '../types/api';

export interface AgencySettings {
  statusPipeline: string[];
  documentTypes: string[];
}

export async function fetchAgencySettings() {
  const { data } = await api.get<ApiEnvelope<{ id: string; name: string; agencyCode: string; settings: AgencySettings }>>('/agency');
  return data.data.settings;
}
