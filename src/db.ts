import Database from 'better-sqlite3';
import { homedir } from 'os';
import { mkdirSync } from 'fs';
import { join } from 'path';

const DB_DIR = join(homedir(), '.sleep-compiler');
const DB_PATH = join(DB_DIR, 'sleep.db');

mkdirSync(DB_DIR, { recursive: true });

export interface SleepEntry {
  id: number;
  date: string;
  sleep_time: string;
  wake_time: string;
  duration_minutes: number;
  note: string | null;
  created_at: string;
}

export interface SleepDb {
  /**
   * Inserts a new sleep entry for `date`.
   *
   * @throws If a record for that `date` already exists (UNIQUE constraint on `date`).
   *   Use {@link upsertEntry} when you want to overwrite an existing entry.
   */
  insertEntry: (
    date: string,
    sleep_time: string,
    wake_time: string,
    duration_minutes: number,
    note?: string
  ) => void;

  /**
   * Inserts a sleep entry for `date`, or replaces the existing one if it already exists.
   *
   * All fields (sleep_time, wake_time, duration_minutes, note) are overwritten on conflict.
   */
  upsertEntry: (
    date: string,
    sleep_time: string,
    wake_time: string,
    duration_minutes: number,
    note?: string
  ) => void;

  /**
   * Returns the most recent `days` entries, ordered by date descending (newest first).
   *
   * @param days - Maximum number of entries to return.
   */
  getEntries: (days: number) => SleepEntry[];

  /** Returns all entries, ordered by date descending (newest first). */
  getAllEntries: () => SleepEntry[];

  getStats: () => {
    total: number;
    avg_duration: number;
    min_duration: number;
    max_duration: number;
  };

  close: () => void;
}

function initializeDb(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS sleep_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      sleep_time TEXT NOT NULL,
      wake_time TEXT NOT NULL,
      duration_minutes INTEGER NOT NULL,
      note TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

function isUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed');
}

function toWriteError(operation: string, date: string, error: unknown): Error {
  if (isUniqueConstraintError(error)) {
    return new Error(`Failed to ${operation} sleep entry: duplicate date ${date}`);
  }
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`Failed to ${operation} sleep entry: ${message}`);
}

/**
 * Creates and returns a {@link SleepDb} backed by a SQLite database.
 *
 * - When called with no argument (or with the default `DB_PATH`), it opens the
 *   persistent file database at `~/.sleep-compiler/sleep.db`, creating the
 *   directory and schema on first use.
 * - Pass `':memory:'` to get an in-memory database (useful for tests): data is
 *   not persisted and is discarded when `close()` is called.
 *
 * @param path - Filesystem path for the SQLite file, or `':memory:'` for an
 *   ephemeral in-memory database. Defaults to `~/.sleep-compiler/sleep.db`.
 */
export function createSleepDb(path = DB_PATH): SleepDb {
  const db = new Database(path);
  initializeDb(db);

  return {
    insertEntry(date, sleep_time, wake_time, duration_minutes, note) {
      const stmt = db.prepare(`
        INSERT INTO sleep_log (date, sleep_time, wake_time, duration_minutes, note)
        VALUES (?, ?, ?, ?, ?)
      `);
      try {
        stmt.run(date, sleep_time, wake_time, duration_minutes, note ?? null);
      } catch (error) {
        throw toWriteError('save', date, error);
      }
    },
    upsertEntry(date, sleep_time, wake_time, duration_minutes, note) {
      const stmt = db.prepare(`
        INSERT INTO sleep_log (date, sleep_time, wake_time, duration_minutes, note)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          sleep_time = excluded.sleep_time,
          wake_time = excluded.wake_time,
          duration_minutes = excluded.duration_minutes,
          note = excluded.note
      `);
      try {
        stmt.run(date, sleep_time, wake_time, duration_minutes, note ?? null);
      } catch (error) {
        throw toWriteError('update', date, error);
      }
    },
    getEntries(days) {
      const stmt = db.prepare(`
        SELECT * FROM sleep_log
        ORDER BY date DESC
        LIMIT ?
      `);
      return stmt.all(days) as SleepEntry[];
    },
    getAllEntries() {
      const stmt = db.prepare(`SELECT * FROM sleep_log ORDER BY date DESC`);
      return stmt.all() as SleepEntry[];
    },
    getStats() {
      const stmt = db.prepare(`
        SELECT
          COUNT(*) as total,
          AVG(duration_minutes) as avg_duration,
          MIN(duration_minutes) as min_duration,
          MAX(duration_minutes) as max_duration
        FROM sleep_log
      `);
      return stmt.get() as {
        total: number;
        avg_duration: number;
        min_duration: number;
        max_duration: number;
      };
    },
    close() {
      db.close();
    },
  };
}

const appDb = createSleepDb();

const closeAppDb = (): void => appDb.close();

process.on('exit', closeAppDb);

process.on('SIGINT', () => {
  appDb.close();
  process.exit(0);
});

process.on('SIGTERM', () => {
  appDb.close();
  process.exit(0);
});

export const insertEntry = appDb.insertEntry;
export const upsertEntry = appDb.upsertEntry;
export const getEntries = appDb.getEntries;
export const getAllEntries = appDb.getAllEntries;
export const getStats = appDb.getStats;
