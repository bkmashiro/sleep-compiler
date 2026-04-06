export type SleepQuality = 'poor' | 'short' | 'good' | 'long';

/** Bedtimes before this hour (noon) are treated as early-morning next-day sleepers. */
export const EARLY_MORNING_CUTOFF_HOURS = 12;

export function parseTime(value: string): { hours: number; minutes: number } {
  const match = value.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) {
    throw new Error(`Invalid time format: ${value}. Use HH:MM`);
  }

  const hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);

  if (hours > 23 || minutes > 59) {
    throw new Error(`Invalid time: ${value}`);
  }

  return { hours, minutes };
}

export function calcDurationMinutes(sleepTime: string, wakeTime: string): number {
  const sleep = parseTime(sleepTime);
  const wake = parseTime(wakeTime);

  const sleepMinutes = sleep.hours * 60 + sleep.minutes;
  let wakeMinutes = wake.hours * 60 + wake.minutes;

  if (wakeMinutes <= sleepMinutes) {
    wakeMinutes += 24 * 60;
  }

  return wakeMinutes - sleepMinutes;
}

export function classifySleepQuality(minutes: number): SleepQuality {
  if (minutes < 360) return 'poor';
  if (minutes < 420) return 'short';
  if (minutes <= 540) return 'good';
  return 'long';
}

export function normalizeBedtime(value: string): number {
  const { hours, minutes } = parseTime(value);
  const totalMinutes = hours * 60 + minutes;
  return totalMinutes < EARLY_MORNING_CUTOFF_HOURS * 60 ? totalMinutes + 24 * 60 : totalMinutes;
}

export function calcConsistencyScore(bedtimes: string[]): number {
  if (bedtimes.length < 2) return 100;

  const values = bedtimes.map(normalizeBedtime);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);

  if (stddev < 30) return 100;
  if (stddev < 45) return 80;
  if (stddev < 60) return 60;
  return 40;
}
