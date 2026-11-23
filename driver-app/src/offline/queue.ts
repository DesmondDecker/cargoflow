import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { apiErrorMessage } from '../api/client';
import { completeJob, respondToJob, updateJobStatus, uploadFile } from '../api/driverApi';

// Things a driver does that must survive having no signal: accept/decline,
// picked up / in transit, and completing a delivery (with its photo and
// signature). Each is tried online first (see actions.ts); only a network
// failure puts it here. They replay in the order they were made when the
// connection is back. An action the server rejects (e.g. the agency cancelled
// the job meanwhile) is NOT retried forever: it moves to `failed` so the
// driver is told, instead of silently disappearing or looping.

export type QueuedAction =
  | { id: string; kind: 'respond'; jobId: string; decision: 'accept' | 'decline'; createdAt: string }
  | { id: string; kind: 'status'; jobId: string; status: 'picked_up' | 'in_transit'; createdAt: string }
  | {
      id: string;
      kind: 'complete';
      jobId: string;
      photoUri: string;
      signatureDataUrl?: string;
      gps: { lat: number; lng: number } | null;
      notes?: string;
      createdAt: string;
    };

export type NewAction =
  | { kind: 'respond'; jobId: string; decision: 'accept' | 'decline' }
  | { kind: 'status'; jobId: string; status: 'picked_up' | 'in_transit' }
  | { kind: 'complete'; jobId: string; photoUri: string; signatureDataUrl?: string; gps: { lat: number; lng: number } | null; notes?: string };

export interface FailedAction {
  action: QueuedAction;
  reason: string;
  failedAt: string;
}

const QUEUE_KEY = 'cargoflow_driver_queue';
const FAILED_KEY = 'cargoflow_driver_failed';

type Listener = (pending: number, failed: number) => void;
const listeners = new Set<Listener>();
let flushing = false;

async function read<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

async function notify(): Promise<void> {
  const [q, f] = await Promise.all([getQueue(), getFailed()]);
  listeners.forEach((l) => l(q.length, f.length));
}

export const getQueue = () => read<QueuedAction>(QUEUE_KEY);
export const getFailed = () => read<FailedAction>(FAILED_KEY);

export function onQueueChange(listener: Listener): () => void {
  listeners.add(listener);
  notify();
  return () => {
    listeners.delete(listener);
  };
}

export async function enqueue(action: NewAction): Promise<QueuedAction> {
  const queued = { ...action, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, createdAt: new Date().toISOString() } as QueuedAction;
  const queue = await getQueue();
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, queued]));
  await notify();
  return queued;
}

export async function clearFailed(): Promise<void> {
  await AsyncStorage.removeItem(FAILED_KEY);
  await notify();
}

export async function clearAllQueued(): Promise<void> {
  await AsyncStorage.multiRemove([QUEUE_KEY, FAILED_KEY]);
  await notify();
}

// True when the request never got an answer (no signal, timeout, server
// unreachable), as opposed to the server answering with an error.
export function isNetworkError(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response;
}

export async function runAction(action: NewAction | QueuedAction): Promise<void> {
  switch (action.kind) {
    case 'respond':
      await respondToJob(action.jobId, action.decision);
      return;
    case 'status':
      await updateJobStatus(action.jobId, action.status);
      return;
    case 'complete': {
      const photoUrl = await uploadFile('delivery_photo', action.photoUri, 'image/jpeg');
      const signatureUrl = action.signatureDataUrl ? await uploadFile('delivery_signature', action.signatureDataUrl, 'image/png') : undefined;
      await completeJob(action.jobId, { photoUrl, signatureUrl, gps: action.gps, notes: action.notes });
      return;
    }
  }
}

async function replace(key: string, items: unknown[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(items));
}

// Replays queued actions oldest first. Stops at the first network failure
// (still offline) and keeps everything from there on for next time.
export async function flushQueue(): Promise<{ synced: number; failed: number }> {
  if (flushing) return { synced: 0, failed: 0 };
  flushing = true;
  let synced = 0;
  let failedCount = 0;
  try {
    let queue = await getQueue();
    while (queue.length > 0) {
      const next = queue[0];
      try {
        await runAction(next);
        synced += 1;
      } catch (err) {
        if (isNetworkError(err)) break;
        failedCount += 1;
        const failed = await getFailed();
        await replace(FAILED_KEY, [...failed, { action: next, reason: apiErrorMessage(err), failedAt: new Date().toISOString() }]);
      }
      queue = queue.slice(1);
      await replace(QUEUE_KEY, queue);
    }
  } finally {
    flushing = false;
    await notify();
  }
  return { synced, failed: failedCount };
}
