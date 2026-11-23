import axios from 'axios';
import { db } from './db';

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

export function enqueueOutbox(kind: OutboxKind, payload: Record<string, unknown>): string {
  const id = newId();
  db.runSync('INSERT INTO outbox (id, kind, payload, createdAt, attempts) VALUES (?, ?, ?, ?, 0)', [id, kind, JSON.stringify(payload), new Date().toISOString()]);
  return id;
}

export function readOutbox(): OutboxItem[] {
  const rows = db.getAllSync<{ id: string; kind: OutboxKind; payload: string; createdAt: string; attempts: number; lastError: string | null }>('SELECT * FROM outbox ORDER BY createdAt ASC');
  return rows.map((r) => ({ id: r.id, kind: r.kind, payload: JSON.parse(r.payload), createdAt: r.createdAt, attempts: r.attempts, lastError: r.lastError ?? undefined }));
}

export function removeOutbox(id: string): void {
  db.runSync('DELETE FROM outbox WHERE id = ?', [id]);
}

export function markOutboxFailed(id: string, error: string): void {
  db.runSync('UPDATE outbox SET attempts = attempts + 1, lastError = ? WHERE id = ?', [error, id]);
}

export function outboxLength(): number {
  return db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM outbox')?.count ?? 0;
}

// ---- last-seen copies of lists ----

export function cacheSet(key: string, value: unknown): void {
  db.runSync('INSERT OR REPLACE INTO kv_cache (key, json, updatedAt) VALUES (?, ?, ?)', [key, JSON.stringify(value), new Date().toISOString()]);
}

export function cacheGet<T>(key: string): T | undefined {
  const row = db.getFirstSync<{ json: string }>('SELECT json FROM kv_cache WHERE key = ?', [key]);
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

export function recordSyncFailure(f: Omit<SyncFailure, 'at'>): void {
  const all = cacheGet<SyncFailure[]>(FAILURES) ?? [];
  cacheSet(FAILURES, [{ ...f, at: new Date().toISOString() }, ...all].slice(0, 30));
}
export const getSyncFailures = (): SyncFailure[] => cacheGet<SyncFailure[]>(FAILURES) ?? [];
export const clearSyncFailures = (): void => cacheSet(FAILURES, []);

// True when the request never got an answer (no signal, timeout), as opposed
// to the server answering with an error.
export function isNetworkError(err: unknown): boolean {
  return axios.isAxiosError(err) && !err.response;
}
