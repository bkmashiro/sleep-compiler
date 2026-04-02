import { Command } from 'commander';
import chalk from 'chalk';
import { format } from 'date-fns';
import { insertEntry } from '../db.js';
import { formatDuration, getQualityLabel } from '../formatter.js';

function parseTime(t: string): { hours: number; minutes: number } {
  const match = t.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) throw new Error(`Invalid time format: ${t}. Use HH:MM`);
  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  if (hours > 23 || minutes > 59) throw new Error(`Invalid time: ${t}`);
  return { hours, minutes };
}

function calcDuration(sleepTime: string, wakeTime: string): number {
  const s = parseTime(sleepTime);
  const w = parseTime(wakeTime);
  let sleepMins = s.hours * 60 + s.minutes;
  let wakeMins = w.hours * 60 + w.minutes;
  if (wakeMins <= sleepMins) {
    wakeMins += 24 * 60;
  }
  return wakeMins - sleepMins;
}

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
        const duration = calcDuration(opts.sleep, opts.wake);
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
