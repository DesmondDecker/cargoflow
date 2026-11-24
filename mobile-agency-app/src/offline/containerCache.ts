import { getDatabase } from './db';
import { ContainerListItem } from '../types/api';

/**
 * Read-through cache for the containers list — lets ContainersListScreen
 * show something instantly even with no connectivity, and fall back to it
 * automatically when a network fetch fails.
 */

export async function upsertContainers(containers: ContainerListItem[]): Promise<void> {
  const now = new Date().toISOString();
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const c of containers) {
      await db.runAsync(
        `INSERT INTO containers_cache (id, containerNumber, json, updatedAt, version)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET containerNumber = excluded.containerNumber, json = excluded.json, updatedAt = excluded.updatedAt`,
        [c._id, c.containerNumber, JSON.stringify(c), now]
      );
    }
  });
}

export async function readCachedContainers(): Promise<ContainerListItem[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ json: string }>('SELECT json FROM containers_cache ORDER BY updatedAt DESC');
  return rows.map((r) => JSON.parse(r.json) as ContainerListItem);
}

export async function upsertSingleContainer(container: ContainerListItem): Promise<void> {
  await upsertContainers([container]);
}

export async function readCachedContainer(id: string): Promise<ContainerListItem | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ json: string }>('SELECT json FROM containers_cache WHERE id = ?', [id]);
  return row ? (JSON.parse(row.json) as ContainerListItem) : null;
}

export async function clearContainerCache(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM containers_cache');
}
