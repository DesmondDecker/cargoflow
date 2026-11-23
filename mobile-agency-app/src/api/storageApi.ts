import { api } from './client';
import { ApiEnvelope } from '../types/api';

export interface StorageCandidate {
  _id: string;
  businessName: string;
  location: string;
  capacityUnit: 'sqm' | 'container_slot';
  availableCapacity: number;
  pricePerUnitPerDay: number;
  amenities: string[];
  photos: string[];
  sponsored: boolean;
  ratingAverage: number;
  ratingCount: number;
}

export type BookingStatus = 'requested' | 'confirmed' | 'declined' | 'in_storage' | 'collected' | 'cancelled';

export interface StorageBooking {
  _id: string;
  unitsBooked: number;
  startDate: string;
  endDate: string;
  pricePerUnitPerDay: number;
  estimatedTotalPrice: number;
  status: BookingStatus;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  rating?: { stars: number; comment?: string };
  containerId?: { _id: string; containerNumber: string; status: string } | null;
  warehouseId?: { _id: string; businessName: string; location: string; phone?: string } | null;
  checkIn?: { notes?: string; completedAt?: string };
  checkOut?: { notes?: string; completedAt?: string };
  createdAt: string;
}

export async function fetchStorageCandidates(containerId: string, location?: string) {
  const { data } = await api.get<ApiEnvelope<{ warehouses: StorageCandidate[] }>>(`/containers/${containerId}/storage/candidates`, { params: location ? { location } : undefined });
  return data.data.warehouses;
}

export async function bookStorage(
  containerId: string,
  input: { warehouseId: string; unitsBooked: number; startDate: string; endDate: string; contactName?: string; contactPhone?: string; notes?: string }
) {
  const { data } = await api.post<ApiEnvelope<{ booking: StorageBooking }>>(`/containers/${containerId}/storage/book`, input);
  return data.data.booking;
}

export async function fetchStorageBookings(status?: BookingStatus) {
  const { data } = await api.get<ApiEnvelope<{ bookings: StorageBooking[] }>>('/storage', { params: status ? { status } : undefined });
  return data.data.bookings;
}

export async function cancelStorageBooking(id: string) {
  await api.post(`/storage/${id}/cancel`, {});
}

export async function rateStorageBooking(id: string, stars: number, comment?: string) {
  await api.post(`/storage/${id}/rate`, { stars, comment });
}
