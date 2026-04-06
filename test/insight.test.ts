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

test('analyzeSleepEntries returns zero-sample insight for empty input', () => {
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

test('analyzeSleepEntries with a single entry returns no trend or weekend shift', () => {
  const single: SleepEntry[] = [
    { id: 1, date: '2026-03-01', sleep_time: '23:00', wake_time: '07:00', duration_minutes: 480, note: null, created_at: '' },
  ];
  const insight = analyzeSleepEntries(single);

  assert.equal(insight.sampleSize, 1);
  assert.equal(insight.avgDurationMinutes, 480);
  // Can't compute a trend with one point
  assert.equal(insight.bedtimeTrendMinutesPerWeek, null);
  // Can't compare weekday vs weekend with only one entry
  assert.equal(insight.weekendShiftMinutes, null);
});

test('analyzeSleepEntries caps at the 30 most recent entries when given more', () => {
  // Build 35 entries spread across Feb and Mar 2026 (28 days in Feb + 7 in Mar)
  const dates = [
    ...Array.from({ length: 28 }, (_, i) => `2026-02-${String(i + 1).padStart(2, '0')}`),
    ...Array.from({ length: 7 }, (_, i) => `2026-03-${String(i + 1).padStart(2, '0')}`),
  ];
  const manyEntries: SleepEntry[] = dates.map((date, i) => ({
    id: i + 1,
    date,
    sleep_time: '23:00',
    wake_time: '07:00',
    duration_minutes: 480,
    note: null,
    created_at: '',
  }));
  const insight = analyzeSleepEntries(manyEntries);

  assert.equal(insight.sampleSize, 30);
});

test('analyzeSleepEntries normalizes post-midnight bedtimes correctly for averages', () => {
  // All bedtimes are post-midnight; normalizeBedtime should shift them by +1440
  // so that averaging treats 00:30 as later than 23:30, not earlier.
  const postMidnight: SleepEntry[] = [
    { id: 1, date: '2026-03-01', sleep_time: '00:00', wake_time: '08:00', duration_minutes: 480, note: null, created_at: '' },
    { id: 2, date: '2026-03-02', sleep_time: '00:30', wake_time: '08:30', duration_minutes: 480, note: null, created_at: '' },
    { id: 3, date: '2026-03-03', sleep_time: '01:00', wake_time: '09:00', duration_minutes: 480, note: null, created_at: '' },
  ];
  const insight = analyzeSleepEntries(postMidnight);

  // Average of 1440, 1470, 1500 → 1470 → wraps back to 00:30
  assert.equal(Math.round(insight.avgBedtimeMinutes), 1470);
});

test('analyzeSleepEntries computes zero slope for a flat bedtime series', () => {
  // All bedtimes identical → slope should be exactly 0 → trend = 0 min/week
  const flat: SleepEntry[] = Array.from({ length: 10 }, (_, i) => ({
    id: i + 1,
    date: `2026-03-${String(i + 1).padStart(2, '0')}`,
    sleep_time: '23:00',
    wake_time: '07:00',
    duration_minutes: 480,
    note: null,
    created_at: '',
  }));
  const insight = analyzeSleepEntries(flat);

  assert.equal(insight.bedtimeTrendMinutesPerWeek, 0);
});

test('analyzeSleepEntries returns null weekendShift when no weekday entries exist', () => {
  // 2026-03-07 is Saturday, 2026-03-08 is Sunday — no Mon–Thu entries
  const weekendOnly: SleepEntry[] = [
    { id: 1, date: '2026-03-07', sleep_time: '01:00', wake_time: '09:00', duration_minutes: 480, note: null, created_at: '' },
    { id: 2, date: '2026-03-08', sleep_time: '01:30', wake_time: '09:30', duration_minutes: 480, note: null, created_at: '' },
  ];
  const insight = analyzeSleepEntries(weekendOnly);

  assert.equal(insight.weekendShiftMinutes, null);
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
