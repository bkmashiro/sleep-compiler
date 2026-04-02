#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { Command } from 'commander';
import { registerLog } from './commands/log.js';
import { registerReport } from './commands/report.js';
import { registerStats } from './commands/stats.js';
import { registerExport } from './commands/export.js';
import { registerGoal } from './commands/goal.js';
import { registerQuick } from './commands/quick.js';

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
  version: string;
};

const program = new Command();

program
  .name('sleep-compiler')
  .description('Your personal sleep schedule compiler — log, analyze, and improve your sleep')
  .version(version);

registerLog(program);
registerReport(program);
registerStats(program);
registerExport(program);
registerGoal(program);
registerQuick(program);

program.parse();
