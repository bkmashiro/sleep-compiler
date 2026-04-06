import { Command } from 'commander';
import chalk from 'chalk';
import { getAllEntries, getStats } from '../db.js';
import { formatDuration, printHeader } from '../formatter.js';
import { calcConsistencyScore } from '../utils.js';

export function getBestStreak(entries: { date: string; duration_minutes: number }[]): number {
  if (entries.length === 0) return 0;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let current = sorted[0].duration_minutes >= 420 ? 1 : 0;
  let best = current;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].date);
    const curr = new Date(sorted[i].date);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1 && sorted[i].duration_minutes >= 420) {
      current++;
      best = Math.max(best, current);
    } else {
      current = sorted[i].duration_minutes >= 420 ? 1 : 0;
    }
  }
  return best;
}

export function getWorstWeekAvg(entries: { date: string; duration_minutes: number }[]): string {
  if (entries.length < 7) return 'N/A (not enough data)';
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let worstAvg = Infinity;
  for (let i = 0; i <= sorted.length - 7; i++) {
    const week = sorted.slice(i, i + 7);
    const avg = week.reduce((s, e) => s + e.duration_minutes, 0) / 7;
    if (avg < worstAvg) worstAvg = avg;
  }
  return formatDuration(Math.round(worstAvg));
}

export function registerStats(program: Command): void {
  program
    .command('stats')
    .description('Show all-time sleep statistics')
    .action(() => {
      const stats = getStats();
      const entries = getAllEntries();

      if (stats.total === 0) {
        console.log(chalk.gray('No entries found. Log some sleep first!'));
        return;
      }

      printHeader('All-Time Sleep Stats');

      const streak = getBestStreak(entries);
      const worstWeek = getWorstWeekAvg(entries);
      const consistency = calcConsistencyScore(entries.map((e) => e.sleep_time));

      console.log(`Total entries:     ${chalk.bold(stats.total)}`);
      console.log(`Average duration:  ${chalk.bold(formatDuration(Math.round(stats.avg_duration)))}`);
      console.log(`Best night:        ${chalk.bold(formatDuration(stats.max_duration))}`);
      console.log(`Worst night:       ${chalk.bold(formatDuration(stats.min_duration))}`);
      console.log(`Best streak (≥7h): ${chalk.bold(streak + ' days')}`);
      console.log(`Worst week avg:    ${chalk.bold(worstWeek)}`);
      console.log(`Consistency score: ${chalk.bold(consistency + '%')}`);
    });
}
