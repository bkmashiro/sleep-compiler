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

test('calcConsistencyScore returns 100 for identical bedtimes (0 stddev)', () => {
  assert.equal(calcConsistencyScore(['23:00', '23:00', '23:00']), 100);
});

test('calcConsistencyScore returns 100 when stddev is just under 30 min', () => {
  // 23:00 and 23:58 → stddev ≈ 29 min
  assert.equal(calcConsistencyScore(['23:00', '23:58']), 100);
});

test('calcConsistencyScore returns 80 when stddev is between 30 and 44 min', () => {
  // 22:30 and 00:00 → spread of 90 min, stddev = 45 min exactly… use 22:31/00:00
  // 22:00 and 00:00 → stddev = 60 min. Use values whose stddev is ~37 min.
  // 23:00 and 00:14 → spread 74 min, stddev = 37 min
  assert.equal(calcConsistencyScore(['23:00', '00:14']), 80);
});

test('calcConsistencyScore returns 60 when stddev is between 45 and 59 min', () => {
  // 22:45 and 00:15 → spread 90 min, stddev = 45 min
  assert.equal(calcConsistencyScore(['22:45', '00:15']), 60);
});

test('calcConsistencyScore returns 40 when stddev is 60 min or more', () => {
  // 22:00 and 00:00 → spread 120 min, stddev = 60 min
  assert.equal(calcConsistencyScore(['22:00', '00:00']), 40);
});

test('calcConsistencyScore handles post-midnight times without treating them as early-morning', () => {
  // 23:30 and 00:30 are 60 min apart — should NOT score as 22-hour gap
  // stddev should be 30 min exactly → boundary: returns 80, not 100
  assert.equal(calcConsistencyScore(['23:30', '00:30']), 80);
});

test('calcDurationMinutes handles next-day wake correctly', () => {
  assert.equal(calcDurationMinutes('23:00', '07:00'), 480);
});

test('calcDurationMinutes handles same-day wake (sleep and wake same hour)', () => {
  // edge: wake is 1 min after sleep within the same hour
  assert.equal(calcDurationMinutes('07:00', '07:01'), 1);
});
