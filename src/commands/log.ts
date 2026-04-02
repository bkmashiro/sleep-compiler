import { Command } from 'commander';
import chalk from 'chalk';
import { format } from 'date-fns';
import { insertEntry } from '../db.js';
import { formatDuration, getQualityLabel } from '../formatter.js';
import { calcDurationMinutes } from '../utils.js';

export function registerLog(program: Command): void {
  program
    .command('log')
    .description('Log a sleep entry')
    .requiredOption('--sleep <time>', 'Bedtime (HH:MM, 24h)')
    .requiredOption('--wake <time>', 'Wake time (HH:MM, 24h)')
    .option('--date <date>', 'Date (YYYY-MM-DD, default: today)')
    .option('--note <text>', 'Optional note')
    .action((opts: { sleep: string; wake: string; date?: string; note?: string }) => {
      try {
        const date = opts.date ?? format(new Date(), 'yyyy-MM-dd');
        const duration = calcDurationMinutes(opts.sleep, opts.wake);
        insertEntry(date, opts.sleep, opts.wake, duration, opts.note);
        const quality = getQualityLabel(duration);
        console.log(
          chalk.green('✓') +
            ` Logged: ${date} | Sleep: ${opts.sleep} → ${opts.wake} | Duration: ${formatDuration(duration)} | Quality: ${quality}`
        );
      } catch (err) {
        console.error(chalk.red('Error:'), (err as Error).message);
        process.exit(1);
      }
    });
}
