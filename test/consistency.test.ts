import test from 'node:test';
import assert from 'node:assert/strict';

import { calcConsistencyScore } from '../src/utils.js';
import { analyzeSleepEntries } from '../src/insight.js';
import type { SleepEntry } from '../src/db.js';

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

// Post-midnight bedtimes must be treated as the same night as pre-midnight ones,
// not as a huge shift forward. With the noon threshold, 00:30 → 24h+30min,
// keeping it adjacent to 23:xx times.
test('treats post-midnight bedtimes as the same night as pre-midnight bedtimes', () => {
  // 23:50 and 00:10 are only 20 min apart — should score 100
  assert.equal(calcConsistencyScore(['23:50', '00:10', '23:55']), 100);
});

test('treats 00:00 as immediately after 23:59, not 24 hours earlier', () => {
  // All times cluster around midnight — variance should be tiny
  assert.equal(calcConsistencyScore(['23:45', '00:00', '00:15', '23:50']), 100);
});

// The noon threshold means anything from 12:00–23:59 stays as-is, and
// 00:00–11:59 gets +24h. A bedtime of 11:59 is treated as next-day,
// far from an 18:00 or 23:00 anchor — verify it doesn't collapse with evening times.
test('does not conflate late-morning times with evening bedtimes', () => {
  // 11:00 (normalized to 35h) mixed with 23:00 (23h) is a ~12h spread → score 40
  assert.equal(calcConsistencyScore(['23:00', '11:00']), 40);
});

// Parity: calcConsistencyScore (utils) and analyzeSleepEntries (insight) must
// produce the same bedtime variance for the same inputs.
test('utils and insight produce the same bedtime variance for post-midnight sleepers', () => {
  const bedtimes = ['00:30', '00:45', '00:20', '00:35', '01:00'];

  const utilsScore = calcConsistencyScore(bedtimes);

  const makeEntry = (date: string, sleep_time: string): SleepEntry => ({
    id: 1,
    date,
    sleep_time,
    wake_time: '08:00',
    duration_minutes: 450,
    note: null,
    created_at: '',
  });

  const entries = bedtimes.map((t, i) => {
    const day = String(i + 1).padStart(2, '0');
    return makeEntry(`2026-01-${day}`, t);
  });

  const insight = analyzeSleepEntries(entries);

  // Both modules normalize post-midnight times with the noon threshold.
  // insight.bedtimeVarianceMinutes is the stddev of the normalized bedtimes.
  // calcConsistencyScore uses the same stddev buckets — verify the variance
  // falls in the same bucket as the utils score implies.
  const insightScore =
    insight.bedtimeVarianceMinutes < 30 ? 100
    : insight.bedtimeVarianceMinutes < 45 ? 80
    : insight.bedtimeVarianceMinutes < 60 ? 60
    : 40;

  assert.equal(insightScore, utilsScore);
});

test('utils and insight produce the same bedtime variance for overnight sleepers spanning midnight', () => {
  const bedtimes = ['23:00', '23:30', '00:00', '23:45', '00:15'];

  const utilsScore = calcConsistencyScore(bedtimes);

  const makeEntry = (date: string, sleep_time: string): SleepEntry => ({
    id: 1,
    date,
    sleep_time,
    wake_time: '07:30',
    duration_minutes: 480,
    note: null,
    created_at: '',
  });

  const entries = bedtimes.map((t, i) => {
    const day = String(i + 1).padStart(2, '0');
    return makeEntry(`2026-02-${day}`, t);
  });

  const insight = analyzeSleepEntries(entries);

  const insightScore =
    insight.bedtimeVarianceMinutes < 30 ? 100
    : insight.bedtimeVarianceMinutes < 45 ? 80
    : insight.bedtimeVarianceMinutes < 60 ? 60
    : 40;

  assert.equal(insightScore, utilsScore);
});
