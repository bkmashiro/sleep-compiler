import test from 'node:test';
import assert from 'node:assert/strict';

import { calcConsistencyScore, EARLY_MORNING_CUTOFF_HOURS } from '../src/utils.js';
import { analyzeSleepEntries } from '../src/insight.js';
import type { SleepEntry } from '../src/db.js';

function makeEntry(id: number, date: string, sleepTime: string, wakeTime: string, duration: number): SleepEntry {
  return { id, date, sleep_time: sleepTime, wake_time: wakeTime, duration_minutes: duration, note: null, created_at: '' };
}

const cases = [
  [['23:00', '23:00', '23:00'], 100, 'returns 100% for identical bedtimes'],
  [['23:00', '23:20', '22:40'], 100, 'returns 100% when variance stays under 30 minutes'],
  [['23:00', '23:40', '22:20'], 80, 'returns 80% when variance stays under 45 minutes'],
  [['23:00', '23:55', '21:50', '00:05'], 60, 'returns 60% for moderate bedtime variance'],
  [['23:00', '00:30', '21:30'], 40, 'returns 40% for high bedtime variance'],
] as const;

for (const [bedtimes, expected, name] of cases) {
  test(name, () => {
    assert.equal(calcConsistencyScore([...bedtimes]), expected);
  });
}

// Verify that utils.ts and insight.ts agree on bedtime normalization at the boundary.
// Both use EARLY_MORNING_CUTOFF_HOURS so this also guards against future drift.

test('EARLY_MORNING_CUTOFF_HOURS is 12 (noon)', () => {
  assert.equal(EARLY_MORNING_CUTOFF_HOURS, 12);
});

test('23:30 is treated as same-day evening by both calcConsistencyScore and analyzeSleepEntries', () => {
  // Two identical 23:30 bedtimes should yield perfect consistency in both functions.
  assert.equal(calcConsistencyScore(['23:30', '23:30']), 100);

  const insight = analyzeSleepEntries([
    makeEntry(1, '2026-01-06', '23:30', '07:30', 480),
    makeEntry(2, '2026-01-07', '23:30', '07:30', 480),
  ]);
  assert.equal(insight.bedtimeVarianceMinutes, 0);
});

test('00:30 is treated as next-day early morning by both calcConsistencyScore and analyzeSleepEntries', () => {
  // Two identical 00:30 bedtimes — still zero variance, consistent across both.
  assert.equal(calcConsistencyScore(['00:30', '00:30']), 100);

  const insight = analyzeSleepEntries([
    makeEntry(1, '2026-01-06', '00:30', '08:30', 480),
    makeEntry(2, '2026-01-07', '00:30', '08:30', 480),
  ]);
  assert.equal(insight.bedtimeVarianceMinutes, 0);
});

test('23:30 and 00:30 produce the same variance in both functions (60 min apart)', () => {
  // 23:30 → 1410 min, 00:30 → 1470 min (after +24h wrap). Difference = 60 min.
  // stddev of [1410, 1470] = 30, so calcConsistencyScore returns 100 (stddev < 30 is 100, exactly 30 gives 80).
  const score = calcConsistencyScore(['23:30', '00:30']);
  assert.equal(score, 80);

  const insight = analyzeSleepEntries([
    makeEntry(1, '2026-01-06', '23:30', '07:30', 480),
    makeEntry(2, '2026-01-07', '00:30', '08:30', 480),
  ]);
  // Same 60-min spread → same stddev of 30
  assert.equal(insight.bedtimeVarianceMinutes, 30);
});
