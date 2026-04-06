import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import { format } from 'date-fns';
import { insertEntry, type SleepDb } from '../db.js';
import { formatDuration, getQualityLabel } from '../formatter.js';

const DATA_DIR = join(homedir(), '.sleep-compiler');
const PENDING_SLEEP_PATH = join(DATA_DIR, 'pending-sleep.json');

export interface PendingSleep {
  time: string;
  date: string;
}

export interface WakeResult {
  date: string;
  sleepTime: string;
  wakeTime: string;
  durationMinutes: number;
}

function ensureDataDir(filePath: string): void {
  mkdirSync(join(filePath, '..'), { recursive: true });
}

function formatTime(date: Date): string {
  return format(date, 'HH:mm');
}

function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

export function parsePendingTime(time: string): { hours: number; minutes: number } {
  const match = time.match(/^(\d{2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid time format in pending sleep file: ${time}`);
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) {
    throw new Error(`Invalid time in pending sleep file: ${time}`);
  }

  return { hours, minutes };
}

export function pendingSleepToDate(pending: PendingSleep): Date {
  const { hours, minutes } = parsePendingTime(pending.time);
  const date = new Date(`${pending.date}T00:00:00`);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function readPendingSleep(filePath: string): PendingSleep {
  if (!existsSync(filePath)) {
    throw new Error('No pending sleep found. Run `sleep-compiler sleep now` first.');
  }

  const raw = readFileSync(filePath, 'utf8');
  const parsed = JSON.parse(raw) as Partial<PendingSleep>;

  if (typeof parsed.time !== 'string' || typeof parsed.date !== 'string') {
    throw new Error('Pending sleep file is invalid.');
  }

  return { time: parsed.time, date: parsed.date };
}

export function writePendingSleep(pending: PendingSleep, filePath: string): void {
  ensureDataDir(filePath);
  writeFileSync(filePath, `${JSON.stringify(pending, null, 2)}\n`, 'utf8');
}

export function deletePendingSleep(filePath: string): void {
  if (existsSync(filePath)) {
    rmSync(filePath);
  }
}

export function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function recordSleep(now: Date, filePath: string): PendingSleep {
  const pending: PendingSleep = {
    time: formatTime(now),
    date: formatDate(now),
  };
  writePendingSleep(pending, filePath);
  return pending;
}

export function recordWake(
  now: Date,
  filePath: string,
  db: Pick<SleepDb, 'insertEntry'>
): WakeResult {
  const pending = readPendingSleep(filePath);
  const wakeTime = formatTime(now);
  const durationMinutes = minutesBetween(pendingSleepToDate(pending), now);

  db.insertEntry(pending.date, pending.time, wakeTime, durationMinutes);
  deletePendingSleep(filePath);

  return { date: pending.date, sleepTime: pending.time, wakeTime, durationMinutes };
}

export function registerQuick(program: Command): void {
  program
    .command('sleep')
    .description('Quick sleep actions')
    .command('now')
    .description('Start sleeping now')
    .action(() => {
      try {
        const { time } = recordSleep(new Date(), PENDING_SLEEP_PATH);
        console.log(`😴 Sleep started at ${time}. Run \`sleep-compiler wake now\` when you wake up.`);
      } catch (err) {
        console.error(chalk.red('Error:'), (err as Error).message);
        process.exit(1);
      }
    });

  program
    .command('wake')
    .description('Quick wake actions')
    .command('now')
    .description('Stop sleeping now and log the entry')
    .action(() => {
      try {
        const result = recordWake(new Date(), PENDING_SLEEP_PATH, { insertEntry });

        console.log(
          `☀️  Good morning! Slept ${formatDuration(result.durationMinutes)} (${result.sleepTime} → ${result.wakeTime}). Quality: ${getQualityLabel(result.durationMinutes)}`
        );
      } catch (err) {
        console.error(chalk.red('Error:'), (err as Error).message);
        process.exit(1);
      }
    });

  program
    .command('status')
    .description('Show current sleep status')
    .action(() => {
      try {
        if (!existsSync(PENDING_SLEEP_PATH)) {
          console.log('☀️  Not currently sleeping.');
          return;
        }

        const pending = readPendingSleep(PENDING_SLEEP_PATH);
        const elapsed = formatDuration(minutesBetween(pendingSleepToDate(pending), new Date()));
        console.log(`😴 Currently sleeping since ${pending.time} (${elapsed} ago)`);
      } catch (err) {
        console.error(chalk.red('Error:'), (err as Error).message);
        process.exit(1);
      }
    });
}
