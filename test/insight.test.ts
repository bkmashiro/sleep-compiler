import assert from 'node:assert/strict';
import test from 'node:test';

import { analyzeSleepEntries } from '../src/insight.js';
import type { SleepEntry } from '../src/db.js';

const entries: SleepEntry[] = [
  { id: 1, date: '2026-03-01', sleep_time: '23:55', wake_time: '08:20', duration_minutes: 505, note: null, created_at: '' },
  { id: 2, date: '2026-03-02', sleep_time: '23:10', wake_time: '07:45', duration_minutes: 515, note: null, created_at: '' },
  { id: 3, date: '2026-03-03', sleep_time: '22:50', wake_time: '06:10', duration_minutes: 440, note: null, created_at: '' },
  { id: 4, date: '2026-03-04', sleep_time: '23:15', wake_time: '07:20', duration_minutes: 485, note: null, created_at: '' },
  { id: 5, date: '2026-03-05', sleep_time: '23:20', wake_time: '07:20', duration_minutes: 480, note: null, created_at: '' },
  { id: 6, date: '2026-03-06', sleep_time: '00:35', wake_time: '08:40', duration_minutes: 485, note: null, created_at: '' },
  { id: 7, date: '2026-03-07', sleep_time: '00:40', wake_time: '08:45', duration_minutes: 485, note: null, created_at: '' },
  { id: 8, date: '2026-03-08', sleep_time: '00:05', wake_time: '08:15', duration_minutes: 490, note: null, created_at: '' },
  { id: 9, date: '2026-03-09', sleep_time: '23:20', wake_time: '07:45', duration_minutes: 505, note: null, created_at: '' },
  { id: 10, date: '2026-03-10', sleep_time: '23:00', wake_time: '06:15', duration_minutes: 435, note: null, created_at: '' },
  { id: 11, date: '2026-03-11', sleep_time: '23:25', wake_time: '07:20', duration_minutes: 475, note: null, created_at: '' },
  { id: 12, date: '2026-03-12', sleep_time: '23:30', wake_time: '07:30', duration_minutes: 480, note: null, created_at: '' },
  { id: 13, date: '2026-03-13', sleep_time: '00:50', wake_time: '08:45', duration_minutes: 475, note: null, created_at: '' },
  { id: 14, date: '2026-03-14', sleep_time: '00:55', wake_time: '08:55', duration_minutes: 480, note: null, created_at: '' },
  { id: 15, date: '2026-03-15', sleep_time: '00:10', wake_time: '08:25', duration_minutes: 495, note: null, created_at: '' },
  { id: 16, date: '2026-03-16', sleep_time: '23:30', wake_time: '07:40', duration_minutes: 490, note: null, created_at: '' },
  { id: 17, date: '2026-03-17', sleep_time: '23:10', wake_time: '06:25', duration_minutes: 435, note: null, created_at: '' },
  { id: 18, date: '2026-03-18', sleep_time: '23:35', wake_time: '07:20', duration_minutes: 465, note: null, created_at: '' },
  { id: 19, date: '2026-03-19', sleep_time: '23:40', wake_time: '07:20', duration_minutes: 460, note: null, created_at: '' },
  { id: 20, date: '2026-03-20', sleep_time: '01:05', wake_time: '08:40', duration_minutes: 455, note: null, created_at: '' },
  { id: 21, date: '2026-03-21', sleep_time: '01:10', wake_time: '08:35', duration_minutes: 445, note: null, created_at: '' },
  { id: 22, date: '2026-03-22', sleep_time: '00:20', wake_time: '08:10', duration_minutes: 470, note: null, created_at: '' },
  { id: 23, date: '2026-03-23', sleep_time: '23:40', wake_time: '07:25', duration_minutes: 465, note: null, created_at: '' },
  { id: 24, date: '2026-03-24', sleep_time: '23:15', wake_time: '06:05', duration_minutes: 410, note: null, created_at: '' },
  { id: 25, date: '2026-03-25', sleep_time: '23:45', wake_time: '07:15', duration_minutes: 450, note: null, created_at: '' },
  { id: 26, date: '2026-03-26', sleep_time: '23:50', wake_time: '07:10', duration_minutes: 440, note: null, created_at: '' },
  { id: 27, date: '2026-03-27', sleep_time: '01:20', wake_time: '08:40', duration_minutes: 440, note: null, created_at: '' },
  { id: 28, date: '2026-03-28', sleep_time: '01:25', wake_time: '08:35', duration_minutes: 430, note: null, created_at: '' },
  { id: 29, date: '2026-03-29', sleep_time: '00:35', wake_time: '08:00', duration_minutes: 445, note: null, created_at: '' },
  { id: 30, date: '2026-03-30', sleep_time: '23:55', wake_time: '07:05', duration_minutes: 430, note: null, created_at: '' },
];

