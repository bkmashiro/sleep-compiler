import { Command } from 'commander';
import chalk from 'chalk';
import { getEntries } from '../db.js';
import { formatDuration, getQualitySymbol, calcConsistencyScore, printHeader } from '../formatter.js';

export function registerReport(program: Command): void {
  program
    .command('report')
    .description('Show sleep report for the last N days')
    .option('--days <n>', 'Last N days', '7')
    .option('--json', 'Output as JSON')
    .action((opts: { days: string; json?: boolean }) => {
      const days = parseInt(opts.days, 10);
      const entries = getEntries(days);

      if (opts.json) {
        console.log(JSON.stringify(entries, null, 2));
        return;
      }

      printHeader(`Sleep Report (last ${days} days)`);
      if (entries.length === 0) {
        console.log(chalk.gray('No entries found.'));
        return;
      }

      const header = [
        'Date'.padEnd(13),
        'Bedtime'.padEnd(9),
        'Wake'.padEnd(8),
        'Duration'.padEnd(10),
        'Quality',
      ].join('');
      console.log(chalk.bold(header));

      for (const e of entries) {
        const row = [
          e.date.padEnd(13),
          e.sleep_time.padEnd(9),
          e.wake_time.padEnd(8),
          formatDuration(e.duration_minutes).padEnd(10),
          getQualitySymbol(e.duration_minutes),
        ].join('');
        console.log(row);
        if (e.note) {
          console.log(chalk.gray(`  Note: ${e.note}`));
        }
      }

      const totalMins = entries.reduce((sum, e) => sum + e.duration_minutes, 0);
      const avgMins = Math.round(totalMins / entries.length);
      const score = calcConsistencyScore(entries.map((e) => e.sleep_time));

      console.log('');
      console.log(`Average duration: ${chalk.bold(formatDuration(avgMins))}`);
      console.log(`Consistency score: ${chalk.bold(score + '%')} (bedtime variance)`);
    });
}
