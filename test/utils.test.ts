import test from 'node:test';
import assert from 'node:assert/strict';

import { calcConsistencyScore, calcDurationMinutes, escapeCsv, parseTime } from '../src/utils.js';

test('parseTime accepts single-digit hours', () => {
  assert.deepEqual(parseTime('7:05'), { hours: 7, minutes: 5 });
});

test('parseTime rejects malformed timestamps', () => {
  assert.throws(() => parseTime('7pm'), /Invalid time format: 7pm\. Use HH:MM/);
});

test('parseTime rejects out-of-range times', () => {
  assert.throws(() => parseTime('24:00'), /Invalid time: 24:00/);
});

test('calcDurationMinutes treats equal sleep and wake times as overnight sleep', () => {
  assert.equal(calcDurationMinutes('08:00', '08:00'), 24 * 60);
});

test('calcConsistencyScore returns 100 with fewer than two bedtimes', () => {
  assert.equal(calcConsistencyScore(['23:15']), 100);
});

test('escapeCsv returns plain values unchanged', () => {
  assert.equal(escapeCsv('hello'), 'hello');
  assert.equal(escapeCsv(42), '42');
});

test('escapeCsv wraps values containing a comma in double quotes', () => {
  assert.equal(escapeCsv('hello, world'), '"hello, world"');
});

test('escapeCsv wraps values containing a double quote and escapes it', () => {
  assert.equal(escapeCsv('say "hi"'), '"say ""hi"""');
});

test('escapeCsv wraps values containing a newline', () => {
  assert.equal(escapeCsv('line1\nline2'), '"line1\nline2"');
});

test('escapeCsv handles empty string', () => {
  assert.equal(escapeCsv(''), '');
});