function makeEntry(id: number, date: string, sleepTime: string, wakeTime: string, durationMinutes: number): SleepEntry {
  return { id, date, sleep_time: sleepTime, wake_time: wakeTime, duration_minutes: durationMinutes, note: null, created_at: '' };
}

test('analyzeSleepEntries returns zero-sampleSize insight for empty input', () => {
  const insight = analyzeSleepEntries([]);

  assert.equal(insight.sampleSize, 0);
  assert.equal(insight.avgDurationMinutes, 0);
  assert.equal(insight.weekendShiftMinutes, null);
  assert.equal(insight.weekdayDelta, null);
  assert.equal(insight.bestDay, null);
  assert.equal(insight.last7AverageMinutes, null);
  assert.equal(insight.last7Vs30DeltaMinutes, null);
  assert.equal(insight.bedtimeTrendMinutesPerWeek, null);
  assert.equal(insight.sleepDebtMinutes, null);
});

test('analyzeSleepEntries caps analysis at the 30 most-recent entries', () => {
  // Use dates across two months to keep all dates valid
  const all = Array.from({ length: 35 }, (_, i) => {
    const date = new Date(Date.UTC(2026, 0, i + 1)); // Jan 1 – Feb 4
    const dateStr = date.toISOString().slice(0, 10);
    return makeEntry(i + 1, dateStr, '23:00', '07:00', 480);
  });
  const insight = analyzeSleepEntries(all);

  assert.equal(insight.sampleSize, 30);
});

test('analyzeSleepEntries handles single entry: no trend, no weekend shift', () => {
  const insight = analyzeSleepEntries([
    makeEntry(1, '2026-03-10', '23:00', '07:00', 480),
  ]);

  assert.equal(insight.sampleSize, 1);
  assert.equal(insight.bedtimeTrendMinutesPerWeek, null);
  // weekend shift is null because we don't have both weekday and weekend entries
  assert.equal(insight.weekendShiftMinutes, null);
  assert.equal(insight.bedtimeVarianceMinutes, 0);
});

test('analyzeSleepEntries handles post-midnight bedtimes without wrapping artefacts', () => {
  // All entries sleep at 01:00 — normalizeBedtime must add 24h so the mean
  // stays close to 25*60 rather than jumping to 60.
  const entries = [
    makeEntry(1, '2026-03-01', '01:00', '09:00', 480),
    makeEntry(2, '2026-03-02', '01:00', '09:00', 480),
    makeEntry(3, '2026-03-03', '01:00', '09:00', 480),
  ];
  const insight = analyzeSleepEntries(entries);

  assert.equal(Math.round(insight.avgBedtimeMinutes), 25 * 60); // 01:00 normalised to hour 25
  assert.equal(insight.bedtimeVarianceMinutes, 0);
});

