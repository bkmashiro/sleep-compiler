import test from 'node:test';
import assert from 'node:assert/strict';

import { calcConsistencyScore, calcDurationMinutes, normalizeBedtime, parseTime } from '../src/utils.js';

test('parseTime accepts single-digit hours', () => {
  assert.deepEqual(parseTime('7:05'), { hours: 7, minutes: 5 });
});

test('parseTime accepts two-digit hours', () => {
  assert.deepEqual(parseTime('23:59'), { hours: 23, minutes: 59 });
});

test('parseTime accepts midnight', () => {
  assert.deepEqual(parseTime('0:00'), { hours: 0, minutes: 0 });
});

test('parseTime rejects malformed timestamps', () => {
  assert.throws(() => parseTime('7pm'), /Invalid time format: 7pm\. Use HH:MM/);
});

test('parseTime rejects missing leading zero on minutes', () => {
  assert.throws(() => parseTime('7:5'), /Invalid time format/);
});

test('parseTime rejects out-of-range hours', () => {
  assert.throws(() => parseTime('24:00'), /Invalid time: 24:00/);
});

test('parseTime rejects hours above 23', () => {
  assert.throws(() => parseTime('25:00'), /Invalid time: 25:00/);
});

test('parseTime rejects minutes above 59', () => {
  assert.throws(() => parseTime('12:60'), /Invalid time: 12:60/);
});

test('parseTime rejects non-numeric input', () => {
  assert.throws(() => parseTime('abc'), /Invalid time format: abc\. Use HH:MM/);
});

test('parseTime rejects empty string', () => {
  assert.throws(() => parseTime(''), /Invalid time format: \. Use HH:MM/);
});

test('calcDurationMinutes treats equal sleep and wake times as overnight sleep', () => {
  assert.equal(calcDurationMinutes('08:00', '08:00'), 24 * 60);
});

test('parseTime accepts two-digit hours', () => {
  assert.deepEqual(parseTime('23:59'), { hours: 23, minutes: 59 });
});

test('parseTime rejects minutes out of range', () => {
  assert.throws(() => parseTime('10:60'), /Invalid time: 10:60/);
});

test('normalizeBedtime leaves evening bedtimes (>=12:00) unchanged', () => {
  // 23:00 = 1380 min — should stay at 1380 (no wrap)
  assert.equal(normalizeBedtime('23:00'), 23 * 60);
});

test('normalizeBedtime wraps post-midnight bedtimes (<12:00) by +24h', () => {
  // 01:30 = 90 min — should become 90 + 1440 = 1530
  assert.equal(normalizeBedtime('01:30'), 90 + 24 * 60);
});

test('normalizeBedtime treats exactly noon (12:00) as evening (no wrap)', () => {
  assert.equal(normalizeBedtime('12:00'), 12 * 60);
});

test('normalizeBedtime places post-midnight bedtime after same-night evening bedtime', () => {
  // 00:30 (wrapped) must be greater than 23:00 (not wrapped) so ordering is correct
  assert.ok(normalizeBedtime('00:30') > normalizeBedtime('23:00'));
test('normalizeBedtime keeps afternoon times as-is (15:00 is not next-day)', () => {
  assert.equal(normalizeBedtime('15:00'), 15 * 60);
});

test('normalizeBedtime wraps midnight times to next-day', () => {
  assert.equal(normalizeBedtime('00:30'), 24 * 60 + 30);
});

test('normalizeBedtime wraps early-morning times to next-day', () => {
  assert.equal(normalizeBedtime('02:00'), 24 * 60 + 2 * 60);
});

test('normalizeBedtime treats exactly 12:00 as same-day', () => {
  assert.equal(normalizeBedtime('12:00'), 12 * 60);
});

test('normalizeBedtime treats 11:59 as next-day', () => {
  assert.equal(normalizeBedtime('11:59'), 24 * 60 + 11 * 60 + 59);
});

test('normalizeBedtime treats late-night times as same-day', () => {
  assert.equal(normalizeBedtime('23:30'), 23 * 60 + 30);
});

test('calcConsistencyScore returns 100 with fewer than two bedtimes', () => {
  assert.equal(calcConsistencyScore(['23:15']), 100);
});

// normalizeBedtime: times before 12:00 are treated as early-morning (next day)
test('normalizeBedtime wraps early-morning times past midnight', () => {
  // 01:30 should be treated as 25:30 (next day), i.e. 1*60+30 + 24*60
  assert.equal(normalizeBedtime('01:30'), 1 * 60 + 30 + 24 * 60);
});

test('normalizeBedtime leaves evening times unchanged', () => {
  // 23:00 is clearly a bedtime, no wrapping needed
  assert.equal(normalizeBedtime('23:00'), 23 * 60);
});

test('normalizeBedtime treats exactly 12:00 as afternoon, no wrap', () => {
  // 12:00 is at the boundary — should NOT wrap (noon is not an overnight bedtime)
  assert.equal(normalizeBedtime('12:00'), 12 * 60);
});

test('normalizeBedtime treats 11:59 as early-morning wrap', () => {
  // 11:59 is just before the cutoff — should wrap
  assert.equal(normalizeBedtime('11:59'), 11 * 60 + 59 + 24 * 60);
});

test('calcConsistencyScore uses 12:00 threshold so noon-to-6pm bedtimes wrap correctly', () => {
  // Two bedtimes straddling midnight: 23:00 and 01:00
  // With 12:00 threshold both normalize correctly (01:00 → 25:00), stddev ~60 → score 40
  const score = calcConsistencyScore(['23:00', '01:00']);
  assert.equal(score, 40);
});
