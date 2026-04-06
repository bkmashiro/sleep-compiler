import chalk from 'chalk';
import { calcConsistencyScore, classifySleepQuality } from './utils.js';

/**
 * Formats a duration in minutes as a human-readable `"Xh MMm"` string.
 *
 * @param minutes - Non-negative integer number of minutes.
 * @returns A string like `"7h 30m"` or `"0h 05m"`. Minutes are always zero-padded to two digits.
 */
export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

/**
 * Returns a coloured label string describing sleep quality for a given duration.
 *
 * Uses {@link classifySleepQuality} to determine the tier, then applies chalk
 * colour and a unicode symbol:
 * - `poor`  → red   `"✗ poor"`
 * - `short` → yellow `"⚠ short"`
 * - `good`  → green  `"✓ good"`
 * - `long`  → blue   `"○ long"`
 *
 * @param minutes - Sleep duration in minutes.
 * @returns ANSI-coloured label string (not suitable for plain-text output).
 */
export function getQualityLabel(minutes: number): string {
  const quality = classifySleepQuality(minutes);
  if (quality === 'poor') return chalk.red('✗ poor');
  if (quality === 'short') return chalk.yellow('⚠ short');
  if (quality === 'good') return chalk.green('✓ good');
  return chalk.blue('○ long');
}

/**
 * Returns a compact coloured symbol for the sleep quality of a given duration.
 *
 * Similar to {@link getQualityLabel} but omits the text description for `poor`
 * and `good`, and includes a duration hint for `short`:
 * - `poor`  → red    `"✗"`
 * - `short` → yellow `"⚠ (< 7h)"`
 * - `good`  → green  `"✓"`
 * - `long`  → blue   `"○"`
 *
 * @param minutes - Sleep duration in minutes.
 * @returns ANSI-coloured symbol string (not suitable for plain-text output).
 */
export function getQualitySymbol(minutes: number): string {
  const quality = classifySleepQuality(minutes);
  if (quality === 'poor') return chalk.red('✗');
  if (quality === 'short') return chalk.yellow('⚠ (< 7h)');
  if (quality === 'good') return chalk.green('✓');
  return chalk.blue('○');
}

/**
 * Prints a bold cyan section header to stdout, padded to ~52 chars with `─`.
 *
 * @param text - Header title text. Long titles simply shrink the right-hand padding to 0.
 */
export function printHeader(text: string): void {
  console.log(chalk.bold.cyan(`── ${text} ${'─'.repeat(Math.max(0, 50 - text.length))}`));
}