test('analyzeSleepEntries weekendShiftMinutes is null when only weekday entries exist', () => {
  // 2026-03-02 is Monday, …03-06 is Friday — skip Fri/Sat to get only Mon–Thu
  const entries = [
    makeEntry(1, '2026-03-02', '23:00', '07:00', 480), // Mon
    makeEntry(2, '2026-03-03', '23:00', '07:00', 480), // Tue
    makeEntry(3, '2026-03-04', '23:00', '07:00', 480), // Wed
    makeEntry(4, '2026-03-05', '23:00', '07:00', 480), // Thu
  ];
  const insight = analyzeSleepEntries(entries);

  assert.equal(insight.weekendShiftMinutes, null);
});

test('analyzeSleepEntries last7Vs30DeltaMinutes is positive when recent sleep is longer', () => {
  // Build 30 entries: first 23 at 420 min, last 7 at 540 min
  const base = Array.from({ length: 23 }, (_, i) => {
    const day = String(i + 1).padStart(2, '0');
    return makeEntry(i + 1, `2026-01-${day}`, '23:00', '06:00', 420);
  });
  const recent = Array.from({ length: 7 }, (_, i) => {
    const day = String(24 + i).padStart(2, '0');
    return makeEntry(24 + i, `2026-01-${day}`, '22:00', '07:00', 540);
  });
  const insight = analyzeSleepEntries([...base, ...recent]);

  assert.ok((insight.last7Vs30DeltaMinutes ?? 0) > 0);
});

test('analyzeSleepEntries calculates weekend shift, weekday slump, and trend', () => {
  const insight = analyzeSleepEntries(entries);

  assert.equal(insight.sampleSize, 30);
  assert.equal(Math.round(insight.avgDurationMinutes), 465);
  assert.equal(Math.round(insight.weekendShiftMinutes ?? 0), 95);
  assert.equal(insight.weekdayDelta?.day, 2);
  assert.equal(Math.round(insight.weekdayDelta?.deltaMinutes ?? 0), -35);
  assert.equal(insight.bestDay?.day, 0);
  assert.equal(Math.round(insight.last7AverageMinutes ?? 0), 435);
  assert.equal(Math.round(insight.last7Vs30DeltaMinutes ?? 0), -30);
  assert.equal(Math.round(insight.bedtimeTrendMinutesPerWeek ?? 0), 15);
  assert.equal(Math.round(insight.sleepDebtMinutes ?? 0), -212);
});

test('analyzeSleepEntries returns zero-filled insight for empty input', () => {
  const insight = analyzeSleepEntries([]);

  assert.equal(insight.sampleSize, 0);
  assert.equal(insight.avgDurationMinutes, 0);
  assert.equal(insight.avgBedtimeMinutes, 0);
  assert.equal(insight.avgWakeMinutes, 0);
  assert.equal(insight.bedtimeVarianceMinutes, 0);
  assert.equal(insight.wakeVarianceMinutes, 0);
  assert.equal(insight.weekendShiftMinutes, null);
  assert.equal(insight.weekdayDelta, null);
  assert.equal(insight.bestDay, null);
  assert.equal(insight.last7AverageMinutes, null);
  assert.equal(insight.last7Vs30DeltaMinutes, null);
  assert.equal(insight.bedtimeTrendMinutesPerWeek, null);
  assert.equal(insight.sleepDebtMinutes, null);
});

test('analyzeSleepEntries handles a single entry', () => {
  const single: SleepEntry[] = [
    { id: 1, date: '2026-03-05', sleep_time: '23:00', wake_time: '07:00', duration_minutes: 480, note: null, created_at: '' },
  ];
  const insight = analyzeSleepEntries(single);

  assert.equal(insight.sampleSize, 1);
  assert.equal(insight.avgDurationMinutes, 480);
  // stddev is undefined for a single point — must not throw, returns 0
  assert.equal(insight.bedtimeVarianceMinutes, 0);
  assert.equal(insight.wakeVarianceMinutes, 0);
  // trend requires ≥2 entries
  assert.equal(insight.bedtimeTrendMinutesPerWeek, null);
  // last7 should reflect the single entry
  assert.equal(insight.last7AverageMinutes, 480);
  assert.equal(insight.last7Vs30DeltaMinutes, 0);
});

