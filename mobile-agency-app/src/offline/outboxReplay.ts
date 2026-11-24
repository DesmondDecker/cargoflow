import * as FileSystem from 'expo-file-system/legacy';
import { apiErrorMessage } from '../api/client';
import { registerDocument, requestUploadUrl, uploadFileToPresignedUrl } from '../api/documentApi';
import { createImporter, updateImporter } from '../api/reportsApi';
import { assignDriver } from '../api/transportApi';
import { isNetworkError, markOutboxFailed, OutboxItem, readOutbox, recordSyncFailure, removeOutbox } from './outbox';

type P = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

function describe(item: OutboxItem): string {
  const p = item.payload as P;
  switch (item.kind) {
    case 'importer_create':
      return `Adding client ${p.name}`;
    case 'importer_update':
      return `Editing client ${p.name ?? ''}`.trim();
    case 'document_upload':
      return `Uploading ${p.documentType}${p.containerNumber ? ` for ${p.containerNumber}` : ''}`;
    case 'driver_assign':
      return `Assigning ${p.driverName ?? 'a driver'}${p.containerNumber ? ` to ${p.containerNumber}` : ''}`;
  }
}

async function run(item: OutboxItem): Promise<void> {
  const p = item.payload as P;
  switch (item.kind) {
    case 'importer_create':
      await createImporter(p.input);
      return;
    case 'importer_update':
      await updateImporter(p.id, p.input);
      return;
    case 'document_upload': {
      const info = await FileSystem.getInfoAsync(p.fileUri);
      if (!info.exists) throw Object.assign(new Error('The saved file is no longer on this phone'), { response: { status: 410 } });
      const { uploadUrl, fileKey } = await requestUploadUrl(p.fileName, p.mimeType, p.containerId);
      await uploadFileToPresignedUrl(uploadUrl, p.fileUri, p.mimeType);
      await registerDocument({ documentType: p.documentType, importerId: p.importerId, blId: p.blId, containerId: p.containerId, fileKey, mimeType: p.mimeType, pageCount: p.pageCount });
      await FileSystem.deleteAsync(p.fileUri, { idempotent: true });
      return;
    }
    case 'driver_assign':
      await assignDriver(p.containerId, p.input);
      return;
  }
}

// Sends everything in the outbox, oldest first. Stops at the first network
// failure (still offline) and keeps the rest. A request the server refuses
// (it can no longer work as asked) is removed and recorded for the user; a
// server error (5xx) is kept for another try.
export async function replayOutbox(): Promise<void> {
  for (const item of await readOutbox()) {
    try {
      await run(item);
      await removeOutbox(item.id);
    } catch (err) {
      if (isNetworkError(err)) return;
      const status = (err as { response?: { status?: number } })?.response?.status ?? 0;
      if (status >= 500) {
        await markOutboxFailed(item.id, apiErrorMessage(err));
        return;
      }
      await recordSyncFailure({ kind: item.kind, summary: describe(item), reason: apiErrorMessage(err) });
      if (item.kind === 'document_upload') await FileSystem.deleteAsync((item.payload as P).fileUri, { idempotent: true }).catch(() => undefined);
      await removeOutbox(item.id);
    }
  }
}
