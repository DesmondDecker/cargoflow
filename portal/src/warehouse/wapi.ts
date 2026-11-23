import { wapi } from './wclient';

export const AMENITIES: { key: string; label: string }[] = [
  { key: 'secured_247', label: '24/7 security' },
  { key: 'cctv', label: 'CCTV' },
  { key: 'forklift_onsite', label: 'Forklift on site' },
  { key: 'loading_dock', label: 'Loading dock' },
  { key: 'climate_controlled', label: 'Climate controlled' },
  { key: 'fire_suppression', label: 'Fire suppression' },
  { key: 'weighbridge', label: 'Weighbridge' },
];

export interface Warehouse {
  id: string;
  ownerName: string;
  phone: string;
  businessName: string;
  location: string;
  capacityUnit: 'sqm' | 'container_slot';
  totalCapacity: number;
  availableCapacity: number;
  pricePerUnitPerDay: number;
  amenities: string[];
  photos: string[];
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  isActive: boolean;
  ratingTotal: number;
  ratingCount: number;
}

export type BookingStatus = 'requested' | 'confirmed' | 'declined' | 'in_storage' | 'collected' | 'cancelled';

export interface Booking {
  _id: string;
  unitsBooked: number;
  startDate: string;
  endDate: string;
  estimatedTotalPrice: number;
  pricePerUnitPerDay: number;
  contactName?: string;
  contactPhone?: string;
  notes?: string;
  status: BookingStatus;
  containerId?: { containerNumber: string } | null;
  agencyId?: { name: string } | null;
  checkIn?: { notes?: string; photoUrls?: string[]; completedAt?: string };
  checkOut?: { notes?: string; photoUrls?: string[]; completedAt?: string };
  createdAt: string;
}

type Envelope<T> = { data: { data: T } };

export async function signup(input: {
  ownerName: string;
  phone: string;
  password: string;
  businessName: string;
  location: string;
  capacityUnit: 'sqm' | 'container_slot';
  totalCapacity: number;
  pricePerUnitPerDay: number;
  amenities: string[];
}) {
  const { data } = await wapi.post<{ data: { warehouse: Warehouse; accessToken: string; refreshToken: string } }>('/warehouse/auth/signup', input);
  return data.data;
}

export async function login(phone: string, password: string) {
  const { data } = await wapi.post<{ data: { warehouse: Warehouse; accessToken: string; refreshToken: string } }>('/warehouse/auth/login', { phone, password });
  return data.data;
}

export async function me(): Promise<Warehouse> {
  const { data } = await wapi.get<Envelope<{ warehouse: Warehouse }>['data']>('/warehouse/me');
  return data.data.warehouse;
}

export async function updateListing(patch: { businessName?: string; location?: string; pricePerUnitPerDay?: number; amenities?: string[]; isActive?: boolean }) {
  const { data } = await wapi.patch<Envelope<{ warehouse: Warehouse }>['data']>('/warehouse/listing', patch);
  return data.data.warehouse;
}

export async function updateCapacity(totalCapacity: number) {
  const { data } = await wapi.patch<Envelope<{ warehouse: Warehouse }>['data']>('/warehouse/capacity', { totalCapacity });
  return data.data.warehouse;
}

export async function addPhotos(photoUrls: string[]) {
  const { data } = await wapi.post<Envelope<{ warehouse: Warehouse }>['data']>('/warehouse/photos', { photoUrls });
  return data.data.warehouse;
}

export async function fetchBookings(status?: BookingStatus): Promise<Booking[]> {
  const { data } = await wapi.get<Envelope<{ bookings: Booking[] }>['data']>('/warehouse/bookings', { params: status ? { status } : undefined });
  return data.data.bookings;
}

export async function respond(id: string, decision: 'accept' | 'decline') {
  await wapi.post(`/warehouse/bookings/${id}/respond`, { decision });
}

export async function checkIn(id: string, input: { notes?: string; photoUrls?: string[] }) {
  await wapi.post(`/warehouse/bookings/${id}/check-in`, input);
}

export async function checkOut(id: string, input: { notes?: string; photoUrls?: string[] }) {
  await wapi.post(`/warehouse/bookings/${id}/check-out`, input);
}

// Photos go straight from the browser to storage on a short-lived link; the
// API stores only the resulting address.
export async function uploadPhoto(purpose: 'warehouse_photo' | 'storage_condition_photo', file: File): Promise<string> {
  const { data } = await wapi.post<{ data: { uploadUrl: string; fileUrl: string } }>('/warehouse/upload-url', { purpose, contentType: file.type || 'image/jpeg' });
  const put = await fetch(data.data.uploadUrl, { method: 'PUT', headers: { 'Content-Type': file.type || 'image/jpeg' }, body: file });
  if (!put.ok) throw new Error('The photo could not be uploaded. Please try again.');
  return data.data.fileUrl;
}
