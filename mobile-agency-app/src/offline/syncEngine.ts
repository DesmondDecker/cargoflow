import NetInfo from '@react-native-community/netinfo';
import { changeContainerStatus, updateContainerDates } from '../api/containerApi';
import { readQueuedMutations, removeMutation, markMutationFailed, queueLength } from './mutationQueue';
import { outboxLength } from './outbox';
import { replayOutbox } from './outboxReplay';

export type SyncStatus = 'idle' | 'syncing' | 'offline';

let listeners: ((status: SyncStatus, pending: number) => void)[] = [];
let currentStatus: SyncStatus = 'idle';
let isOnline = true;

export function onSyncStatusChange(listener: (status: SyncStatus, pending: number) => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
}

async function notify(): Promise<void> {
  const [mutations, outbox] = await Promise.all([queueLength(), outboxLength()]);
  const pending = mutations + outbox;
  listeners.forEach((l) => l(currentStatus, pending));
}

/**
 * Replays every queued mutation against the real API, in the order they
 * were made. A 409 (the container changed elsewhere since this mutation
 * was queued — exactly the conflict scenario the backend's `clientVersion`
 * check exists for) drops the mutation rather than retrying forever: the
 * user needs to look at the container fresh and decide what to do, not
 * have a stale offline edit silently clobber someone else's more recent
 * change. Any other failure (network blip mid-sync) is left in the queue
 * to retry next time.
 */
export async function replayQueue(): Promise<void> {
  const mutations = await readQueuedMutations();
  if (mutations.length === 0 && await outboxLength() === 0) return;

  currentStatus = 'syncing';
  await notify();

  for (const mutation of mutations) {
    try {
      if (mutation.type === 'status_change') {
        await changeContainerStatus(mutation.containerId, mutation.payload.status as string, mutation.payload.note as string | undefined);
      } else if (mutation.type === 'date_update') {
        await updateContainerDates(mutation.containerId, mutation.payload as Record<string, string>);
      }
      await removeMutation(mutation.localId);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409 || status === 400) {
        // Conflict or now-invalid mutation (e.g. status no longer valid) —
        // drop it rather than retry forever with the same bad request.
        await removeMutation(mutation.localId);
      } else {
        await markMutationFailed(mutation.localId, (err as Error).message || 'Unknown error');
      }
    }
  }

  // Clients, documents and driver assignments made offline go after the container changes.
  await replayOutbox();

  currentStatus = 'idle';
  await notify();
}

export function startSyncEngine(): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    const nowOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
    const cameBackOnline = nowOnline && !isOnline;
    isOnline = nowOnline;
    currentStatus = isOnline ? 'idle' : 'offline';
    void notify().catch((error: unknown) => console.error('Could not read the offline sync queue', error));

    if (cameBackOnline) {
      replayQueue().catch(() => {
        // swallow — individual mutation failures are already handled above
      });
    }
  });

  return unsubscribe;
}

export function getIsOnline(): boolean {
  return isOnline;
}
