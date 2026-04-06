import { Command } from 'commander';
import { getExportRows, toCsv } from '../exporter.js';
import { getGoalHours } from '../goal.js';

export function registerExport(program: Command, dbPath?: string): void {
  program
    .command('export')
    .description('Export sleep history')
    .option('--format <type>', 'output format: csv or json', 'csv')
    .option('--days <n>', 'Only include the last N days')
    .action((opts: { format: string; days?: string }) => {
      if (opts.format !== 'csv' && opts.format !== 'json') {
        console.error(`Unknown format "${opts.format}". Use --format csv or --format json.`);
        process.exit(1);
      }

      const parsedDays = opts.days ? Number.parseInt(opts.days, 10) : undefined;
      if (opts.days && (parsedDays === undefined || !Number.isInteger(parsedDays) || parsedDays <= 0)) {
        console.error('--days must be a positive integer.');
        process.exit(1);
      }

      const goalHours = getGoalHours() ?? 8;
      const rows = getExportRows(parsedDays, dbPath, goalHours);

      if (opts.format === 'json') {
        console.log(JSON.stringify(rows, null, 2));
        return;
      }

      console.log(toCsv(rows));
    });
}
