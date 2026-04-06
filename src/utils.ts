export type SleepQuality = 'poor' | 'short' | 'good' | 'long';

/** Minimum minutes for sleep to be classified as 'short' (6 hours). */
const POOR_THRESHOLD = 360;
/** Minimum minutes for sleep to be classified as 'good' (7 hours). */
const SHORT_THRESHOLD = 420;
/** Maximum minutes for sleep to remain 'good' (9 hours). Above this is 'long'. */
const GOOD_THRESHOLD = 540;

/** Stddev threshold (minutes) for a consistency score of 100. */
const CONSISTENCY_PERFECT = 30;
/** Stddev threshold (minutes) for a consistency score of 80. */
const CONSISTENCY_GOOD = 45;
/** Stddev threshold (minutes) for a consistency score of 60. Below this scores 40. */
const CONSISTENCY_FAIR = 60;

/**
 * Parses a time string in `HH:MM` or `H:MM` format into hours and minutes.
 *
 * @param value - A time string, e.g. `"23:05"` or `"7:30"`.
 * @returns An object with integer `hours` (0–23) and `minutes` (0–59).
 * @throws {Error} If the string does not match `HH:MM` / `H:MM` format.
 * @throws {Error} If hours > 23 or minutes > 59.
 */
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

/**
 * Calculates the sleep duration in minutes between a bedtime and a wake time.
 *
 * Handles midnight crossings: when `wakeTime` is on or before `sleepTime` on the
 * clock (e.g. sleep `"23:00"`, wake `"07:00"`), a full 24-hour day (1440 min) is
 * added to the wake value so the result is always positive and ≤ 1440.
 * Equal times (e.g. `"08:00"` → `"08:00"`) are treated as exactly 24 h of sleep.
 *
 * @param sleepTime - Bedtime in `HH:MM` format, e.g. `"23:30"`.
 * @param wakeTime  - Wake time in `HH:MM` format, e.g. `"07:15"`.
 * @returns Duration in whole minutes (1–1440).
 * @throws {Error} If either argument is not a valid `HH:MM` time.
 */
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

/**
 * Classifies sleep duration into a quality bucket.
 *
 * | Duration              | Result  |
 * |-----------------------|---------|
 * | < 360 min  (< 6 h)    | `poor`  |
 * | < 420 min  (< 7 h)    | `short` |
 * | ≤ 540 min  (≤ 9 h)    | `good`  |
 * | > 540 min  (> 9 h)    | `long`  |
 *
 * @param minutes - Sleep duration in minutes.
 * @returns One of `'poor'`, `'short'`, `'good'`, or `'long'`.
 */
export function classifySleepQuality(minutes: number): SleepQuality {
  if (minutes < POOR_THRESHOLD) return 'poor';
  if (minutes < SHORT_THRESHOLD) return 'short';
  if (minutes <= GOOD_THRESHOLD) return 'good';
  return 'long';
}

/**
 * Converts a bedtime string to a comparable minute value on a continuous
 * number line that crosses midnight cleanly.
 *
 * Times before 18:00 (1080 min) are assumed to be the *next* calendar day
 * (e.g. 01:00 means 1 a.m. the following night), so 24 × 60 is added.
 * This keeps late-night bedtimes numerically adjacent to early-morning
 * ones, preventing them from wrapping to the start of the scale and
 * distorting averages or standard-deviation calculations.
 */
export function normalizeBedtime(value: string): number {
  const { hours, minutes } = parseTime(value);
  const totalMinutes = hours * 60 + minutes;
  return totalMinutes < EARLY_MORNING_CUTOFF_HOURS * 60 ? totalMinutes + 24 * 60 : totalMinutes;
}

/**
 * Scores bedtime consistency as a value in `{40, 60, 80, 100}` based on the
 * standard deviation of the supplied bedtimes.
 *
 * Bedtimes are first *normalised* to a continuous timeline: any time earlier
 * than 18:00 (i.e. an after-midnight bedtime like `"01:30"`) is shifted forward
 * by 24 hours so that `"01:30"` sorts after `"23:00"` rather than before it.
 * This prevents the mean from being pulled toward noon when comparing, say,
 * `"23:30"` and `"00:30"`.
 *
 * | Std-dev (minutes) | Score |
 * |-------------------|-------|
 * | < 30              | 100   |
 * | 30–44             | 80    |
 * | 45–59             | 60    |
 * | ≥ 60              | 40    |
 *
 * @param bedtimes - Array of bedtime strings in `HH:MM` format. Fewer than two
 *   entries always returns `100` (no variance to measure).
 * @returns Consistency score: `40`, `60`, `80`, or `100`.
 */
export function calcConsistencyScore(bedtimes: string[]): number {
  if (bedtimes.length < 2) return 100;

  const values = bedtimes.map(normalizeBedtime);
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / values.length;
  const stddev = Math.sqrt(variance);

  if (stddev < 30) return 100; // < 30 min variance → excellent consistency
  if (stddev < 45) return 80;  // 30–44 min variance → good consistency
  if (stddev < 60) return 60;  // 45–59 min variance → fair consistency
  return 40;                   // ≥ 60 min variance → poor consistency
}
