import { db } from './db';

export type MutationType = 'status_change' | 'date_update';

export interface QueuedMutation {
  localId: string;
  containerId: string;
  type: MutationType;
  payload: Record<string, unknown>;
  clientVersion?: number;
  createdAt: string;
  attempts: number;
  lastError?: string;
}

function generateLocalId(): string {
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function enqueueMutation(
  containerId: string,
  type: MutationType,
  payload: Record<string, unknown>,
  clientVersion?: number
): string {
  const localId = generateLocalId();
  db.runSync(
    `INSERT INTO mutation_queue (localId, containerId, type, payload, clientVersion, createdAt, attempts)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [localId, containerId, type, JSON.stringify(payload), clientVersion ?? null, new Date().toISOString()]
  );
  return localId;
}

export function readQueuedMutations(): QueuedMutation[] {
  const rows = db.getAllSync<{
    localId: string;
    containerId: string;
    type: MutationType;
    payload: string;
    clientVersion: number | null;
    createdAt: string;
    attempts: number;
    lastError: string | null;
  }>('SELECT * FROM mutation_queue ORDER BY createdAt ASC');

  return rows.map((r) => ({
    localId: r.localId,
    containerId: r.containerId,
    type: r.type,
    payload: JSON.parse(r.payload),
    clientVersion: r.clientVersion ?? undefined,
    createdAt: r.createdAt,
    attempts: r.attempts,
    lastError: r.lastError ?? undefined,
  }));
}

export function removeMutation(localId: string): void {
  db.runSync('DELETE FROM mutation_queue WHERE localId = ?', [localId]);
}

export function markMutationFailed(localId: string, error: string): void {
  db.runSync('UPDATE mutation_queue SET attempts = attempts + 1, lastError = ? WHERE localId = ?', [error, localId]);
}

export function queueLength(): number {
  const row = db.getFirstSync<{ count: number }>('SELECT COUNT(*) as count FROM mutation_queue');
  return row?.count ?? 0;
}
