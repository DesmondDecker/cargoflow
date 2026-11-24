import { api } from './client';
import { ApiEnvelope, LiveTracking, ContainerCaseFile, ContainerListItem, DashboardStats, AttentionLevel, ExternalTrackingLookup } from '../types/api';

const TRACKING_LOOKUP_TIMEOUT_MS = 70_000;

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

export type TrackingReferenceType = 'container' | 'bill_of_lading';

export async function trackUnregisteredContainer(code: string, referenceType: TrackingReferenceType = 'container', carrierName?: string) {
  const { data } = await api.get<ApiEnvelope<{
    containerNumber: string;
    trackingNumber: string;
    trackingType: TrackingReferenceType;
    matchedContainerNumber?: string;
    tracking?: LiveTracking;
    saved: false;
  }>>(
    '/search/track-live',
    {
      params: { code, referenceType, ...(carrierName ? { carrierName } : {}) },
      timeout: TRACKING_LOOKUP_TIMEOUT_MS,
    }
  );
  return data.data;
}

export interface SavedTrackingItem {
  _id: string;
  containerNumber: string;
  trackingType: TrackingReferenceType;
  tracking: LiveTracking;
  createdAt: string;
  updatedAt: string;
}

export async function fetchSavedTracking() {
  const { data } = await api.get<ApiEnvelope<{ savedTracking: SavedTrackingItem[] }>>('/search/saved-tracking');
  return data.data.savedTracking;
}

export async function saveUnregisteredTracking(containerNumber: string, tracking: LiveTracking, trackingType: TrackingReferenceType = 'container') {
  const { data } = await api.post<ApiEnvelope<{ savedTracking: SavedTrackingItem }>>('/search/saved-tracking', {
    containerNumber,
    tracking,
    trackingType,
  });
  return data.data.savedTracking;
}

export async function deleteSavedTracking(containerNumber: string, trackingType: TrackingReferenceType = 'container') {
  await api.delete(`/search/saved-tracking/${encodeURIComponent(containerNumber)}`, { params: { trackingType } });
}

export async function refreshContainerTracking(id: string) {
  const { data } = await api.post<ApiEnvelope<{ liveTracking: ContainerCaseFile['container']['liveTracking'] }>>(
    `/containers/${id}/refresh-tracking`
  );
  return data.data;
}

export async function setContainerShippingLine(id: string, shippingLine: string) {
  const { data } = await api.patch<ApiEnvelope<{ container: ContainerListItem }>>(`/containers/${id}/shipping-line`, { shippingLine });
  return data.data.container;
}

export async function pasteContainerTracking(id: string, text: string) {
  const { data } = await api.post<ApiEnvelope<{ liveTracking: LiveTracking; warnings: string[] }>>(
    `/containers/${id}/paste-tracking`,
    { text }
  );
  return data.data;
}

export interface TrackingProposal {
  containerFound: boolean;
  status?: string;
  latestEvent?: { description: string; at?: string };
  eta?: string;
  departedAt?: string;
  vesselName?: string;
}

export async function previewContainerTracking(id: string, text: string) {
  const { data } = await api.post<ApiEnvelope<{ proposal: TrackingProposal }>>(`/containers/${id}/preview-tracking`, { text });
  return data.data.proposal;
}

export async function saveReviewedTracking(
  id: string,
  input: {
    carrierName: string;
    status: string;
    vesselName?: string;
    eta?: string;
    departedAt?: string;
    latestEvent?: { description: string; location?: string; at?: string };
  }
) {
  const { data } = await api.post<ApiEnvelope<{ liveTracking: LiveTracking }>>(`/containers/${id}/save-tracking`, input);
  return data.data.liveTracking;
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
    detection?: {
      type: 'container' | 'bill_of_lading' | 'unknown';
      carrierName?: string;
      confidence: 'high' | 'medium' | 'low';
      carrierConfidence: 'high' | 'medium' | 'low';
      source: string;
      containerNumberValidation?: { formatValid: boolean; checkDigitValid: boolean | null; issue?: string };
    };
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

export interface TrackingSourceSummary {
  carrier: string;
  liveSources: string[];
}

export async function fetchTrackingSources() {
  const { data } = await api.get<ApiEnvelope<{ carriers: TrackingSourceSummary[] }>>('/containers/tracking-sources');
  return data.data.carriers;
}
