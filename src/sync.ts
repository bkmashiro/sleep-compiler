import { Command } from 'commander';
import { getAllEntries, upsertEntry, type SleepEntry } from './db.js';
import { escapeCsv } from './exporter.js';
import { calcDurationMinutes } from './utils.js';

export type SyncFormat = 'csv' | 'apple-health';

export interface SyncEntry {
  date: string;
  sleep_time: string;
  wake_time: string;
  duration_minutes: number;
  note?: string | null;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function splitCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
      continue;
    }

    current += char;
  }

  values.push(current);
  return values;
}

function toSyncEntry(entry: SleepEntry): SyncEntry {
  return {
    date: entry.date,
    sleep_time: entry.sleep_time,
    wake_time: entry.wake_time,
    duration_minutes: entry.duration_minutes,
    note: entry.note,
  };
}

function nextDate(date: string): string {
  const current = new Date(`${date}T00:00:00Z`);
  current.setUTCDate(current.getUTCDate() + 1);
  return current.toISOString().slice(0, 10);
}

function formatAppleDate(date: string, time: string): string {
  return `${date} ${time}:00`;
}

function parseAppleDate(value: string): { date: string; time: string } {
  const match = value.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}):\d{2}$/);
  if (!match) {
    throw new Error(`Invalid Apple Health date: ${value}`);
  }

  return { date: match[1], time: match[2] };
}

export function exportSync(entries: SleepEntry[], format: SyncFormat): string {
  const rows = [...entries].sort((a, b) => a.date.localeCompare(b.date)).map(toSyncEntry);

  if (format === 'csv') {
    const header = 'date,sleep_time,wake_time,duration_minutes,note';
    const lines = rows.map((row) =>
      [row.date, row.sleep_time, row.wake_time, row.duration_minutes, row.note ?? ''].map(escapeCsv).join(',')
    );
    return [header, ...lines].join('\n');
  }

  const records = rows.map((row) => {
    const endDate = row.wake_time <= row.sleep_time ? nextDate(row.date) : row.date;
    return `  <Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="${escapeXml(
      formatAppleDate(row.date, row.sleep_time)
    )}" endDate="${escapeXml(
      formatAppleDate(endDate, row.wake_time)
    )}" value="HKCategoryValueSleepAnalysisAsleep"/>`;
  });

  return ['<HealthData>', ...records, '</HealthData>'].join('\n');
}

export function importSync(input: string, format: SyncFormat): SyncEntry[] {
  if (format === 'csv') {
    const lines = input
      .trim()
      .split(/\r?\n/)
      .filter((line) => line.trim().length > 0);

    if (lines.length === 0) {
      return [];
    }

    const [header, ...rows] = lines;
    if (header.trim() !== 'date,sleep_time,wake_time,duration_minutes,note') {
      throw new Error('Unsupported CSV header. Expected: date,sleep_time,wake_time,duration_minutes,note');
    }

    return rows.map((line) => {
      const [date, sleep_time, wake_time, durationText, note = ''] = splitCsvLine(line);
      const duration_minutes = Number.parseInt(durationText, 10);

      if (!date || !sleep_time || !wake_time || !Number.isInteger(duration_minutes)) {
        throw new Error(`Invalid CSV row: ${line}`);
      }

      return {
        date,
        sleep_time,
        wake_time,
        duration_minutes,
        note: note || null,
      };
    });
  }

  const records = [...input.matchAll(/<Record\b([^>]*)\/>/g)];
  const entries = records
    .map((match) => match[1])
    .map((attributes): SyncEntry | null => {
      const type = attributes.match(/\btype="([^"]+)"/)?.[1];
      const value = attributes.match(/\bvalue="([^"]+)"/)?.[1];

      if (type !== 'HKCategoryTypeIdentifierSleepAnalysis' || value !== 'HKCategoryValueSleepAnalysisAsleep') {
        return null;
      }

      const startDateText = attributes.match(/\bstartDate="([^"]+)"/)?.[1];
      const endDateText = attributes.match(/\bendDate="([^"]+)"/)?.[1];
      if (!startDateText || !endDateText) {
        throw new Error('Apple Health record is missing startDate or endDate.');
      }

      const start = parseAppleDate(startDateText);
      const end = parseAppleDate(endDateText);

      return {
        date: start.date,
        sleep_time: start.time,
        wake_time: end.time,
        duration_minutes: calcDurationMinutes(start.time, end.time),
        note: null,
      };
    });

  return entries.filter((entry): entry is SyncEntry => entry !== null);
}

async function readStdin(): Promise<string> {
  const chunks: string[] = [];
  process.stdin.setEncoding('utf8');

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  return chunks.join('');
}

export function registerSync(program: Command): void {
  program
    .command('sync')
    .description('Import or export sleep data in common formats')
    .option('--export <format>', 'Export format: csv | apple-health')
    .option('--import <format>', 'Import format: csv | apple-health')
    .action(async (opts: { export?: string; import?: string }) => {
      if ((opts.export && opts.import) || (!opts.export && !opts.import)) {
        console.error('Choose exactly one of --export <format> or --import <format>.');
        process.exit(1);
      }

      const format = (opts.export ?? opts.import) as SyncFormat;
      if (format !== 'csv' && format !== 'apple-health') {
        console.error('Supported sync formats: csv, apple-health');
        process.exit(1);
      }

      if (opts.export) {
        console.log(exportSync(getAllEntries(), format));
        return;
      }

      const input = await readStdin();
      const rows = importSync(input, format);

      for (const row of rows) {
        upsertEntry(row.date, row.sleep_time, row.wake_time, row.duration_minutes, row.note ?? undefined);
      }

      console.log(`Imported ${rows.length} sleep entr${rows.length === 1 ? 'y' : 'ies'} from ${format}.`);
    });
}
