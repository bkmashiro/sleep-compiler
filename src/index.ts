#!/usr/bin/env node
import { Command } from 'commander';
import { registerLog } from './commands/log.js';
import { registerReport } from './commands/report.js';
import { registerStats } from './commands/stats.js';
import { registerExport } from './commands/export.js';
import { registerQuick } from './commands/quick.js';

const program = new Command();

program
  .name('sleep-compiler')
  .description('Your personal sleep schedule compiler — log, analyze, and improve your sleep')
  .version('1.0.0');

registerLog(program);
registerReport(program);
registerStats(program);
registerExport(program);
registerQuick(program);

program.parse();
