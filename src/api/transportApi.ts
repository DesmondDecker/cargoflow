import { api } from './client';
import { ApiEnvelope, DriverCandidate, TransportAssignment } from '../types/api';

export async function fetchCandidateDrivers(containerId: string) {
  const { data } = await api.get<ApiEnvelope<{ containerSize?: string; drivers: DriverCandidate[] }>>(
    `/containers/${containerId}/transport/candidates`
  );
  return data.data;
}

export async function assignDriver(
  containerId: string,
  input: {
    driverId: string;
    vehicleId: string;
    pickupLocation: string;
    destination: string;
    requiredDate?: string;
    contactName?: string;
    contactPhone?: string;
  }
) {
  const { data } = await api.post<ApiEnvelope<{ assignment: TransportAssignment }>>(
    `/containers/${containerId}/transport/assign`,
    input
  );
  return data.data.assignment;
}

export async function fetchAgencyTransportJobs(params?: { status?: string; containerId?: string }) {
  const { data } = await api.get<ApiEnvelope<{ jobs: TransportAssignment[] }>>('/transport', { params });
  return data.data.jobs;
}

export async function rateDriver(assignmentId: string, stars: number, comment?: string) {
  const { data } = await api.post<ApiEnvelope<{ assignment: TransportAssignment }>>(`/transport/${assignmentId}/rate`, {
    stars,
    comment,
  });
  return data.data.assignment;
}
