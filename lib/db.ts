import * as SQLite from 'expo-sqlite';

let _db: SQLite.SQLiteDatabase | null = null;

export function getDb(): SQLite.SQLiteDatabase {
  if (!_db) {
    _db = SQLite.openDatabaseSync('inspecthive.db');
  }
  return _db;
}

export async function initDb(): Promise<void> {
  const db = getDb();
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      data TEXT NOT NULL,
      synced_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS submissions_queue (
      id TEXT PRIMARY KEY,
      job_item_id TEXT NOT NULL,
      data TEXT NOT NULL DEFAULT '[]',
      photos TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      attempts INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS photos_queue (
      id TEXT PRIMARY KEY,
      submission_id TEXT,
      job_item_id TEXT NOT NULL,
      local_uri TEXT NOT NULL,
      field_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS worker_signatures_queue (
      id TEXT PRIMARY KEY,
      submission_id TEXT,
      job_item_id TEXT NOT NULL,
      image_data TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0
    );
  `);

  // Additive migrations — safe to re-run on every startup
  try {
    await db.execAsync(
      'ALTER TABLE submissions_queue ADD COLUMN is_update INTEGER NOT NULL DEFAULT 0'
    );
  } catch {
    // Column already exists on devices that ran a previous version
  }

  try {
    await db.execAsync(
      "ALTER TABLE submissions_queue ADD COLUMN photo_deletes TEXT NOT NULL DEFAULT '[]'"
    );
  } catch {
    // Column already exists
  }
}
