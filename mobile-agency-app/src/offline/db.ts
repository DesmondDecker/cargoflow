import * as SQLite from 'expo-sqlite';

/**
 * Local offline store. Scope is deliberately limited to the highest-value
 * loop — viewing containers and changing their status/dates while
 * offline — not full offline coverage of every screen. See
 * README's "Offline mode" section for exactly what is and isn't covered.
 */
const db = SQLite.openDatabaseSync('cargoflow.db');

export function initDatabase(): void {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS containers_cache (
      id TEXT PRIMARY KEY,
      containerNumber TEXT NOT NULL,
      json TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      version INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS mutation_queue (
      localId TEXT PRIMARY KEY,
      containerId TEXT NOT NULL,
      type TEXT NOT NULL,
      payload TEXT NOT NULL,
      clientVersion INTEGER,
      createdAt TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      lastError TEXT
    );
  `);
}

export { db };
