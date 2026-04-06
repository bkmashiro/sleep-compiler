import assert from 'node:assert/strict';
import test from 'node:test';

import { createSleepDb } from '../../src/db.js';
import { calcDurationMinutes } from '../../src/utils.js';
import { formatDuration, getQualityLabel } from '../../src/formatter.js';

test('log: valid sleep/wake times produce the correct duration and entry', () => {
  const db = createSleepDb(':memory:');
  db.insertEntry('2026-04-01', '23:00', '07:00', calcDurationMinutes('23:00', '07:00'), 'solid night');
  const entries = db.getAllEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].date, '2026-04-01');
  assert.equal(entries[0].sleep_time, '23:00');
  assert.equal(entries[0].wake_time, '07:00');
  assert.equal(entries[0].duration_minutes, 480);
  assert.equal(entries[0].note, 'solid night');
  db.close();
});

test('log: cross-midnight duration is calculated correctly', () => {
  const duration = calcDurationMinutes('23:45', '06:15');
  assert.equal(duration, 390);
});

test('log: entry without note stores null', () => {
  const db = createSleepDb(':memory:');
  db.insertEntry('2026-04-01', '22:30', '06:30', calcDurationMinutes('22:30', '06:30'));
  const [entry] = db.getAllEntries();
  assert.equal(entry.note, null);
  db.close();
});

test('log: duplicate date throws a unique-constraint error', () => {
  const db = createSleepDb(':memory:');
  db.insertEntry('2026-04-01', '23:00', '07:00', 480);
  assert.throws(
    () => db.insertEntry('2026-04-01', '22:00', '06:00', 480),
    /UNIQUE constraint failed/
  );
  db.close();
});

test('log: invalid time format throws', () => {
  assert.throws(() => calcDurationMinutes('bad', '07:00'), /Invalid time format/);
  assert.throws(() => calcDurationMinutes('23:00', 'bad'), /Invalid time format/);
});

test('log: out-of-range time values throw', () => {
  assert.throws(() => calcDurationMinutes('25:00', '07:00'), /Invalid time/);
  assert.throws(() => calcDurationMinutes('23:00', '07:60'), /Invalid time/);
});

test('log: formatDuration renders hours and minutes correctly', () => {
  assert.equal(formatDuration(480), '8h 00m');
  assert.equal(formatDuration(465), '7h 45m');
  assert.equal(formatDuration(390), '6h 30m');
});

test('log: getQualityLabel returns the expected label for each tier', () => {
  // Strip ANSI escape codes for assertion
  const strip = (s: string) => s.replace(/\x1B\[[0-9;]*m/g, '');
  assert.match(strip(getQualityLabel(300)), /poor/);
  assert.match(strip(getQualityLabel(390)), /short/);
  assert.match(strip(getQualityLabel(480)), /good/);
  assert.match(strip(getQualityLabel(600)), /long/);
});
