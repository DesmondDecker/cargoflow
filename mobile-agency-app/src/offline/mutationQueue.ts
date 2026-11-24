import { getDatabase } from './db';

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

export async function enqueueMutation(
  containerId: string,
  type: MutationType,
  payload: Record<string, unknown>,
  clientVersion?: number
): Promise<string> {
  const localId = generateLocalId();
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO mutation_queue (localId, containerId, type, payload, clientVersion, createdAt, attempts)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [localId, containerId, type, JSON.stringify(payload), clientVersion ?? null, new Date().toISOString()]
  );
  return localId;
}

export async function readQueuedMutations(): Promise<QueuedMutation[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{
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

export async function removeMutation(localId: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM mutation_queue WHERE localId = ?', [localId]);
}

export async function markMutationFailed(localId: string, error: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE mutation_queue SET attempts = attempts + 1, lastError = ? WHERE localId = ?', [error, localId]);
}

export async function queueLength(): Promise<number> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ count: number }>('SELECT COUNT(*) as count FROM mutation_queue');
  return row?.count ?? 0;
}
