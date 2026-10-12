import { api } from './client';
import { ApiEnvelope } from '../types/api';

export interface BillOfLading {
  _id: string;
  importerId: string;
  blNumber: string;
  shippingLine?: string;
  vesselName?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  etd?: string;
  eta?: string;
}

export async function fetchBillsOfLading(params?: { importerId?: string }) {
  const { data } = await api.get<ApiEnvelope<{ billsOfLading: BillOfLading[] }>>('/bills-of-lading', { params });
  return data.data.billsOfLading;
}

export async function createBillOfLading(input: {
  importerId: string;
  blNumber: string;
  shippingLine?: string;
  vesselName?: string;
  portOfLoading?: string;
  portOfDischarge?: string;
  etd?: string;
  eta?: string;
}) {
  const { data } = await api.post<ApiEnvelope<{ billOfLading: BillOfLading }>>('/bills-of-lading', input);
  return data.data.billOfLading;
}
