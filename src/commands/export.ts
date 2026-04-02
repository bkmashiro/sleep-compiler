import { Command } from 'commander';
import { getAllEntries } from '../db.js';
import { formatDuration } from '../formatter.js';

export function registerExport(program: Command): void {
  program
    .command('export')
    .description('Export all sleep data')
    .option('--format <fmt>', 'Export format (csv)', 'csv')
    .action((opts: { format: string }) => {
      const entries = getAllEntries();

      if (opts.format === 'csv') {
        console.log('date,sleep_time,wake_time,duration_minutes,duration,note');
        for (const e of entries) {
          const note = e.note ? `"${e.note.replace(/"/g, '""')}"` : '';
          console.log(
            `${e.date},${e.sleep_time},${e.wake_time},${e.duration_minutes},${formatDuration(e.duration_minutes)},${note}`
          );
        }
      } else {
        console.error(`Unsupported format: ${opts.format}. Use --format csv`);
        process.exit(1);
      }
    });
}
