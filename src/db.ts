import Database from 'better-sqlite3';
import { homedir } from 'os';
import { mkdirSync } from 'fs';
import { join } from 'path';

const DB_DIR = join(homedir(), '.sleep-compiler');
const DB_PATH = join(DB_DIR, 'sleep.db');

mkdirSync(DB_DIR, { recursive: true });

const db = new Database(DB_PATH);

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

export interface SleepEntry {
  id: number;
  date: string;
  sleep_time: string;
  wake_time: string;
  duration_minutes: number;
  note: string | null;
  created_at: string;
}

export function insertEntry(
  date: string,
  sleep_time: string,
  wake_time: string,
  duration_minutes: number,
  note?: string
): void {
  const stmt = db.prepare(`
    INSERT INTO sleep_log (date, sleep_time, wake_time, duration_minutes, note)
    VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(date) DO UPDATE SET
      sleep_time = excluded.sleep_time,
      wake_time = excluded.wake_time,
      duration_minutes = excluded.duration_minutes,
      note = excluded.note
  `);
  stmt.run(date, sleep_time, wake_time, duration_minutes, note ?? null);
}

export function getEntries(days: number): SleepEntry[] {
  const stmt = db.prepare(`
    SELECT * FROM sleep_log
    ORDER BY date DESC
    LIMIT ?
  `);
  return stmt.all(days) as SleepEntry[];
}

export function getAllEntries(): SleepEntry[] {
  const stmt = db.prepare(`SELECT * FROM sleep_log ORDER BY date DESC`);
  return stmt.all() as SleepEntry[];
}

export function getStats(): {
  total: number;
  avg_duration: number;
  min_duration: number;
  max_duration: number;
} {
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
}
