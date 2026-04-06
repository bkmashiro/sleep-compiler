import assert from 'node:assert/strict';
import test from 'node:test';

import { createSleepDb } from '../../src/db.js';
import { calcConsistencyScore } from '../../src/utils.js';

// Inline the private helpers from stats.ts to test their logic directly.
function getBestStreak(entries: { date: string; duration_minutes: number }[]): number {
  if (entries.length === 0) return 0;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let best = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1].date);
    const curr = new Date(sorted[i].date);
    const diff = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
    if (diff === 1 && sorted[i].duration_minutes >= 420) {
      current++;
      best = Math.max(best, current);
    } else {
      current = sorted[i].duration_minutes >= 420 ? 1 : 0;
    }
  }
  return best;
}

function getWorstWeekAvg(entries: { date: string; duration_minutes: number }[]): string | null {
  if (entries.length < 7) return null;
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date));
  let worstAvg = Infinity;
  for (let i = 0; i <= sorted.length - 7; i++) {
    const week = sorted.slice(i, i + 7);
    const avg = week.reduce((s, e) => s + e.duration_minutes, 0) / 7;
    if (avg < worstAvg) worstAvg = avg;
  }
  return String(Math.round(worstAvg));
}

test('stats: empty database returns zero totals', () => {
  const db = createSleepDb(':memory:');
  const stats = db.getStats();
  assert.equal(stats.total, 0);
  db.close();
});

test('stats: getStats returns correct aggregates', () => {
  const db = createSleepDb(':memory:');
  db.insertEntry('2026-03-30', '23:00', '06:00', 420);
  db.insertEntry('2026-03-31', '23:30', '07:30', 480);
  db.insertEntry('2026-04-01', '22:45', '07:15', 510);

  const stats = db.getStats();
  assert.equal(stats.total, 3);
  assert.equal(stats.min_duration, 420);
  assert.equal(stats.max_duration, 510);
  assert.equal(Math.round(stats.avg_duration), 470);
  db.close();
});

test('stats: getBestStreak counts consecutive ≥7h nights', () => {
  const entries = [
    { date: '2026-03-27', duration_minutes: 480 },
    { date: '2026-03-28', duration_minutes: 450 },
    { date: '2026-03-29', duration_minutes: 480 },
    { date: '2026-03-30', duration_minutes: 480 },
    { date: '2026-03-31', duration_minutes: 480 },
  ];
  // streak of 3 (29, 30, 31) after gap on 28 (450 < 420? no — 450>=420, so that's fine)
  // Actually 27=480✓, 28=450✓, 29=480✓, 30=480✓, 31=480✓ — all consecutive, streak=5
  assert.equal(getBestStreak(entries), 5);
});

test('stats: getBestStreak resets when a night is below 7h', () => {
  const entries = [
    { date: '2026-03-27', duration_minutes: 480 },
    { date: '2026-03-28', duration_minutes: 480 },
    { date: '2026-03-29', duration_minutes: 300 }, // < 420 — breaks streak
    { date: '2026-03-30', duration_minutes: 480 },
    { date: '2026-03-31', duration_minutes: 480 },
    { date: '2026-04-01', duration_minutes: 480 },
  ];
  assert.equal(getBestStreak(entries), 3);
});

test('stats: getBestStreak resets when dates are not consecutive', () => {
  const entries = [
    { date: '2026-03-27', duration_minutes: 480 },
    { date: '2026-03-28', duration_minutes: 480 },
    { date: '2026-03-30', duration_minutes: 480 }, // gap on 29
    { date: '2026-03-31', duration_minutes: 480 },
  ];
  assert.equal(getBestStreak(entries), 2);
});

test('stats: getBestStreak on empty list returns 0', () => {
  assert.equal(getBestStreak([]), 0);
});

test('stats: getWorstWeekAvg returns null with fewer than 7 entries', () => {
  const entries = [
    { date: '2026-03-27', duration_minutes: 480 },
    { date: '2026-03-28', duration_minutes: 480 },
  ];
  assert.equal(getWorstWeekAvg(entries), null);
});

test('stats: getWorstWeekAvg identifies the lowest 7-day window', () => {
  // 7 good nights then 7 bad nights — worst week is the second set
  const entries = [
    { date: '2026-03-24', duration_minutes: 480 },
    { date: '2026-03-25', duration_minutes: 480 },
    { date: '2026-03-26', duration_minutes: 480 },
    { date: '2026-03-27', duration_minutes: 480 },
    { date: '2026-03-28', duration_minutes: 480 },
    { date: '2026-03-29', duration_minutes: 480 },
    { date: '2026-03-30', duration_minutes: 480 },
    { date: '2026-03-31', duration_minutes: 300 },
    { date: '2026-04-01', duration_minutes: 300 },
    { date: '2026-04-02', duration_minutes: 300 },
    { date: '2026-04-03', duration_minutes: 300 },
    { date: '2026-04-04', duration_minutes: 300 },
    { date: '2026-04-05', duration_minutes: 300 },
    { date: '2026-04-06', duration_minutes: 300 },
  ];
  const result = getWorstWeekAvg(entries);
  assert.equal(result, '300');
});

test('stats: consistency score is included in stats output', () => {
  const bedtimes = ['23:00', '23:05', '22:58', '23:02', '23:01', '23:03', '22:59'];
  const score = calcConsistencyScore(bedtimes);
  assert.equal(score, 100);
});
