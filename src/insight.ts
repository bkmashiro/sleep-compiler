import { Command } from 'commander';
import chalk from 'chalk';
import { getEntries, type SleepEntry } from './db.js';
import { formatDuration, printHeader } from './formatter.js';
import { parseTime } from './utils.js';

export interface SleepInsight {
  avgBedtimeMinutes: number;
  bedtimeVarianceMinutes: number;
  avgWakeMinutes: number;
  wakeVarianceMinutes: number;
  avgDurationMinutes: number;
  weekendShiftMinutes: number | null;
  weekdayDelta: {
    day: number;
    avgDurationMinutes: number;
    deltaMinutes: number;
  } | null;
  bestDay: {
    day: number;
    avgDurationMinutes: number;
  } | null;
  last7AverageMinutes: number | null;
  last7Vs30DeltaMinutes: number | null;
  bedtimeTrendMinutesPerWeek: number | null;
  sleepDebtMinutes: number | null;
  sampleSize: number;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

/**
 * Converts an HH:MM time string to a total-minutes-since-midnight value.
 * @param value - A time string in "HH:MM" format (e.g. "23:30").
 * @returns Total minutes elapsed since midnight (0–1439).
 */
function toClockMinutes(value: string): number {
  const { hours, minutes } = parseTime(value);
  return hours * 60 + minutes;
}

/**
 * Converts a bedtime string to a continuous minute value that places
 * post-midnight times (00:00–11:59) on the day after midnight so that
 * e.g. 23:30 and 00:30 sort and average correctly as consecutive bedtimes.
 * @param value - A time string in "HH:MM" format.
 * @returns Minutes since midnight, with post-midnight hours shifted forward by
 *   1440 (i.e. 00:30 → 1470, 23:30 → 1410).
 */
function normalizeBedtime(value: string): number {
  const total = toClockMinutes(value);
  return total < 12 * 60 ? total + 24 * 60 : total;
}

/**
 * Computes the arithmetic mean of an array of numbers.
 * @param values - The numbers to average.
 * @returns The mean, or 0 if the array is empty.
 */
function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Computes the population standard deviation of an array of numbers.
 * @param values - The numbers to measure.
 * @returns The standard deviation in the same unit as the input, or 0 when
 *   fewer than two values are provided.
 */
function stddev(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

/**
 * Formats a total-minutes value as a 24-hour clock string ("HH:MM").
 * Handles values outside the 0–1439 range by wrapping modulo 24 h, so it is
 * safe to pass normalized bedtime values (which may exceed 1440).
 * @param totalMinutes - Minutes since midnight, possibly > 1439 or negative.
 * @returns A zero-padded "HH:MM" string.
 */
function formatClock(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

/**
 * Formats a signed minute delta as a human-readable string like "+1h 30min" or
 * "-45 min", suitable for displaying schedule shifts or sleep debt.
 * @param minutes - Signed minute offset (positive = later/more, negative = earlier/less).
 * @returns A string with a leading sign, e.g. "+45 min" or "-1h 05min".
 */
function formatSignedMinutes(minutes: number): string {
  const sign = minutes >= 0 ? '+' : '-';
  const absolute = Math.abs(Math.round(minutes));
  const hours = Math.floor(absolute / 60);
  const mins = absolute % 60;

  if (hours === 0) {
    return `${sign}${mins} min`;
  }

  return `${sign}${hours}h ${mins.toString().padStart(2, '0')}min`;
}

/**
 * Returns the UTC weekday index (0 = Sunday … 6 = Saturday) for a date string.
 * The time is fixed at noon UTC to avoid DST-related off-by-one errors when
 * constructing a Date from a date-only string.
 * @param date - An ISO date string in "YYYY-MM-DD" format.
 * @returns An integer in the range 0–6.
 */
function dateToWeekday(date: string): number {
  return new Date(`${date}T12:00:00Z`).getUTCDay();
}

/**
 * Computes the slope of the ordinary least-squares regression line for a
 * sequence of evenly-spaced observations (index 0, 1, 2, …).
 *
 * The slope is calculated as Σ((x − x̄)(y − ȳ)) / Σ((x − x̄)²) where x is
 * the sample index and y is the observed value. A positive slope means the
 * values trend upward over time; negative means downward.
 *
 * @param values - Ordered observations; each element corresponds to one time step.
 * @returns The slope in units of (value change per index step), or 0 when fewer
 *   than two values are provided or all x-deviations are zero.
 */
function computeSlope(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const meanX = (values.length - 1) / 2;
  const meanY = average(values);
  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < values.length; i++) {
    const x = i - meanX;
    const y = values[i] - meanY;
    numerator += x * y;
    denominator += x * x;
  }

  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Produces a short display string describing the best sleep day of the week.
 * @param day - Weekday index (0 = Sunday … 6 = Saturday) of the best day.
 * @param minutes - Average sleep duration on that day, in minutes.
 * @returns A string like "Sun-Mon consistently 8h+" or "Sun-Mon averages 7h 30min".
 */
function describeBestDay(day: number, minutes: number): string {
  const nextDay = (day + 1) % 7;
  const prefix = `${SHORT_DAY_NAMES[day]}-${SHORT_DAY_NAMES[nextDay]}`;
  if (minutes >= 480) {
    return `${prefix} consistently 8h+`;
  }

  return `${prefix} averages ${formatDuration(Math.round(minutes))}`;
}

/**
 * Derives a comprehensive set of sleep pattern metrics from raw sleep entries.
 *
 * The function considers at most the 30 most recent entries (by date). It
 * computes average bedtime and wake time, their standard deviations, per-weekday
 * breakdowns, a weekend social-jet-lag shift, the last-7-days vs 30-day duration
 * delta, accumulated sleep debt, and a linear bedtime trend in minutes per week.
 *
 * @param entries - Raw sleep entries in any order; they are sorted internally.
 * @returns A {@link SleepInsight} object; fields that require sufficient data
 *   (e.g. `weekendShiftMinutes`) are `null` when that data is unavailable.
 */
export function analyzeSleepEntries(entries: SleepEntry[]): SleepInsight {
  const recentEntries = [...entries]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-30);

  if (recentEntries.length === 0) {
    return {
      avgBedtimeMinutes: 0,
      bedtimeVarianceMinutes: 0,
      avgWakeMinutes: 0,
      wakeVarianceMinutes: 0,
      avgDurationMinutes: 0,
      weekendShiftMinutes: null,
      weekdayDelta: null,
      bestDay: null,
      last7AverageMinutes: null,
      last7Vs30DeltaMinutes: null,
      bedtimeTrendMinutesPerWeek: null,
      sleepDebtMinutes: null,
      sampleSize: 0,
    };
  }

  const bedtimes = recentEntries.map((entry) => normalizeBedtime(entry.sleep_time));
  const wakeTimes = recentEntries.map((entry) => toClockMinutes(entry.wake_time));
  const durations = recentEntries.map((entry) => entry.duration_minutes);
  const avgDurationMinutes = average(durations);
  const weekdayBuckets = Array.from({ length: 7 }, () => [] as SleepEntry[]);

  for (const entry of recentEntries) {
    weekdayBuckets[dateToWeekday(entry.date)].push(entry);
  }

  const weekdayStats = weekdayBuckets
    .map((bucket, day) => {
      if (bucket.length === 0) {
        return null;
      }

      return {
        day,
        avgDurationMinutes: average(bucket.map((entry) => entry.duration_minutes)),
      };
    })
    .filter((value): value is { day: number; avgDurationMinutes: number } => value !== null);

  const weekdayDelta =
    weekdayStats.length === 0
      ? null
      : weekdayStats.reduce((lowest, current) => {
          const currentDelta = current.avgDurationMinutes - avgDurationMinutes;
          const lowestDelta = lowest.avgDurationMinutes - avgDurationMinutes;
          return currentDelta < lowestDelta ? current : lowest;
        });

  const bestDay =
    weekdayStats.length === 0
      ? null
      : weekdayStats.reduce((best, current) => {
          return current.avgDurationMinutes > best.avgDurationMinutes ? current : best;
        });

  const weekendEntries = recentEntries.filter((entry) => {
    const day = dateToWeekday(entry.date);
    return day === 5 || day === 6;
  });
  const weekdayEntries = recentEntries.filter((entry) => {
    const day = dateToWeekday(entry.date);
    return day >= 1 && day <= 4;
  });

  const weekendShiftMinutes =
    weekendEntries.length > 0 && weekdayEntries.length > 0
      ? average(weekendEntries.map((entry) => normalizeBedtime(entry.sleep_time))) -
        average(weekdayEntries.map((entry) => normalizeBedtime(entry.sleep_time)))
      : null;

  const last7 = recentEntries.slice(-7);
  const last7AverageMinutes = last7.length > 0 ? average(last7.map((entry) => entry.duration_minutes)) : null;
  const last7Vs30DeltaMinutes = last7AverageMinutes === null ? null : last7AverageMinutes - avgDurationMinutes;
  const bedtimeTrendMinutesPerWeek = recentEntries.length < 2 ? null : computeSlope(bedtimes) * 7;
  const sleepDebtMinutes =
    last7.length === 0 ? null : last7.reduce((sum, entry) => sum + (entry.duration_minutes - avgDurationMinutes), 0);

  return {
    avgBedtimeMinutes: average(bedtimes),
    bedtimeVarianceMinutes: stddev(bedtimes),
    avgWakeMinutes: average(wakeTimes),
    wakeVarianceMinutes: stddev(wakeTimes),
    avgDurationMinutes,
    weekendShiftMinutes,
    weekdayDelta:
      weekdayDelta === null
        ? null
        : {
            day: weekdayDelta.day,
            avgDurationMinutes: weekdayDelta.avgDurationMinutes,
            deltaMinutes: weekdayDelta.avgDurationMinutes - avgDurationMinutes,
          },
    bestDay,
    last7AverageMinutes,
    last7Vs30DeltaMinutes,
    bedtimeTrendMinutesPerWeek,
    sleepDebtMinutes,
    sampleSize: recentEntries.length,
  };
}

export function registerInsight(program: Command): void {
  program
    .command('insight')
    .description('Analyze recent sleep patterns')
    .action(() => {
      const entries = getEntries(30).reverse();
      const insight = analyzeSleepEntries(entries);

      printHeader(`Sleep Pattern Insights (last ${Math.max(insight.sampleSize, 0)} days)`);

      if (insight.sampleSize === 0) {
        console.log(chalk.gray('No entries found. Log some sleep first!'));
        return;
      }

      console.log('');
      console.log(chalk.bold('📊 Your patterns:'));
      console.log(
        `  Average bedtime:    ${formatClock(insight.avgBedtimeMinutes)} (±${Math.round(insight.bedtimeVarianceMinutes)} min variance)`
      );
      console.log(
        `  Average wake time:  ${formatClock(insight.avgWakeMinutes)} (±${Math.round(insight.wakeVarianceMinutes)} min variance)`
      );
      console.log(`  Average duration:   ${formatDuration(Math.round(insight.avgDurationMinutes))}`);

      console.log('');
      console.log(chalk.bold('🔍 Detected patterns:'));

      if (insight.weekendShiftMinutes !== null) {
        console.log(
          `  Weekend shift:      ${formatSignedMinutes(insight.weekendShiftMinutes)} later bedtime on Fri/Sat`
        );
      }

      if (insight.weekdayDelta !== null) {
        const direction = insight.weekdayDelta.deltaMinutes < 0 ? 'less' : 'more';
        console.log(
          `  ${DAY_NAMES[insight.weekdayDelta.day]} pattern:     ${DAY_NAMES[insight.weekdayDelta.day]}s have ${Math.abs(
            Math.round(insight.weekdayDelta.deltaMinutes)
          )}min ${direction} sleep than average`
        );
      }

      if (insight.bestDay !== null) {
        console.log(`  Best sleep:         ${describeBestDay(insight.bestDay.day, insight.bestDay.avgDurationMinutes)}`);
      }

      console.log('');
      console.log(chalk.bold('📈 Trend:'));

      if (insight.last7AverageMinutes !== null && insight.last7Vs30DeltaMinutes !== null) {
        const comparison = insight.last7Vs30DeltaMinutes <= 0 ? 'below' : 'above';
        console.log(
          `  Last 7 days avg:    ${formatDuration(Math.round(insight.last7AverageMinutes))} ${chalk.gray(
            `← ${Math.abs(Math.round(insight.last7Vs30DeltaMinutes))} min ${comparison} your 30-day average`
          )}`
        );
      }

      if (insight.bedtimeTrendMinutesPerWeek !== null) {
        const direction = insight.bedtimeTrendMinutesPerWeek >= 0 ? 'later' : 'earlier';
        console.log(
          `  Bedtime trend:      ${Math.abs(Math.round(insight.bedtimeTrendMinutesPerWeek))} min/week ${direction}`
        );
      }

      console.log('');
      console.log(chalk.bold('💡 Recommendations:'));

      if (insight.weekendShiftMinutes !== null && insight.weekendShiftMinutes >= 45) {
        console.log(
          `  - Your social jet lag (${formatSignedMinutes(insight.weekendShiftMinutes).replace('+', '')}) is high. Try shifting Fri/Sat earlier by 30min.`
        );
      }

      if (insight.last7Vs30DeltaMinutes !== null && insight.last7Vs30DeltaMinutes < 0) {
        const debt = insight.sleepDebtMinutes === null ? 0 : Math.abs(Math.round(insight.sleepDebtMinutes));
        console.log(`  - Your sleep debt is accumulating. Last 7 days are below your average by ${debt} minutes total.`);
      }

      if (
        insight.weekdayDelta !== null &&
        insight.weekdayDelta.deltaMinutes <= -20 &&
        insight.weekdayDelta.day >= 1 &&
        insight.weekdayDelta.day <= 5
      ) {
        console.log(
          `  - ${DAY_NAMES[insight.weekdayDelta.day]} is your weakest night. Protect that bedtime with a simpler evening routine.`
        );
      }

      if (
        insight.weekendShiftMinutes !== null &&
        insight.weekendShiftMinutes < 45 &&
        (insight.last7Vs30DeltaMinutes === null || insight.last7Vs30DeltaMinutes >= 0)
      ) {
        console.log('  - Your recent pattern looks stable. Keep bedtime drift under 15 min/week.');
      }
    });
}
