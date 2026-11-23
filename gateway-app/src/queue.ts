import AsyncStorage from '@react-native-async-storage/async-storage';
import { fingerprint } from './sms';
import type { Config } from './store';

// Messages waiting to be sent, and a log of what happened to each. A message
// leaves the queue only when the server has it (or has refused it as invalid).
// No signal, a server error or a wrong key all KEEP it queued, so a payment
// notification is never lost to a bad moment.

export interface QueuedSms {
  id: string;
  address: string;
  message: string;
  receivedAt: string;
  attempts: number;
}

export type LogStatus = 'sent' | 'queued' | 'refused' | 'ignored';

export interface LogEntry {
  id: string;
  at: string;
  address: string;
  preview: string;
  status: LogStatus;
  detail?: string;
}

const QUEUE_KEY = 'gw_queue';
const LOG_KEY = 'gw_log';
const LOG_MAX = 50;

type Listener = () => void;
const listeners = new Set<Listener>();
export const onQueueChange = (l: Listener) => (listeners.add(l), () => listeners.delete(l));
const changed = () => listeners.forEach((l) => l());

async function read<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T[]) : [];
  } catch {
    return [];
  }
}

export const getQueue = () => read<QueuedSms>(QUEUE_KEY);
export const getLog = () => read<LogEntry>(LOG_KEY);

async function addLog(entry: Omit<LogEntry, 'at'>): Promise<void> {
  const log = await getLog();
  await AsyncStorage.setItem(LOG_KEY, JSON.stringify([{ ...entry, at: new Date().toISOString() }, ...log].slice(0, LOG_MAX)));
  changed();
}

export async function clearLog(): Promise<void> {
  await AsyncStorage.removeItem(LOG_KEY);
  changed();
}

const preview = (m: string) => (m.length > 60 ? `${m.slice(0, 60)}…` : m);

// Queues a message unless the same one is already queued or was sent in the
// last ten minutes. Returns false when it was a duplicate.
export async function enqueue(address: string, message: string, now = new Date()): Promise<boolean> {
  const id = fingerprint(address, message);
  const [queue, log] = await Promise.all([getQueue(), getLog()]);
  const recentlySent = log.some((l) => l.id === id && l.status === 'sent' && now.getTime() - new Date(l.at).getTime() < 10 * 60000);
  if (queue.some((q) => q.id === id) || recentlySent) return false;
  await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify([...queue, { id, address, message, receivedAt: now.toISOString(), attempts: 0 }]));
  await addLog({ id, address, preview: preview(message), status: 'queued' });
  return true;
}

export type FlushResult = { sent: number; kept: number; refused: number; problem?: 'auth' | 'network' | 'server' | 'not_configured' };

let flushing = false;

// Sends queued messages oldest first. Stops at the first problem that would
// affect every message (bad key, no network, server down) and keeps the rest.
export async function flush(config: Config, fetchImpl: typeof fetch = fetch): Promise<FlushResult> {
  if (flushing) return { sent: 0, kept: 0, refused: 0 };
  if (!config.baseUrl || !config.apiKey) return { sent: 0, kept: (await getQueue()).length, refused: 0, problem: 'not_configured' };
  flushing = true;
  const result: FlushResult = { sent: 0, kept: 0, refused: 0 };
  try {
    let queue = await getQueue();
    while (queue.length > 0) {
      const next = queue[0];
      let response: Response;
      try {
        response = await fetchImpl(`${config.baseUrl}/gateway/sms-notifications`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-API-Key': config.apiKey },
          body: JSON.stringify({ message: next.message }),
        });
      } catch {
        result.problem = 'network';
        break;
      }

      if (response.ok) {
        let matched = false;
        try {
          matched = !!((await response.json()) as { data?: { matched?: boolean } })?.data?.matched;
        } catch {
          // The message was accepted; only the detail could not be read.
        }
        await addLog({ id: next.id, address: next.address, preview: preview(next.message), status: 'sent', detail: matched ? 'matched a pending payment' : 'saved for the admin to reconcile' });
        result.sent += 1;
      } else if (response.status === 401 || response.status === 403) {
        result.problem = 'auth';
        break;
      } else if (response.status >= 500) {
        result.problem = 'server';
        break;
      } else {
        await addLog({ id: next.id, address: next.address, preview: preview(next.message), status: 'refused', detail: `The server refused it (${response.status})` });
        result.refused += 1;
      }
      queue = queue.slice(1);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    }
    result.kept = queue.length;
  } finally {
    flushing = false;
    changed();
  }
  return result;
}

// A message from a sender that is not on the list is NOT forwarded, and its
// text is not kept either: only who it was from is noted, so personal
// messages never end up in this app's log.
export async function recordIgnored(address: string): Promise<void> {
  await addLog({ id: `ignored-${Date.now()}`, address, preview: '', status: 'ignored', detail: 'Sender is not on your list, so it was not read or sent' });
}
