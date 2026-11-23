export interface ApiEnvelope<T> {
  success?: boolean;
  data: T;
}

export type JobStatus = 'pending' | 'accepted' | 'declined' | 'picked_up' | 'in_transit' | 'delivered' | 'cancelled';
export type VerificationStatus = 'unverified' | 'pending' | 'verified' | 'rejected';

export interface Driver {
  id: string;
  name: string;
  phone: string;
  verificationStatus: VerificationStatus;
  availability: boolean;
  isActive: boolean;
  ratingAverage: number;
  ratingCount: number;
  location?: string;
  yearsExperience?: number;
  licenseDocumentUrl?: string;
}

export const VEHICLE_TYPES = ['20ft Truck', '40ft Truck', 'Flatbed', 'Low Bed', 'Pickup', 'Van', 'Other'] as const;
export const CONTAINER_SIZES = ['20ft', '40ft', '40ft HC', '45ft'] as const;
export type VehicleType = (typeof VEHICLE_TYPES)[number];
export type ContainerSize = (typeof CONTAINER_SIZES)[number];

export interface Vehicle {
  _id: string;
  vehicleType: VehicleType;
  plateNumber: string;
  containerCompatibility: ContainerSize[];
  isActive: boolean;
}

export interface JobContainer {
  _id: string;
  containerNumber: string;
  size?: string;
  shippingLine?: string;
}

export interface Job {
  _id: string;
  containerId: JobContainer | string;
  pickupLocation: string;
  destination: string;
  requiredDate?: string;
  contactName?: string;
  contactPhone?: string;
  status: JobStatus;
  proofOfDelivery?: { photoUrl?: string; signatureUrl?: string; gps?: { lat: number; lng: number } | null; notes?: string; completedAt?: string };
  rating?: { stars: number; comment?: string };
  createdAt: string;
  updatedAt: string;
}

export function containerNumberOf(job: Job): string {
  return typeof job.containerId === 'string' ? job.containerId : job.containerId?.containerNumber || '—';
}
