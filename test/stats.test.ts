import assert from 'node:assert/strict';
import test from 'node:test';

import { getBestStreak } from '../src/commands/stats.js';

const entry = (date: string, duration_minutes: number) => ({ date, duration_minutes });

test('getBestStreak returns 0 for empty entries', () => {
  assert.equal(getBestStreak([], 420), 0);
});

test('getBestStreak returns 1 for a single night that meets the goal', () => {
  assert.equal(getBestStreak([entry('2026-04-01', 420)], 420), 1);
});

test('getBestStreak returns 0 for a single night below the goal', () => {
  assert.equal(getBestStreak([entry('2026-04-01', 419)], 420), 0);
});

test('getBestStreak counts consecutive qualifying nights', () => {
  const entries = [
    entry('2026-04-01', 420),
    entry('2026-04-02', 450),
    entry('2026-04-03', 480),
  ];
  assert.equal(getBestStreak(entries, 420), 3);
});

test('getBestStreak resets when a night falls below goal', () => {
  const entries = [
    entry('2026-04-01', 420),
    entry('2026-04-02', 300), // below 7h goal
    entry('2026-04-03', 420),
    entry('2026-04-04', 420),
  ];
  assert.equal(getBestStreak(entries, 420), 2);
});

test('getBestStreak resets on non-consecutive dates', () => {
  const entries = [
    entry('2026-04-01', 480),
    entry('2026-04-03', 480), // gap — skipped 2026-04-02
    entry('2026-04-04', 480),
  ];
  assert.equal(getBestStreak(entries, 480), 2);
});

test('getBestStreak uses goalMinutes, not a hardcoded 420', () => {
  const entries = [
    entry('2026-04-01', 480),
    entry('2026-04-02', 480),
  ];
  // 480 min = 8h; streak of 2 when goal is 8h
  assert.equal(getBestStreak(entries, 480), 2);
  // same entries fall below a 9h goal (540 min) → no qualifying day → streak 0
  assert.equal(getBestStreak(entries, 540), 0);
});

test('getBestStreak handles unsorted input', () => {
  const entries = [
    { date: '2026-04-03', duration_minutes: 420 },
    { date: '2026-04-01', duration_minutes: 420 },
    { date: '2026-04-02', duration_minutes: 420 },
  ];
  assert.equal(getBestStreak(entries), 3);
});

// ---------------------------------------------------------------------------
// getWorstWeekAvg
// ---------------------------------------------------------------------------

test('getWorstWeekAvg returns N/A message with fewer than 7 entries', () => {
  const entries = [
    { date: '2026-04-01', duration_minutes: 480 },
    { date: '2026-04-02', duration_minutes: 480 },
  ];
  assert.equal(getWorstWeekAvg(entries), 'N/A (not enough data)');
});

test('getWorstWeekAvg returns N/A message with exactly 6 entries', () => {
  const entries = Array.from({ length: 6 }, (_, i) => ({
    date: `2026-04-0${i + 1}`,
    duration_minutes: 480,
  }));
  assert.equal(getWorstWeekAvg(entries), 'N/A (not enough data)');
});

test('getWorstWeekAvg formats the average correctly with exactly 7 entries', () => {
  // 7 × 480 min = avg 480 min = 8h 00m
  const entries = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-04-0${i + 1}`,
    duration_minutes: 480,
  }));
  assert.equal(getWorstWeekAvg(entries), '8h 00m');
});

test('getWorstWeekAvg returns the worst (lowest) 7-day window average', () => {
  // Two non-overlapping windows:
  //   Apr 1–7: avg = (7 × 480) / 7 = 480 min
  //   Apr 2–8: avg = (6 × 480 + 300) / 7 ≈ 455 min  ← worst
  const entries = [
    { date: '2026-04-01', duration_minutes: 480 },
    { date: '2026-04-02', duration_minutes: 480 },
    { date: '2026-04-03', duration_minutes: 480 },
    { date: '2026-04-04', duration_minutes: 480 },
    { date: '2026-04-05', duration_minutes: 480 },
    { date: '2026-04-06', duration_minutes: 480 },
    { date: '2026-04-07', duration_minutes: 480 },
    { date: '2026-04-08', duration_minutes: 300 },
  ];
  // worst window is Apr 2–8: (6 × 480 + 300) / 7 = 3180/7 ≈ 454.28 → round → 454 min = 7h 34m
  assert.equal(getWorstWeekAvg(entries), '7h 34m');
});

test('getWorstWeekAvg picks worst window across multiple weeks', () => {
  // Week A (Apr 1–7): all 480 min → avg 480
  // Week B (Apr 8–14): all 360 min → avg 360 ← worst
  const weekA = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-04-0${i + 1}`,
    duration_minutes: 480,
  }));
  const weekB = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-04-${(i + 8).toString().padStart(2, '0')}`,
    duration_minutes: 360,
  }));
  // 360 min = 6h 00m
  assert.equal(getWorstWeekAvg([...weekA, ...weekB]), '6h 00m');
});
