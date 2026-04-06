import test from 'node:test';
import assert from 'node:assert/strict';

import { calcConsistencyScore, calcDurationMinutes, normalizeBedtime, parseTime } from '../src/utils.js';

test('parseTime accepts single-digit hours', () => {
  assert.deepEqual(parseTime('7:05'), { hours: 7, minutes: 5 });
});

test('parseTime rejects malformed timestamps', () => {
  assert.throws(() => parseTime('7pm'), /Invalid time format: 7pm\. Use HH:MM/);
});

test('parseTime rejects out-of-range times', () => {
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
});

test('calcConsistencyScore returns 100 with fewer than two bedtimes', () => {
  assert.equal(calcConsistencyScore(['23:15']), 100);
});

test('normalizeBedtime returns minutes unchanged for times at or after 18:00', () => {
  assert.equal(normalizeBedtime('18:00'), 18 * 60);
  assert.equal(normalizeBedtime('23:30'), 23 * 60 + 30);
});

test('normalizeBedtime wraps early-morning times past midnight by adding 24h', () => {
  assert.equal(normalizeBedtime('00:00'), 24 * 60);
  assert.equal(normalizeBedtime('01:30'), 24 * 60 + 90);
});

test('normalizeBedtime treats 17:59 (before threshold) as next-day time', () => {
  assert.equal(normalizeBedtime('17:59'), 17 * 60 + 59 + 24 * 60);
});

test('calcConsistencyScore is unaffected by bedtimes that span midnight', () => {
  // Both times are post-midnight: normalization should keep them close together
  const score = calcConsistencyScore(['00:00', '00:30', '23:45']);
  assert.ok(score >= 80, `expected score >= 80 but got ${score}`);
});
