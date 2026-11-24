import { api } from '../api/client';

export async function downloadAndShare(path: string, fileName: string, _mimeType: string, _title: string): Promise<void> {
  const response = await api.get<Blob>(path, { responseType: 'blob' });
  const url = URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
