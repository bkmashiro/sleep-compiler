import test from 'node:test';
import assert from 'node:assert/strict';

import { getBestStreak, getWorstWeekAvg } from '../src/commands/stats.js';

// ---------------------------------------------------------------------------
// getBestStreak
// ---------------------------------------------------------------------------

test('getBestStreak returns 0 for empty entries', () => {
  assert.equal(getBestStreak([]), 0);
});

test('getBestStreak returns 1 for a single qualifying entry (>=420 min)', () => {
  assert.equal(getBestStreak([{ date: '2026-04-01', duration_minutes: 420 }]), 1);
});

test('getBestStreak returns 0 for a single entry below threshold', () => {
  assert.equal(getBestStreak([{ date: '2026-04-01', duration_minutes: 419 }]), 0);
});

test('getBestStreak counts consecutive qualifying days', () => {
  const entries = [
    { date: '2026-04-01', duration_minutes: 480 },
    { date: '2026-04-02', duration_minutes: 450 },
    { date: '2026-04-03', duration_minutes: 420 },
  ];
  assert.equal(getBestStreak(entries), 3);
});

test('getBestStreak resets when a day is below threshold', () => {
  const entries = [
    { date: '2026-04-01', duration_minutes: 480 },
    { date: '2026-04-02', duration_minutes: 300 }, // breaks the streak
    { date: '2026-04-03', duration_minutes: 480 },
    { date: '2026-04-04', duration_minutes: 480 },
  ];
  // best streak is 2 (Apr 3–4), not 3
  assert.equal(getBestStreak(entries), 2);
});

test('getBestStreak resets when there is a gap between dates', () => {
  const entries = [
    { date: '2026-04-01', duration_minutes: 480 },
    { date: '2026-04-03', duration_minutes: 480 }, // Apr 2 is missing
  ];
  assert.equal(getBestStreak(entries), 1);
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
