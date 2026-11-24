import * as SQLite from 'expo-sqlite';

/**
 * Local offline store. Covers viewing containers and changing their status and
 * dates, and (through the outbox) creating or editing clients, uploading
 * scanned documents, and assigning a driver. The README's "Offline mode"
 * section lists exactly what is and is not covered.
 */
let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

export async function getDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = SQLite.openDatabaseAsync('cargoflow.db').catch((error: unknown) => {
      databasePromise = undefined;
      throw error;
    });
  }
  return databasePromise;
}

export async function initDatabase(): Promise<void> {
  const db = await getDatabase();
  await db.execAsync(`
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

    -- Things done with no signal that are not tied to one container's status:
    -- a new or edited client, a scanned document waiting to upload, a driver
    -- assignment. Sent in the order they were made when the connection returns.
    CREATE TABLE IF NOT EXISTS outbox (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL,
      payload TEXT NOT NULL,
      createdAt TEXT NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0,
      lastError TEXT
    );

    -- Last-seen copies of lists, so they still open offline.
    CREATE TABLE IF NOT EXISTS kv_cache (
      key TEXT PRIMARY KEY,
      json TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
  `);
}
