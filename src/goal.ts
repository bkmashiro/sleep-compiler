import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import chalk from 'chalk';
import { eachDayOfInterval, endOfDay, format, startOfDay, subDays } from 'date-fns';
import { createSleepDb, type SleepEntry } from './db.js';

const DATA_DIR = join(homedir(), '.sleep-compiler');
const CONFIG_PATH = join(DATA_DIR, 'config.json');

interface Config {
  goalHours?: number;
}

export interface GoalDay {
  date: string;
  label: string;
  hours: number;
  deltaHours: number;
  status: 'hit' | 'near' | 'miss';
}

export interface GoalSummary {
  goalHours: number;
  days: GoalDay[];
  weeklyAverage: number;
  hitCount: number;
  totalDays: number;
  hitRate: number;
}

function readConfig(configPath = CONFIG_PATH): Config {
  if (!existsSync(configPath)) {
    return {};
  }

  return JSON.parse(readFileSync(configPath, 'utf8')) as Config;
}

function writeConfig(config: Config, configPath = CONFIG_PATH): void {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, 'utf8');
}

function toDaySummary(date: Date, entry: SleepEntry | undefined, goalHours: number): GoalDay {
  const hours = entry ? Math.round((entry.duration_minutes / 60) * 10) / 10 : 0;
  const deltaHours = Math.round((hours - goalHours) * 10) / 10;
  const minutesUnderGoal = Math.max(0, goalHours * 60 - (entry?.duration_minutes ?? 0));

  let status: GoalDay['status'] = 'hit';
  if (minutesUnderGoal > 30) {
    status = 'miss';
  } else if (minutesUnderGoal > 0) {
    status = 'near';
  }

  return {
    date: format(date, 'yyyy-MM-dd'),
    label: format(date, 'EEE'),
    hours,
    deltaHours,
    status,
  };
}

function formatSignedHours(hours: number): string {
  return `${hours >= 0 ? '+' : ''}${hours.toFixed(1)}h`;
}

function buildBar(hours: number): string {
  const filled = Math.min(12, Math.max(0, Math.round(hours * 2)));
  return `${'█'.repeat(filled)}${'░'.repeat(12 - filled)}`;
}

function colorize(text: string, status: GoalDay['status']): string {
  if (status === 'hit') return chalk.green(text);
  if (status === 'near') return chalk.yellow(text);
  return chalk.red(text);
}

function getStatusIcon(status: GoalDay['status']): string {
  if (status === 'hit') return '✅';
  if (status === 'near') return '⚠';
  return '❌';
}

export function setGoalHours(goalHours: number, configPath?: string): void {
  if (!Number.isFinite(goalHours) || goalHours <= 0) {
    throw new Error('Goal hours must be a positive number.');
  }

  const config = readConfig(configPath);
  config.goalHours = goalHours;
  writeConfig(config, configPath);
}

export function getGoalHours(configPath?: string): number | null {
  const config = readConfig(configPath);
  return typeof config.goalHours === 'number' ? config.goalHours : null;
}

export function getGoalSummary(
  goalHours: number,
  options?: {
    dbPath?: string;
    now?: Date;
  }
): GoalSummary {
  const now = options?.now ?? new Date();
  const start = startOfDay(subDays(now, 6));
  const end = endOfDay(now);
  const db = createSleepDb(options?.dbPath);

  try {
    const entries = db.getAllEntries();
    const byDate = new Map(entries.map((entry) => [entry.date, entry]));
    const days = eachDayOfInterval({ start, end }).map((date) =>
      toDaySummary(date, byDate.get(format(date, 'yyyy-MM-dd')), goalHours)
    );
    const totalHours = days.reduce((sum, day) => sum + day.hours, 0);
    const hitCount = days.filter((day) => day.status === 'hit').length;
    const weeklyAverage = days.length === 0 ? 0 : Math.round((totalHours / days.length) * 10) / 10;
    const hitRate = days.length === 0 ? 0 : Math.round((hitCount / days.length) * 100);

    return {
      goalHours,
      days,
      weeklyAverage,
      hitCount,
      totalDays: days.length,
      hitRate,
    };
  } finally {
    db.close();
  }
}

export function renderGoalStatus(summary: GoalSummary): string {
  const lines = [`Sleep goal: ${summary.goalHours}h`, 'Last 7 days:'];

  for (const day of summary.days) {
    const bar = colorize(buildBar(day.hours), day.status);
    const hours = `${day.hours.toFixed(1)}h`.padStart(4);
    const delta = formatSignedHours(day.deltaHours).padStart(6);
    lines.push(`  ${day.label.padEnd(3)} ${bar}  ${hours}  ${colorize(delta, day.status)} ${getStatusIcon(day.status)}`);
  }

  lines.push('');
  lines.push(
    `Weekly average: ${summary.weeklyAverage.toFixed(1)}h  Goal hit: ${summary.hitCount}/${summary.totalDays} days (${summary.hitRate}%)`
  );

  return lines.join('\n');
}
