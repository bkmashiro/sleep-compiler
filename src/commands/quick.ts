import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs';
import { homedir } from 'os';
import { join } from 'path';
import { Command } from 'commander';
import chalk from 'chalk';
import { format } from 'date-fns';
import { insertEntry } from '../db.js';
import { formatDuration, getQualityLabel } from '../formatter.js';

const DATA_DIR = join(homedir(), '.sleep-compiler');
const PENDING_SLEEP_PATH = join(DATA_DIR, 'pending-sleep.json');

interface PendingSleep {
  time: string;
  date: string;
}

function ensureDataDir(): void {
  mkdirSync(DATA_DIR, { recursive: true });
}

function formatTime(date: Date): string {
  return format(date, 'HH:mm');
}

function formatDate(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function parseTime(time: string): { hours: number; minutes: number } {
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

function getPendingSleepDateTime(pending: PendingSleep): Date {
  const { hours, minutes } = parseTime(pending.time);
  const date = new Date(`${pending.date}T00:00:00`);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

function getPendingSleep(): PendingSleep {
  if (!existsSync(PENDING_SLEEP_PATH)) {
    throw new Error('No pending sleep found. Run `sleep-compiler sleep now` first.');
  }

  const raw = readFileSync(PENDING_SLEEP_PATH, 'utf8');
  const parsed = JSON.parse(raw) as Partial<PendingSleep>;

  if (typeof parsed.time !== 'string' || typeof parsed.date !== 'string') {
    throw new Error('Pending sleep file is invalid.');
  }

  return { time: parsed.time, date: parsed.date };
}

function writePendingSleep(pending: PendingSleep): void {
  ensureDataDir();
  writeFileSync(PENDING_SLEEP_PATH, `${JSON.stringify(pending, null, 2)}\n`, 'utf8');
}

function deletePendingSleep(): void {
  if (existsSync(PENDING_SLEEP_PATH)) {
    rmSync(PENDING_SLEEP_PATH);
  }
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

export function registerQuick(program: Command): void {
  program
    .command('sleep')
    .description('Quick sleep actions')
    .command('now')
    .description('Start sleeping now')
    .action(() => {
      try {
        const now = new Date();
        const time = formatTime(now);
        writePendingSleep({
          time,
          date: formatDate(now),
        });

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
        const pending = getPendingSleep();
        const now = new Date();
        const wakeTime = formatTime(now);
        const duration = minutesBetween(getPendingSleepDateTime(pending), now);

        insertEntry(pending.date, pending.time, wakeTime, duration);
        deletePendingSleep();

        console.log(
          `☀️  Good morning! Slept ${formatDuration(duration)} (${pending.time} → ${wakeTime}). Quality: ${getQualityLabel(duration)}`
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

        const pending = getPendingSleep();
        const elapsed = formatDuration(minutesBetween(getPendingSleepDateTime(pending), new Date()));
        console.log(`😴 Currently sleeping since ${pending.time} (${elapsed} ago)`);
      } catch (err) {
        console.error(chalk.red('Error:'), (err as Error).message);
        process.exit(1);
      }
    });
}
