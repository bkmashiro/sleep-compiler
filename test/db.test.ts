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

test('insertEntry throws a friendly error on duplicate date', (t) => {
  const db = createSleepDb(':memory:');
  t.after(() => db.close());

  db.insertEntry('2026-04-01', '23:00', '07:00', 480);

  assert.throws(
    () => db.insertEntry('2026-04-01', '22:30', '06:30', 480),
    /Failed to save sleep entry: duplicate date 2026-04-01/
  );
});

test('insertEntry error message does not expose raw SQLite internals', (t) => {
  const db = createSleepDb(':memory:');
  t.after(() => db.close());

  db.insertEntry('2026-04-01', '23:00', '07:00', 480);

  assert.throws(
    () => db.insertEntry('2026-04-01', '22:30', '06:30', 480),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.ok(!error.message.includes('UNIQUE constraint failed'), 'raw SQLite error should not be exposed');
      return true;
    }
  );
});

test('upsertEntry succeeds on duplicate date (no throw)', (t) => {
  const db = createSleepDb(':memory:');
  t.after(() => db.close());

  db.insertEntry('2026-04-01', '23:00', '07:00', 480);
  db.upsertEntry('2026-04-01', '22:30', '06:30', 480);

  const entries = db.getAllEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].sleep_time, '22:30');
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
