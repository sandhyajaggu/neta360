import * as SQLite from 'expo-sqlite';

// One local database on the phone. Everything the operator needs for
// their booth lives here, so the app works fully without internet.
let dbPromise = null;

export function getDb() {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync('neta360.db');
      await migrate(db);
      return db;
    })().catch((err) => {
      dbPromise = null;
      throw err;
    });
  }
  return dbPromise;
}

async function migrate(db) {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const row = await db.getFirstAsync('PRAGMA user_version');
  const version = row ? row.user_version : 0;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS voters (
        id TEXT PRIMARY KEY NOT NULL,
        serial_no INTEGER,
        epic_no TEXT,
        name TEXT NOT NULL,
        relation_type TEXT,
        relation_name TEXT,
        gender TEXT,
        age INTEGER,
        house_no TEXT,
        section TEXT,
        mobile_number TEXT,
        household_id TEXT,
        is_voted INTEGER NOT NULL DEFAULT 0,
        voted_at TEXT,
        survey_count INTEGER NOT NULL DEFAULT 0
      );
      CREATE INDEX IF NOT EXISTS idx_voters_serial ON voters(serial_no);
      CREATE INDEX IF NOT EXISTS idx_voters_household ON voters(household_id);
      CREATE INDEX IF NOT EXISTS idx_voters_house_no ON voters(house_no);

      CREATE TABLE IF NOT EXISTS households (
        id TEXT PRIMARY KEY NOT NULL,
        family_code TEXT NOT NULL,
        house_no TEXT,
        address TEXT,
        head_voter_id TEXT,
        updated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS surveys (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        description TEXT,
        questions TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS survey_responses (
        id TEXT PRIMARY KEY NOT NULL,
        survey_id TEXT NOT NULL,
        voter_id TEXT,
        household_id TEXT,
        answers TEXT NOT NULL,
        collected_at TEXT NOT NULL,
        synced INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY NOT NULL,
        title TEXT NOT NULL,
        body TEXT,
        created_at TEXT NOT NULL,
        is_read INTEGER NOT NULL DEFAULT 0
      );

      -- Every change made on the phone is queued here until the server accepts it.
      CREATE TABLE IF NOT EXISTS outbox (
        id TEXT PRIMARY KEY NOT NULL,
        entity TEXT NOT NULL,
        op TEXT NOT NULL,
        entity_id TEXT NOT NULL,
        payload TEXT NOT NULL,
        created_at TEXT NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        last_error TEXT
      );

      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT
      );

      PRAGMA user_version = 1;
    `);
  }

  if (version < 2) {
    await db.execAsync(`
      ALTER TABLE voters ADD COLUMN voted_party TEXT;
      PRAGMA user_version = 2;
    `);
  }
}
