import { Command } from 'commander';
import { getExportRows, toCsv } from '../exporter.js';

export function registerExport(program: Command): void {
  program
    .command('export')
    .description('Export sleep history')
    .option('--csv', 'Output CSV to stdout')
    .option('--json', 'Output JSON to stdout')
    .option('--days <n>', 'Only include the last N days')
    .action((opts: { csv?: boolean; json?: boolean; days?: string }) => {
      if (opts.csv && opts.json) {
        console.error('Choose either --csv or --json, not both.');
        process.exit(1);
      }

      const parsedDays = opts.days ? Number.parseInt(opts.days, 10) : undefined;
      if (opts.days && (parsedDays === undefined || !Number.isInteger(parsedDays) || parsedDays <= 0)) {
        console.error('--days must be a positive integer.');
        process.exit(1);
      }

      const rows = getExportRows(parsedDays);

      if (opts.json) {
        console.log(JSON.stringify(rows, null, 2));
        return;
      }

      console.log(toCsv(rows));
    });
}
