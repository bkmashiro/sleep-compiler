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

export function toExportRow(entry: SleepEntry): ExportRow {
  return {
    date: entry.date,
    bedtime: entry.sleep_time,
    waketime: entry.wake_time,
    duration_hours: roundHours(entry.duration_minutes),
    score: scoreFromDuration(entry.duration_minutes),
  };
}

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

function escapeCsv(value: string | number): string {
  const text = String(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}

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
