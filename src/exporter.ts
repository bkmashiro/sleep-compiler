import { createSleepDb, type SleepEntry } from './db.js';

export interface ExportRow {
  date: string;
  bedtime: string;
  waketime: string;
  duration_hours: number;
  score: number;
}

function roundHours(minutes: number): number {
  return Math.round((minutes / 60) * 100) / 100;
}

function scoreFromDuration(minutes: number): number {
  const targetMinutes = 8 * 60;
  const delta = Math.abs(minutes - targetMinutes);
  return Math.max(0, Math.min(100, Math.round(100 - delta / 3)));
}

/**
 * Converts a raw {@link SleepEntry} database record into a flat {@link ExportRow}
 * suitable for CSV export or external consumption.
 *
 * Duration is rounded to two decimal places of hours; score is derived from
 * proximity to the 8-hour sleep target (see `scoreFromDuration`).
 *
 * @param entry - A sleep log entry from the database.
 * @returns An {@link ExportRow} with human-friendly field names.
 */
export function toExportRow(entry: SleepEntry): ExportRow {
  return {
    date: entry.date,
    bedtime: entry.sleep_time,
    waketime: entry.wake_time,
    duration_hours: roundHours(entry.duration_minutes),
    score: scoreFromDuration(entry.duration_minutes),
  };
}

/**
 * Fetches sleep entries from the database and returns them as export rows in
 * **ascending** date order (oldest first).
 *
 * The database returns entries newest-first; this function reverses that order
 * after an optional recency limit is applied.
 *
 * @param days   - When provided, limits results to the most recent `days` entries
 *                 before reversing. Omit (or pass `undefined`) for all entries.
 * @param dbPath - Optional path to the SQLite database file. Defaults to the
 *                 standard `~/.sleep-compiler/sleep.db` location.
 * @returns Array of {@link ExportRow} objects sorted oldest → newest.
 */
export function getExportRows(days?: number, dbPath?: string): ExportRow[] {
  const db = createSleepDb(dbPath);

  try {
    const entries = db.getAllEntries();
    const filtered = typeof days === 'number' ? entries.slice(0, days) : entries;
    return filtered.reverse().map(toExportRow);
  } finally {
    db.close();
  }
}

export function escapeCsv(value: string | number): string {
  const text = String(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

/**
 * Serialises an array of {@link ExportRow} objects to a CSV string.
 *
 * The output always starts with the header line:
 * `date,bedtime,waketime,duration_hours,score`
 *
 * Values that contain commas, double-quotes, or newlines are wrapped in double
 * quotes with internal quotes escaped as `""` (RFC 4180). `duration_hours` is
 * formatted to two decimal places with trailing `.00` stripped (e.g. `7.5`
 * rather than `7.50`, but `7.25` stays `7.25`).
 *
 * @param rows - Rows to serialise. An empty array returns only the header line.
 * @returns A newline-separated CSV string with no trailing newline.
 */
export function toCsv(rows: ExportRow[]): string {
  const header = 'date,bedtime,waketime,duration_hours,score';
  const lines = rows.map((row) =>
    [
      row.date,
      row.bedtime,
      row.waketime,
      row.duration_hours.toFixed(2).replace(/\.00$/, ''),
      row.score,
    ]
      .map(escapeCsv)
      .join(',')
  );

  return [header, ...lines].join('\n');
}