test('analyzeSleepEntries caps sample at 30 most recent entries', () => {
  // Spread across two months to keep all dates valid
  const manyEntries: SleepEntry[] = [
    ...Array.from({ length: 20 }, (_, i) => ({
      id: i + 1,
      date: `2026-02-${String(i + 1).padStart(2, '0')}`,
      sleep_time: '23:00',
      wake_time: '07:00',
      duration_minutes: 480,
      note: null,
      created_at: '',
    })),
    ...Array.from({ length: 20 }, (_, i) => ({
      id: i + 21,
      date: `2026-03-${String(i + 1).padStart(2, '0')}`,
      sleep_time: '23:00',
      wake_time: '07:00',
      duration_minutes: 480,
      note: null,
      created_at: '',
    })),
  ];
  const insight = analyzeSleepEntries(manyEntries);

  assert.equal(insight.sampleSize, 30);
});

test('analyzeSleepEntries handles after-midnight bedtime normalisation', () => {
  // A bedtime of 01:00 should sort after 23:00, not before it
  const pair: SleepEntry[] = [
    { id: 1, date: '2026-03-06', sleep_time: '23:00', wake_time: '07:00', duration_minutes: 480, note: null, created_at: '' },
    { id: 2, date: '2026-03-07', sleep_time: '01:00', wake_time: '09:00', duration_minutes: 480, note: null, created_at: '' },
  ];
  const insight = analyzeSleepEntries(pair);

  // 23:00 = 1380 min, 01:00 normalised = 1500 min; average = 1440 (midnight)
  assert.equal(insight.avgBedtimeMinutes, 1440);
  // bedtime is drifting later by 120 min over 1 step → 7 × 120 = 840 min/week
  assert.equal(insight.bedtimeTrendMinutesPerWeek, 840);
});

test('analyzeSleepEntries returns null weekendShift when only weekday entries exist', () => {
  // 2026-03-02 (Mon) through 2026-03-06 (Fri) — no Sat/Sun
  const weekdayOnly: SleepEntry[] = [
    { id: 1, date: '2026-03-02', sleep_time: '23:00', wake_time: '07:00', duration_minutes: 480, note: null, created_at: '' },
    { id: 2, date: '2026-03-03', sleep_time: '23:00', wake_time: '07:00', duration_minutes: 480, note: null, created_at: '' },
    { id: 3, date: '2026-03-04', sleep_time: '23:00', wake_time: '07:00', duration_minutes: 480, note: null, created_at: '' },
  ];
  const insight = analyzeSleepEntries(weekdayOnly);

  assert.equal(insight.weekendShiftMinutes, null);
});

test('analyzeSleepEntries sleepDebt is positive when recent sleep exceeds baseline', () => {
  // 3 baseline entries at 420 min, then 7 entries at 480 min → debt = 7 × (480−440) = +280
  const baseline: SleepEntry[] = Array.from({ length: 3 }, (_, i) => ({
    id: i + 1,
    date: `2026-03-0${i + 1}`,
    sleep_time: '23:30',
    wake_time: '06:30',
    duration_minutes: 420,
    note: null,
    created_at: '',
  }));
  const recent: SleepEntry[] = Array.from({ length: 7 }, (_, i) => ({
    id: i + 4,
    date: `2026-03-${String(i + 10).padStart(2, '0')}`,
    sleep_time: '22:00',
    wake_time: '06:00',
    duration_minutes: 480,
    note: null,
    created_at: '',
  }));
  const insight = analyzeSleepEntries([...baseline, ...recent]);

  assert.ok(insight.sleepDebtMinutes !== null && insight.sleepDebtMinutes > 0,
    'sleep debt should be positive when recent sleep is above average');
});
