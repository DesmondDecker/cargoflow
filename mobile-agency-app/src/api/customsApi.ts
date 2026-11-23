import { api } from './client';
import { ApiEnvelope, CustomsFields, CustomsSubmission } from '../types/api';

export async function fetchCustomsSubmissions(status?: CustomsSubmission['status']) {
  const { data } = await api.get<ApiEnvelope<{ submissions: CustomsSubmission[] }>>('/customs/submissions', { params: status ? { status } : undefined });
  return data.data.submissions;
}

export async function fetchCustomsSubmission(id: string) {
  const { data } = await api.get<ApiEnvelope<{ submission: CustomsSubmission }>>(`/customs/submissions/${id}`);
  return data.data.submission;
}

export async function createCustomsSubmission(fields: CustomsFields) {
  const { data } = await api.post<ApiEnvelope<{ submission: CustomsSubmission; warnings: string[] }>>('/customs/submissions', fields);
  return data.data;
}

export async function resubmitCustomsSubmission(id: string, fields: CustomsFields) {
  const { data } = await api.patch<ApiEnvelope<{ submission: CustomsSubmission; warnings: string[] }>>(`/customs/submissions/${id}`, fields);
  return data.data;
}
