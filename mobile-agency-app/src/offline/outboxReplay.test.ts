import { describe, it, expect, vi, beforeEach } from 'vitest';

// The replay rules, tested against an in-memory outbox (the real one is SQLite).
const state = vi.hoisted(() => ({ items: [] as { id: string; kind: string; payload: Record<string, unknown>; createdAt: string; attempts: number }[], failures: [] as unknown[], marked: [] as string[] }));

vi.mock('./outbox', () => ({
  readOutbox: () => [...state.items],
  removeOutbox: (id: string) => void (state.items = state.items.filter((i) => i.id !== id)),
  markOutboxFailed: (id: string) => void state.marked.push(id),
  recordSyncFailure: (f: unknown) => void state.failures.push(f),
  isNetworkError: (e: unknown) => (e as { network?: boolean })?.network === true,
}));
vi.mock('../api/client', () => ({ apiErrorMessage: (e: unknown) => (e as Error).message }));
vi.mock('expo-file-system/legacy', () => ({ getInfoAsync: async () => ({ exists: fileExists }), deleteAsync: async () => undefined }));

let fileExists = true;
const api = vi.hoisted(() => ({
  createImporter: vi.fn(),
  updateImporter: vi.fn(),
  assignDriver: vi.fn(),
  requestUploadUrl: vi.fn(),
  uploadFileToPresignedUrl: vi.fn(),
  registerDocument: vi.fn(),
}));
vi.mock('../api/reportsApi', () => ({ createImporter: api.createImporter, updateImporter: api.updateImporter }));
vi.mock('../api/transportApi', () => ({ assignDriver: api.assignDriver }));
vi.mock('../api/documentApi', () => ({ requestUploadUrl: api.requestUploadUrl, uploadFileToPresignedUrl: api.uploadFileToPresignedUrl, registerDocument: api.registerDocument }));

import { replayOutbox } from './outboxReplay';

const item = (id: string, kind: string, payload: Record<string, unknown> = {}) => ({ id, kind, payload, createdAt: id, attempts: 0 });
const refused = (status: number, message: string) => Object.assign(new Error(message), { response: { status } });

beforeEach(() => {
  state.items = [];
  state.failures = [];
  state.marked = [];
  fileExists = true;
  Object.values(api).forEach((m) => m.mockReset());
});

describe('replayOutbox', () => {
  it('sends each item in order and removes it', async () => {
    state.items = [item('1', 'importer_create', { input: { name: 'A' } }), item('2', 'driver_assign', { containerId: 'c1', input: { driverId: 'd' } })];
    await replayOutbox();
    expect(api.createImporter).toHaveBeenCalledWith({ name: 'A' });
    expect(api.assignDriver).toHaveBeenCalledWith('c1', { driverId: 'd' });
    expect(state.items).toHaveLength(0);
  });

  it('uploads a saved document in three steps and removes it', async () => {
    api.requestUploadUrl.mockResolvedValue({ uploadUrl: 'u', fileKey: 'k' });
    state.items = [item('1', 'document_upload', { fileUri: 'file:///x.pdf', fileName: 'x.pdf', mimeType: 'application/pdf', containerId: 'c', documentType: 'BL', pageCount: 2 })];
    await replayOutbox();
    expect(api.requestUploadUrl).toHaveBeenCalledWith('x.pdf', 'application/pdf', 'c');
    expect(api.uploadFileToPresignedUrl).toHaveBeenCalledWith('u', 'file:///x.pdf', 'application/pdf');
    expect(api.registerDocument).toHaveBeenCalledWith(expect.objectContaining({ fileKey: 'k', documentType: 'BL', pageCount: 2 }));
    expect(state.items).toHaveLength(0);
  });

  it('stops at the first network failure and keeps everything from there on', async () => {
    api.createImporter.mockRejectedValue(Object.assign(new Error('offline'), { network: true }));
    state.items = [item('1', 'importer_create', { input: {} }), item('2', 'driver_assign', { containerId: 'c', input: {} })];
    await replayOutbox();
    expect(state.items).toHaveLength(2);
    expect(api.assignDriver).not.toHaveBeenCalled();
    expect(state.failures).toHaveLength(0);
  });

  it('tells the user when the server refuses something, drops it, and carries on', async () => {
    api.assignDriver.mockRejectedValue(refused(409, 'Driver is no longer available'));
    state.items = [item('1', 'driver_assign', { containerId: 'c', driverName: 'Sam', containerNumber: 'MSKU1234565', input: {} }), item('2', 'importer_create', { name: 'B', input: { name: 'B' } })];
    await replayOutbox();
    expect(state.failures).toEqual([expect.objectContaining({ kind: 'driver_assign', summary: 'Assigning Sam to MSKU1234565', reason: 'Driver is no longer available' })]);
    expect(api.createImporter).toHaveBeenCalled();
    expect(state.items).toHaveLength(0);
  });

  it('keeps an item for another try on a server error', async () => {
    api.updateImporter.mockRejectedValue(refused(503, 'Service unavailable'));
    state.items = [item('1', 'importer_update', { id: 'i', input: {} }), item('2', 'driver_assign', { containerId: 'c', input: {} })];
    await replayOutbox();
    expect(state.items).toHaveLength(2);
    expect(state.marked).toEqual(['1']);
    expect(api.assignDriver).not.toHaveBeenCalled();
  });

  it('records a failure when the saved document file has gone', async () => {
    fileExists = false;
    state.items = [item('1', 'document_upload', { fileUri: 'file:///gone.pdf', fileName: 'g.pdf', mimeType: 'application/pdf', containerId: 'c', documentType: 'Invoice' })];
    await replayOutbox();
    expect(state.failures).toEqual([expect.objectContaining({ kind: 'document_upload', reason: 'The saved file is no longer on this phone' })]);
    expect(state.items).toHaveLength(0);
  });
});
