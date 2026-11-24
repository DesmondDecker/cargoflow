import axios from 'axios';
import { getDatabase } from './db';

export type OutboxKind = 'importer_create' | 'importer_update' | 'document_upload' | 'driver_assign';

export interface OutboxItem {
  id: string;
  kind: OutboxKind;
  payload: Record<string, unknown>;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

const newId = () => `out-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

export async function enqueueOutbox(kind: OutboxKind, payload: Record<string, unknown>): Promise<string> {
  const id = newId();
  const db = await getDatabase();
  await db.runAsync('INSERT INTO outbox (id, kind, payload, createdAt, attempts) VALUES (?, ?, ?, ?, 0)', [id, kind, JSON.stringify(payload), new Date().toISOString()]);
  return id;
}

export async function readOutbox(): Promise<OutboxItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ id: string; kind: OutboxKind; payload: string; createdAt: string; attempts: number; lastError: string | null }>('SELECT * FROM outbox ORDER BY createdAt ASC');
  return rows.map((r) => ({ id: r.id, kind: r.kind, payload: JSON.parse(r.payload), createdAt: r.createdAt, attempts: r.attempts, lastError: r.lastError ?? undefined }));
}

export async function removeOutbox(id: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM outbox WHERE id = ?', [id]);
}

export async function markOutboxFailed(id: string, error: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE outbox SET attempts = attempts + 1, lastError = ? WHERE id = ?', [error, id]);
}

export async function outboxLength(): Promise<number> {
  const db = await getDatabase();
  return (await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM outbox'))?.count ?? 0;
}

// ---- last-seen copies of lists ----

export async function cacheSet(key: string, value: unknown): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('INSERT OR REPLACE INTO kv_cache (key, json, updatedAt) VALUES (?, ?, ?)', [key, JSON.stringify(value), new Date().toISOString()]);
}

export async function cacheGet<T>(key: string): Promise<T | undefined> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ json: string }>('SELECT json FROM kv_cache WHERE key = ?', [key]);
  return row ? (JSON.parse(row.json) as T) : undefined;
}

// ---- what the server refused after the fact ----
// Something done offline can turn out to be impossible by the time it is sent
// (the driver took another job, the client was already added). Those are kept
// here so the user is told, instead of the change silently disappearing.

export interface SyncFailure {
  kind: OutboxKind;
  summary: string;
  reason: string;
  at: string;
}

const FAILURES = 'sync_failures';

export async function recordSyncFailure(f: Omit<SyncFailure, 'at'>): Promise<void> {
  const all = (await cacheGet<SyncFailure[]>(FAILURES)) ?? [];
  await cacheSet(FAILURES, [{ ...f, at: new Date().toISOString() }, ...all].slice(0, 30));
}
export async function getSyncFailures(): Promise<SyncFailure[]> {
  return (await cacheGet<SyncFailure[]>(FAILURES)) ?? [];
}
export async function clearSyncFailures(): Promise<void> {
  await cacheSet(FAILURES, []);
}

// True when the request never got an answer (no signal, timeout), as opposed
// to the server answering with an error.
export function isNetworkError(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response;
}
