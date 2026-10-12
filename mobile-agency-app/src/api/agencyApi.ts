import { api } from './client';
import { ApiEnvelope } from '../types/api';

export interface AgencyProfile {
  id: string;
  name: string;
  agencyCode: string;
  contactEmail?: string;
  contactPhone?: string;
  address?: string;
}

export interface LabeledOption {
  key: string;
  label: string;
}

export interface AgencySettings {
  statusPipeline: LabeledOption[];
  documentTypes: LabeledOption[];
}

export async function fetchAgencySettings() {
  const { data } = await api.get<ApiEnvelope<AgencyProfile & { settings: AgencySettings }>>('/agency');
  return data.data.settings;
}

export async function fetchAgencyProfile(): Promise<AgencyProfile> {
  const { data } = await api.get<ApiEnvelope<AgencyProfile & { settings: AgencySettings }>>('/agency');
  return data.data;
}

export async function updateAgencyLabels(input: { statusLabels?: Record<string, string>; documentTypeLabels?: Record<string, string> }) {
  const { data } = await api.patch<ApiEnvelope<AgencySettings>>('/agency/labels', input);
  return data.data;
}

export interface FeaturedListings {
  warehouses: { _id: string; businessName: string; location: string; pricePerUnitPerDay: number; photos: string[] }[];
  drivers: { _id: string; name: string; location?: string; yearsExperience?: number }[];
}

export async function fetchFeaturedListings() {
  const { data } = await api.get<ApiEnvelope<FeaturedListings>>('/agency/featured-listings');
  return data.data;
}

export async function updateAgencyProfile(input: { name?: string; contactEmail?: string; contactPhone?: string; address?: string }) {
  const { data } = await api.patch<ApiEnvelope<AgencyProfile>>('/agency/profile', input);
  return data.data;
}

export async function fetchKnownCarriers() {
  const { data } = await api.get<ApiEnvelope<{ carriers: string[] }>>('/agency/known-carriers');
  return data.data.carriers;
}

export interface DemurrageTerm {
  _id: string;
  shippingLine: string;
  freeStorageDays: number | null;
  demurrageGraceDays: number | null;
  notes?: string;
  updatedAt: string;
}

export async function fetchDemurrageTerms() {
  const { data } = await api.get<ApiEnvelope<{ terms: DemurrageTerm[] }>>('/agency/demurrage-terms');
  return data.data.terms;
}

export async function upsertDemurrageTerm(input: {
  shippingLine: string;
  freeStorageDays: number | null;
  demurrageGraceDays: number | null;
  notes?: string;
}) {
  const { data } = await api.put<ApiEnvelope<{ term: DemurrageTerm; containersUpdated: number }>>('/agency/demurrage-terms', input);
  return data.data;
}

export async function deleteDemurrageTerm(id: string) {
  const { data } = await api.delete<ApiEnvelope<{ message: string; containersUpdated: number }>>(`/agency/demurrage-terms/${id}`);
  return data.data;
}
