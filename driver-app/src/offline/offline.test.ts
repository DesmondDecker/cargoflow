import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxiosError } from 'axios';

// In-memory AsyncStorage.
const store = new Map<string, string>();
vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: async (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: async (k: string, v: string) => void store.set(k, v),
    removeItem: async (k: string) => void store.delete(k),
    multiRemove: async (keys: string[]) => keys.forEach((k) => store.delete(k)),
  },
}));
vi.mock('../api/client', () => ({ apiErrorMessage: (e: unknown) => (e instanceof Error ? e.message : 'error') }));

const api = vi.hoisted(() => ({
  respondToJob: vi.fn(),
  updateJobStatus: vi.fn(),
  completeJob: vi.fn(),
  uploadFile: vi.fn(),
}));
vi.mock('../api/driverApi', () => api);

import { enqueue, flushQueue, getFailed, getQueue, isNetworkError } from './queue';
import { performAction } from './actions';
import { overlay } from './jobCache';
import { Job } from '../types';

const networkError = () => new AxiosError('Network Error', 'ERR_NETWORK');
const serverError = (status: number, message: string) =>
  new AxiosError(message, String(status), undefined, undefined, { status, data: {}, statusText: '', headers: {}, config: {} as never });

const job = (id: string, status: Job['status']): Job => ({
  _id: id,
  containerId: 'c',
  pickupLocation: 'a',
  destination: 'b',
  status,
  createdAt: '',
  updatedAt: '',
});

beforeEach(() => {
  store.clear();
  Object.values(api).forEach((m) => m.mockReset());
});

describe('isNetworkError', () => {
  it('is true only when there was no response', () => {
    expect(isNetworkError(networkError())).toBe(true);
    expect(isNetworkError(serverError(400, 'bad'))).toBe(false);
    expect(isNetworkError(new Error('x'))).toBe(false);
  });
});

describe('performAction', () => {
  it('sends straight away when online and queues nothing', async () => {
    api.respondToJob.mockResolvedValue({});
    expect(await performAction({ kind: 'respond', jobId: '1', decision: 'accept' })).toEqual({ queued: false });
    expect(await getQueue()).toHaveLength(0);
  });

  it('queues when there is no network', async () => {
    api.respondToJob.mockRejectedValue(networkError());
    expect(await performAction({ kind: 'respond', jobId: '1', decision: 'accept' })).toEqual({ queued: true });
    expect(await getQueue()).toHaveLength(1);
  });

  it('does not queue when the server rejects it', async () => {
    api.respondToJob.mockRejectedValue(serverError(400, 'already responded'));
    await expect(performAction({ kind: 'respond', jobId: '1', decision: 'accept' })).rejects.toThrow('already responded');
    expect(await getQueue()).toHaveLength(0);
  });
});

describe('flushQueue', () => {
  it('replays in order and empties the queue', async () => {
    const order: string[] = [];
    api.respondToJob.mockImplementation(async () => void order.push('respond'));
    api.updateJobStatus.mockImplementation(async (_id: string, s: string) => void order.push(s));
    await enqueue({ kind: 'respond', jobId: '1', decision: 'accept' });
    await enqueue({ kind: 'status', jobId: '1', status: 'picked_up' });
    await enqueue({ kind: 'status', jobId: '1', status: 'in_transit' });
    expect(await flushQueue()).toEqual({ synced: 3, failed: 0 });
    expect(order).toEqual(['respond', 'picked_up', 'in_transit']);
    expect(await getQueue()).toHaveLength(0);
  });

  it('stops at the first network failure and keeps the rest', async () => {
    api.respondToJob.mockRejectedValue(networkError());
    await enqueue({ kind: 'respond', jobId: '1', decision: 'accept' });
    await enqueue({ kind: 'status', jobId: '1', status: 'picked_up' });
    expect(await flushQueue()).toEqual({ synced: 0, failed: 0 });
    expect(await getQueue()).toHaveLength(2);
    expect(api.updateJobStatus).not.toHaveBeenCalled();
  });

  it('moves a server-rejected action to failed instead of retrying it forever', async () => {
    api.respondToJob.mockRejectedValue(serverError(400, 'cancelled by agency'));
    api.updateJobStatus.mockResolvedValue({});
    await enqueue({ kind: 'respond', jobId: '1', decision: 'accept' });
    await enqueue({ kind: 'status', jobId: '2', status: 'picked_up' });
    expect(await flushQueue()).toEqual({ synced: 1, failed: 1 });
    expect(await getQueue()).toHaveLength(0);
    const failed = await getFailed();
    expect(failed).toHaveLength(1);
    expect(failed[0].reason).toBe('cancelled by agency');
  });

  it('completes a delivery by uploading the photo and signature first', async () => {
    api.uploadFile.mockImplementation(async (purpose: string) => `https://files/${purpose}`);
    api.completeJob.mockResolvedValue({});
    await enqueue({ kind: 'complete', jobId: '9', photoUri: 'file://p.jpg', signatureDataUrl: 'data:image/png;base64,AAA', gps: { lat: 8.4, lng: -13.2 }, notes: 'ok' });
    expect(await flushQueue()).toEqual({ synced: 1, failed: 0 });
    expect(api.completeJob).toHaveBeenCalledWith('9', {
      photoUrl: 'https://files/delivery_photo',
      signatureUrl: 'https://files/delivery_signature',
      gps: { lat: 8.4, lng: -13.2 },
      notes: 'ok',
    });
  });
});

describe('overlay', () => {
  it('shows queued actions as already applied, in order', () => {
    const queue = [
      { id: 'a', kind: 'respond' as const, jobId: '1', decision: 'accept' as const, createdAt: '' },
      { id: 'b', kind: 'status' as const, jobId: '1', status: 'picked_up' as const, createdAt: '' },
      { id: 'c', kind: 'respond' as const, jobId: '2', decision: 'decline' as const, createdAt: '' },
    ];
    const result = overlay([job('1', 'pending'), job('2', 'pending'), job('3', 'pending')], queue);
    expect(result.map((j) => j.status)).toEqual(['picked_up', 'declined', 'pending']);
  });
});
