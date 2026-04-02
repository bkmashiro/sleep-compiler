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
  insertEntry: (
    date: string,
    sleep_time: string,
    wake_time: string,
    duration_minutes: number,
    note?: string
  ) => void;
  getEntries: (days: number) => SleepEntry[];
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

export function createSleepDb(path = DB_PATH): SleepDb {
  const db = new Database(path);
  initializeDb(db);

  return {
    insertEntry(date, sleep_time, wake_time, duration_minutes, note) {
      const stmt = db.prepare(`
        INSERT INTO sleep_log (date, sleep_time, wake_time, duration_minutes, note)
        VALUES (?, ?, ?, ?, ?)
      `);
      stmt.run(date, sleep_time, wake_time, duration_minutes, note ?? null);
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

export const insertEntry = appDb.insertEntry;
export const getEntries = appDb.getEntries;
export const getAllEntries = appDb.getAllEntries;
export const getStats = appDb.getStats;
