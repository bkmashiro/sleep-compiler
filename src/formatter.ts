import chalk from 'chalk';
import { calcConsistencyScore, classifySleepQuality } from './utils.js';

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export function getQualityLabel(minutes: number): string {
  const quality = classifySleepQuality(minutes);
  if (quality === 'poor') return chalk.red('✗ poor');
  if (quality === 'short') return chalk.yellow('⚠ short');
  if (quality === 'good') return chalk.green('✓ good');
  return chalk.blue('○ long');
}

export function getQualitySymbol(minutes: number): string {
  const quality = classifySleepQuality(minutes);
  if (quality === 'poor') return chalk.red('✗');
  if (quality === 'short') return chalk.yellow('⚠ (< 7h)');
  if (quality === 'good') return chalk.green('✓');
  return chalk.blue('○');
}

export function printHeader(text: string): void {
  console.log(chalk.bold.cyan(`── ${text} ${'─'.repeat(Math.max(0, 50 - text.length))}`));
}
