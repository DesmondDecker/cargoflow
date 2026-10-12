import { api } from './client';
import { ApiEnvelope, ContainerCaseFile, ContainerListItem, DashboardStats, AttentionLevel, ExternalTrackingLookup } from '../types/api';

export async function fetchContainers(params?: {
  status?: string;
  attentionLevel?: AttentionLevel;
  shippingLine?: string;
  search?: string;
  page?: number;
}) {
  const { data } = await api.get<ApiEnvelope<{
    containers: ContainerListItem[];
    pagination: { total: number; pages: number; page: number };
    externalLookup?: ExternalTrackingLookup;
  }>>('/containers', { params });
  return data.data;
}

export async function fetchDashboardStats() {
  const { data } = await api.get<ApiEnvelope<DashboardStats>>('/containers/dashboard');
  return data.data;
}

export async function createContainer(input: { containerNumber: string; importerId: string; blId: string; size?: string }) {
  const { data } = await api.post<ApiEnvelope<{ container: ContainerListItem }>>('/containers', input);
  return data.data.container;
}

export async function fetchContainerCaseFile(id: string) {
  const { data } = await api.get<ApiEnvelope<ContainerCaseFile>>(`/containers/${id}`);
  return data.data;
}

export async function changeContainerStatus(id: string, status: string, note?: string) {
  const { data } = await api.patch<ApiEnvelope<{ container: ContainerListItem }>>(`/containers/${id}/status`, { status, note });
  return data.data;
}

export async function updateContainerDates(id: string, dates: Record<string, string>) {
  const { data } = await api.patch<ApiEnvelope<{ container: ContainerListItem }>>(`/containers/${id}/dates`, dates);
  return data.data;
}

export async function updateContainerDetails(
  id: string,
  input: Partial<{ containerNumber: string; shippingLine: string; vessel: string; size: string; blId: string; importerId: string }>
) {
  const { data } = await api.patch<ApiEnvelope<{ container: ContainerListItem }>>(`/containers/${id}/details`, input);
  return data.data;
}

export async function trackCodes(codes: string) {
  const { data } = await api.get<ApiEnvelope<{ results: { code: string; type: string; id?: string; blNumber?: string; containerNumber?: string; containerId?: string }[] }>>(
    '/search/track',
    { params: { codes } }
  );
  return data.data;
}

export async function refreshContainerTracking(id: string) {
  const { data } = await api.post<ApiEnvelope<{ liveTracking: ContainerCaseFile['container']['liveTracking'] }>>(
    `/containers/${id}/refresh-tracking`
  );
  return data.data;
}

export async function resolveCode(code: string) {
  const { data } = await api.get<ApiEnvelope<{
    type: string;
    id?: string;
    containerNumber?: string;
    blNumber?: string;
    code?: string;
    carrierName?: string;
    publicTrackingUrl?: string;
  }>>(`/search/resolve/${encodeURIComponent(code)}`);
  return data.data;
}

export async function globalSearch(q: string) {
  const { data } = await api.get<
    ApiEnvelope<{
      results: {
        containers: { _id: string; containerNumber: string; status: string; attentionLevel: AttentionLevel }[];
        billsOfLading: { _id: string; blNumber: string; shippingLine?: string }[];
        importers: { _id: string; name: string }[];
      };
    }>
  >('/search', { params: { q } });
  return data.data;
}
