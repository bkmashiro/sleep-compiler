import assert from 'node:assert/strict';
import test from 'node:test';

import { createSleepDb } from '../../src/db.js';
import { calcConsistencyScore } from '../../src/utils.js';
import { formatDuration } from '../../src/formatter.js';

test('report: getEntries returns the last N entries in descending date order', () => {
  const db = createSleepDb(':memory:');
  db.insertEntry('2026-03-28', '23:00', '07:00', 480);
  db.insertEntry('2026-03-29', '23:30', '07:00', 450);
  db.insertEntry('2026-03-30', '00:00', '07:30', 450);
  db.insertEntry('2026-03-31', '23:15', '07:15', 480);
  db.insertEntry('2026-04-01', '23:45', '07:45', 480);

  const entries = db.getEntries(3);
  assert.equal(entries.length, 3);
  assert.deepEqual(
    entries.map((e) => e.date),
    ['2026-04-01', '2026-03-31', '2026-03-30']
  );
  db.close();
});

test('report: empty database returns no entries', () => {
  const db = createSleepDb(':memory:');
  const entries = db.getEntries(7);
  assert.equal(entries.length, 0);
  db.close();
});

test('report: average duration is computed correctly', () => {
  const db = createSleepDb(':memory:');
  db.insertEntry('2026-03-30', '23:00', '06:00', 420);
  db.insertEntry('2026-03-31', '23:00', '07:00', 480);
  db.insertEntry('2026-04-01', '23:00', '08:00', 540);

  const entries = db.getEntries(7);
  const total = entries.reduce((sum, e) => sum + e.duration_minutes, 0);
  const avg = Math.round(total / entries.length);
  assert.equal(avg, 480);
  db.close();
});

test('report: consistency score is 100 when bedtimes are identical', () => {
  const score = calcConsistencyScore(['23:00', '23:00', '23:00', '23:00', '23:00', '23:00', '23:00']);
  assert.equal(score, 100);
});

test('report: consistency score is lower with high bedtime variance', () => {
  // Spread: 22:00, 23:00, 00:00, 01:00, 02:00, 03:00, 04:00 — large variance
  const score = calcConsistencyScore(['22:00', '01:00', '04:00', '22:30', '03:00', '01:30', '23:00']);
  assert.ok(score < 100, `Expected score < 100, got ${score}`);
});

test('report: consistency score returns 100 with fewer than 2 bedtimes', () => {
  assert.equal(calcConsistencyScore([]), 100);
  assert.equal(calcConsistencyScore(['23:00']), 100);
});

test('report: formatDuration renders correctly for report output', () => {
  assert.equal(formatDuration(480), '8h 00m');
  assert.equal(formatDuration(450), '7h 30m');
  assert.equal(formatDuration(421), '7h 01m');
});

test('report: getEntries with days=0 returns empty list', () => {
  const db = createSleepDb(':memory:');
  db.insertEntry('2026-04-01', '23:00', '07:00', 480);
  const entries = db.getEntries(0);
  assert.equal(entries.length, 0);
  db.close();
});
