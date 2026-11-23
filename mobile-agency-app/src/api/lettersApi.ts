import { api, baseURL, getAccessToken } from './client';
import { ApiEnvelope, Letter, LetterSummary, LetterTemplate } from '../types/api';

export async function fetchLetterTemplates() {
  const { data } = await api.get<ApiEnvelope<{ templates: LetterTemplate[] }>>('/letters/templates');
  return data.data.templates;
}

export async function fetchContainerLetters(containerId: string) {
  const { data } = await api.get<ApiEnvelope<{ letters: LetterSummary[] }>>(`/containers/${containerId}/letters`);
  return data.data.letters;
}

export async function createLetter(containerId: string, templateKey: string) {
  const { data } = await api.post<ApiEnvelope<{ letter: Letter }>>(`/containers/${containerId}/letters`, { templateKey });
  return data.data.letter;
}

export async function fetchLetter(id: string) {
  const { data } = await api.get<ApiEnvelope<{ letter: Letter }>>(`/letters/${id}`);
  return data.data.letter;
}

export async function saveLetter(id: string, fields: Record<string, string>) {
  const { data } = await api.patch<ApiEnvelope<{ letter: Letter }>>(`/letters/${id}`, { fields });
  return data.data.letter;
}

export async function deleteLetter(id: string) {
  await api.delete(`/letters/${id}`);
}

export async function letterDownloadRequest(id: string): Promise<{ url: string; headers: Record<string, string> }> {
  const token = await getAccessToken();
  return { url: `${baseURL}/letters/${id}/download`, headers: { Authorization: `Bearer ${token}` } };
}
