import { api } from './client';
import { ApiEnvelope, CargoDocument } from '../types/api';

export async function fetchDocuments(params?: { containerId?: string; importerId?: string; documentType?: string }) {
  const { data } = await api.get<ApiEnvelope<{ documents: CargoDocument[] }>>('/documents', { params });
  return data.data.documents;
}

export async function fetchDocument(id: string) {
  const { data } = await api.get<ApiEnvelope<{ document: CargoDocument }>>(`/documents/${id}`);
  return data.data.document;
}

export async function requestUploadUrl(fileName: string, contentType: string, containerId?: string) {
  const { data } = await api.post<ApiEnvelope<{ uploadUrl: string; fileKey: string }>>('/documents/upload-url', {
    fileName,
    contentType,
    containerId,
  });
  return data.data;
}

export async function registerDocument(input: {
  documentType: string;
  importerId: string;
  blId?: string;
  containerId?: string;
  fileKey: string;
  mimeType: string;
  fileSizeBytes?: number;
  pageCount?: number;
}) {
  const { data } = await api.post<ApiEnvelope<{ document: CargoDocument }>>('/documents', input);
  return data.data.document;
}

export async function deleteDocument(id: string) {
  await api.delete(`/documents/${id}`);
}

/**
 * Uploads a local file directly to the presigned R2 URL — bypasses the API
 * server entirely for the actual bytes, per the backend's design.
 */
export async function uploadFileToPresignedUrl(uploadUrl: string, fileUri: string, contentType: string): Promise<void> {
  const response = await fetch(fileUri);
  const blob = await response.blob();
  const putResponse = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob,
  });
  if (!putResponse.ok) {
    throw new Error('Upload failed — please try again.');
  }
}
