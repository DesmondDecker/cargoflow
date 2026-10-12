import { db } from './db';
import { ContainerListItem } from '../types/api';

/**
 * Read-through cache for the containers list — lets ContainersListScreen
 * show something instantly even with no connectivity, and fall back to it
 * automatically when a network fetch fails.
 */

export function upsertContainers(containers: ContainerListItem[]): void {
  const now = new Date().toISOString();
  db.withTransactionSync(() => {
    for (const c of containers) {
      db.runSync(
        `INSERT INTO containers_cache (id, containerNumber, json, updatedAt, version)
         VALUES (?, ?, ?, ?, 1)
         ON CONFLICT(id) DO UPDATE SET containerNumber = excluded.containerNumber, json = excluded.json, updatedAt = excluded.updatedAt`,
        [c._id, c.containerNumber, JSON.stringify(c), now]
      );
    }
  });
}

export function readCachedContainers(): ContainerListItem[] {
  const rows = db.getAllSync<{ json: string }>('SELECT json FROM containers_cache ORDER BY updatedAt DESC');
  return rows.map((r) => JSON.parse(r.json) as ContainerListItem);
}

export function upsertSingleContainer(container: ContainerListItem): void {
  upsertContainers([container]);
}

export function readCachedContainer(id: string): ContainerListItem | null {
  const row = db.getFirstSync<{ json: string }>('SELECT json FROM containers_cache WHERE id = ?', [id]);
  return row ? (JSON.parse(row.json) as ContainerListItem) : null;
}

export function clearContainerCache(): void {
  db.runSync('DELETE FROM containers_cache');
}
