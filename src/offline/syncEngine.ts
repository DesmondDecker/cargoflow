import NetInfo from '@react-native-community/netinfo';
import { changeContainerStatus, updateContainerDates } from '../api/containerApi';
import { readQueuedMutations, removeMutation, markMutationFailed, queueLength } from './mutationQueue';

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

function notify() {
  const pending = queueLength();
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
  const mutations = readQueuedMutations();
  if (mutations.length === 0) return;

  currentStatus = 'syncing';
  notify();

  for (const mutation of mutations) {
    try {
      if (mutation.type === 'status_change') {
        await changeContainerStatus(mutation.containerId, mutation.payload.status as string, mutation.payload.note as string | undefined);
      } else if (mutation.type === 'date_update') {
        await updateContainerDates(mutation.containerId, mutation.payload as Record<string, string>);
      }
      removeMutation(mutation.localId);
    } catch (err) {
      const status = (err as { response?: { status?: number } })?.response?.status;
      if (status === 409 || status === 400) {
        // Conflict or now-invalid mutation (e.g. status no longer valid) —
        // drop it rather than retry forever with the same bad request.
        removeMutation(mutation.localId);
      } else {
        markMutationFailed(mutation.localId, (err as Error).message || 'Unknown error');
      }
    }
  }

  currentStatus = 'idle';
  notify();
}

export function startSyncEngine(): () => void {
  const unsubscribe = NetInfo.addEventListener((state) => {
    const nowOnline = Boolean(state.isConnected && state.isInternetReachable !== false);
    const cameBackOnline = nowOnline && !isOnline;
    isOnline = nowOnline;
    currentStatus = isOnline ? 'idle' : 'offline';
    notify();

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
