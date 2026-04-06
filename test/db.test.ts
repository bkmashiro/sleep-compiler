import test from 'node:test';
import assert from 'node:assert/strict';

import { createSleepDb } from '../src/db.js';
import { calcDurationMinutes } from '../src/utils.js';

test('can insert a sleep log entry', (t) => {
  const db = createSleepDb(':memory:');
  t.after(() => db.close());

  db.insertEntry('2026-04-01', '23:30', '07:15', 465, 'slept well');

  const entries = db.getAllEntries();

  assert.equal(entries.length, 1);
  assert.equal(entries[0].date, '2026-04-01');
  assert.equal(entries[0].sleep_time, '23:30');
  assert.equal(entries[0].wake_time, '07:15');
  assert.equal(entries[0].duration_minutes, 465);
  assert.equal(entries[0].note, 'slept well');
});

test('can retrieve the last N days in descending date order', (t) => {
  const db = createSleepDb(':memory:');
  t.after(() => db.close());

  db.insertEntry('2026-03-29', '23:00', '07:00', 480);
  db.insertEntry('2026-03-30', '23:15', '07:00', 465);
  db.insertEntry('2026-03-31', '23:30', '07:00', 450);
  db.insertEntry('2026-04-01', '23:45', '07:00', 435);

  const entries = db.getEntries(2);

  assert.equal(entries.length, 2);
  assert.deepEqual(
    entries.map((entry) => entry.date),
    ['2026-04-01', '2026-03-31']
  );
});

test('prevents duplicate dates via the unique constraint', (t) => {
  const db = createSleepDb(':memory:');
  t.after(() => db.close());

  db.insertEntry('2026-04-01', '23:00', '07:00', 480);

  assert.throws(
    () => db.insertEntry('2026-04-01', '22:30', '06:30', 480),
    /UNIQUE constraint failed: sleep_log\.date/
  );
});

test('stores the expected duration_minutes value', (t) => {
  const db = createSleepDb(':memory:');
  t.after(() => db.close());

  const duration = calcDurationMinutes('23:59', '00:01');
  db.insertEntry('2026-04-02', '23:59', '00:01', duration);

  const [entry] = db.getAllEntries();

  assert.equal(entry.duration_minutes, 2);
});

test('stores missing notes as null and reports aggregate stats', (t) => {
  const db = createSleepDb(':memory:');
  t.after(() => db.close());

  db.insertEntry('2026-03-30', '23:00', '06:00', 420);
  db.insertEntry('2026-03-31', '23:30', '07:30', 480);
  db.insertEntry('2026-04-01', '22:45', '07:15', 510);

  const entries = db.getAllEntries();
  const stats = db.getStats();

  assert.equal(entries[0].note, null);
  assert.deepEqual(stats, {
    total: 3,
    avg_duration: 470,
    min_duration: 420,
    max_duration: 510,
  });
});

test('upsertEntry overwrites an existing date instead of throwing', (t) => {
  const db = createSleepDb(':memory:');
  t.after(() => db.close());

  db.insertEntry('2026-04-01', '23:00', '07:00', 480, 'original note');
  db.upsertEntry('2026-04-01', '22:30', '06:30', 480, 'updated note');

  const entries = db.getAllEntries();

  assert.equal(entries.length, 1);
  assert.equal(entries[0].sleep_time, '22:30');
  assert.equal(entries[0].wake_time, '06:30');
  assert.equal(entries[0].note, 'updated note');
});

test('upsertEntry clears a note when none is provided', (t) => {
  const db = createSleepDb(':memory:');
  t.after(() => db.close());

  db.insertEntry('2026-04-01', '23:00', '07:00', 480, 'original note');
  db.upsertEntry('2026-04-01', '22:30', '06:30', 480);

  const [entry] = db.getAllEntries();

  assert.equal(entry.note, null);
});

test('getStats returns zero values on an empty database', (t) => {
  const db = createSleepDb(':memory:');
  t.after(() => db.close());

  const stats = db.getStats();

  assert.equal(stats.total, 0);
});

test('close() is idempotent — calling it twice does not throw', () => {
  const db = createSleepDb(':memory:');

  db.close();
  assert.doesNotThrow(() => db.close());
});
