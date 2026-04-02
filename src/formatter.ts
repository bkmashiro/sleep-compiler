import chalk from 'chalk';

export function formatDuration(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h ${m.toString().padStart(2, '0')}m`;
}

export function getQualityLabel(minutes: number): string {
  if (minutes < 360) return chalk.red('✗ poor');
  if (minutes < 420) return chalk.yellow('⚠ short');
  if (minutes <= 540) return chalk.green('✓ good');
  return chalk.blue('○ long');
}

export function getQualitySymbol(minutes: number): string {
  if (minutes < 360) return chalk.red('✗');
  if (minutes < 420) return chalk.yellow('⚠ (< 7h)');
  if (minutes <= 540) return chalk.green('✓');
  return chalk.blue('○');
}

export function calcConsistencyScore(bedtimes: string[]): number {
  if (bedtimes.length < 2) return 100;

  const toMinutes = (t: string): number => {
    const [h, m] = t.split(':').map(Number);
    // Normalize: treat times >= 18:00 as "same night", times < 18:00 as next day
    const mins = h * 60 + m;
    return mins < 18 * 60 ? mins + 24 * 60 : mins;
  };

  const values = bedtimes.map(toMinutes);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, v) => sum + (v - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);

  if (stddev < 30) return 100;
  if (stddev < 45) return 80;
  if (stddev < 60) return 60;
  return 40;
}

export function printHeader(text: string): void {
  console.log(chalk.bold.cyan(`── ${text} ${'─'.repeat(Math.max(0, 50 - text.length))}`));
}
