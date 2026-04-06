import { Command } from 'commander';
import chalk from 'chalk';
import { getEntries, type SleepEntry } from './db.js';
import { formatDuration, printHeader } from './formatter.js';
import { normalizeBedtime, parseTime } from './utils.js';

/**
 * Aggregated sleep metrics derived from up to the 30 most recent sleep entries.
 * All time values are in minutes; clock times are stored as minutes since midnight
 * (bedtimes after midnight are normalised to the range 1440–1800 so that, e.g.,
 * 01:00 sorts after 23:00 rather than before it).
 */
export interface SleepInsight {
  /** Average bedtime, in clock-minutes since midnight (normalised: values ≥ 1440 are past midnight). */
  avgBedtimeMinutes: number;
  /** Standard deviation of bedtime across the sample period, in minutes. Lower is more consistent. */
  bedtimeVarianceMinutes: number;
  /** Average wake time, in clock-minutes since midnight (0–1439). */
  avgWakeMinutes: number;
  /** Standard deviation of wake time across the sample period, in minutes. */
  wakeVarianceMinutes: number;
  /** Mean sleep duration across the sample period, in minutes. */
  avgDurationMinutes: number;
  /**
   * Social jet lag: how many minutes later the average Friday/Saturday bedtime is
   * compared to the average Monday–Thursday bedtime. Positive = later on weekends.
   * `null` when one group has no data.
   */
  weekendShiftMinutes: number | null;
  /**
   * The weekday (0 = Sunday … 6 = Saturday) with the lowest average sleep duration,
   * together with how far it falls below the overall average (`deltaMinutes ≤ 0`).
   * `null` when no weekday bucket has data.
   */
  weekdayDelta: {
    /** Day-of-week index (0 = Sunday, 6 = Saturday). */
    day: number;
    /** Average sleep duration for this day, in minutes. */
    avgDurationMinutes: number;
    /** Difference from the overall average (negative = less sleep than average). */
    deltaMinutes: number;
  } | null;
  /**
   * The weekday with the highest average sleep duration.
   * `null` when no weekday bucket has data.
   */
  bestDay: {
    /** Day-of-week index (0 = Sunday, 6 = Saturday). */
    day: number;
    /** Average sleep duration for this day, in minutes. */
    avgDurationMinutes: number;
  } | null;
  /** Average sleep duration over the last 7 entries, in minutes. `null` when fewer than 1 entry exists. */
  last7AverageMinutes: number | null;
  /**
   * Difference between the last-7 average and the 30-day average, in minutes.
   * Negative means recent sleep is below the longer-term baseline.
   * `null` when `last7AverageMinutes` is `null`.
   */
  last7Vs30DeltaMinutes: number | null;
  /**
   * Linear trend in bedtime over the sample window, expressed as minutes of drift per week.
   * Positive = bedtime is getting later; negative = getting earlier.
   * `null` when fewer than 2 entries exist.
   */
  bedtimeTrendMinutesPerWeek: number | null;
  /**
   * Cumulative sleep surplus or deficit over the last 7 entries relative to the
   * 30-day average, in minutes. Negative = sleep debt is accumulating.
   * `null` when there are no recent entries.
   */
  sleepDebtMinutes: number | null;
  /** Number of entries actually used for the analysis (capped at 30). */
  sampleSize: number;
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'] as const;
const SHORT_DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

function toClockMinutes(value: string): number {
  const { hours, minutes } = parseTime(value);
  return hours * 60 + minutes;
}

function average(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

/**
 * Population standard deviation of `values`, in the same units as the input.
 * Returns `0` for fewer than 2 values (undefined for a single point).
 */
function stddev(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);
  const variance = average(values.map((value) => (value - mean) ** 2));
  return Math.sqrt(variance);
}

function formatClock(totalMinutes: number): string {
  const normalized = ((Math.round(totalMinutes) % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

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

function dateToWeekday(date: string): number {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(year, month - 1, day).getDay();
}

/**
 * Estimates the slope of a linear trend through an ordered series using
 * ordinary least-squares regression.
 *
 * The independent variable (x) is the 0-based index of each element.
 * The closed-form solution avoids building a full matrix:
 *
 *   slope = Σ (xᵢ − x̄)(yᵢ − ȳ) / Σ (xᵢ − x̄)²
 *
 * Returns 0 when fewer than 2 values are provided or when all x values
 * are identical (denominator = 0), preventing a division-by-zero.
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

function describeBestDay(day: number, minutes: number): string {
  const nextDay = (day + 1) % 7;
  const prefix = `${SHORT_DAY_NAMES[day]}-${SHORT_DAY_NAMES[nextDay]}`;
  if (minutes >= 480) {
    return `${prefix} consistently 8h+`;
  }

  return `${prefix} averages ${formatDuration(Math.round(minutes))}`;
}

/**
 * Derives sleep pattern statistics from a collection of sleep log entries.
 *
 * @param entries - Raw sleep entries (unsorted, any date range). Only the 30
 *   most-recent entries by date are used so that older data does not skew the
 *   metrics.
 * @returns A {@link SleepInsight} snapshot containing:
 *   - **Averages & variance** – mean bedtime/wake/duration and their standard
 *     deviations (in minutes), computed over the working window.
 *   - **Weekend shift** – how many minutes later Fri/Sat bedtimes are compared
 *     to Mon–Thu (a proxy for social jet-lag). `null` when either group is
 *     absent from the window.
 *   - **Weekday delta** – the weekday whose average duration deviates most
 *     *negatively* from the overall mean (the "weakest" night). `null` when
 *     fewer than two distinct weekdays are represented.
 *   - **Best day** – the weekday with the highest average duration.
 *   - **Last-7 vs 30-day comparison** – recent average and its delta against
 *     the full-window mean, revealing short-term trends.
 *   - **Bedtime trend** – linear regression slope of normalized bedtimes,
 *     expressed as minutes-per-week (positive = drifting later).
 *   - **Sleep debt** – cumulative shortfall vs the 30-day average over the
 *     last 7 entries (negative = deficit).
 *   - **sampleSize** – actual number of entries analysed (≤ 30).
 *
 * Algorithm overview:
 *   1. Sort and cap entries to the 30 most-recent dates.
 *   2. Normalise bedtimes so that post-midnight values (< 12:00) wrap to the
 *      next-day equivalent, keeping overnight sessions contiguous on the
 *      number line (see `normalizeBedtime`).
 *   3. Bucket entries by day-of-week (UTC) to compute per-weekday averages.
 *   4. Identify the lowest-average weekday (weekdayDelta) and highest (bestDay).
 *   5. Separate Fri/Sat vs Mon–Thu to compute weekend bedtime shift.
 *   6. Compute the linear slope of the normalised bedtime series via
 *      least-squares (`computeSlope`) and scale to weeks.
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
