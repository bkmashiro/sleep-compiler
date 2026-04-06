import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, existsSync, readFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { rmSync } from 'fs';

import {
  formatTime,
  formatDate,
  parseTime,
  getPendingSleepDateTime,
  readPendingSleep,
  writePendingSleep,
  minutesBetween,
} from '../src/commands/quick.js';
import { createSleepDb } from '../src/db.js';

// ---------------------------------------------------------------------------
// formatTime / formatDate
// ---------------------------------------------------------------------------

test('formatTime returns HH:mm padded', () => {
  const date = new Date('2026-04-06T03:05:00');
  assert.equal(formatTime(date), '03:05');
});

test('formatDate returns yyyy-MM-dd', () => {
  const date = new Date('2026-04-06T23:30:00');
  assert.equal(formatDate(date), '2026-04-06');
});

// ---------------------------------------------------------------------------
// parseTime
// ---------------------------------------------------------------------------

test('parseTime parses a valid time', () => {
  assert.deepEqual(parseTime('23:30'), { hours: 23, minutes: 30 });
});

test('parseTime parses midnight', () => {
  assert.deepEqual(parseTime('00:00'), { hours: 0, minutes: 0 });
});

test('parseTime rejects non-HH:MM format', () => {
  assert.throws(
    () => parseTime('9:5'),
    /Invalid time format in pending sleep file: 9:5/
  );
});

test('parseTime rejects hours > 23', () => {
  assert.throws(
    () => parseTime('24:00'),
    /Invalid time in pending sleep file: 24:00/
  );
});

test('parseTime rejects minutes > 59', () => {
  assert.throws(
    () => parseTime('12:60'),
    /Invalid time in pending sleep file: 12:60/
  );
});

// ---------------------------------------------------------------------------
// minutesBetween
// ---------------------------------------------------------------------------

test('minutesBetween calculates positive duration', () => {
  const start = new Date('2026-04-06T23:00:00');
  const end = new Date('2026-04-07T07:30:00');
  assert.equal(minutesBetween(start, end), 510);
});

test('minutesBetween clamps to zero when end is before start', () => {
  const start = new Date('2026-04-07T08:00:00');
  const end = new Date('2026-04-07T07:00:00');
  assert.equal(minutesBetween(start, end), 0);
});

// ---------------------------------------------------------------------------
// getPendingSleepDateTime
// ---------------------------------------------------------------------------

test('getPendingSleepDateTime builds the correct Date', () => {
  const pending = { date: '2026-04-06', time: '23:30' };
  const result = getPendingSleepDateTime(pending);
  assert.equal(result.getFullYear(), 2026);
  assert.equal(result.getMonth(), 3); // April = 3 (0-indexed)
  assert.equal(result.getDate(), 6);
  assert.equal(result.getHours(), 23);
  assert.equal(result.getMinutes(), 30);
});

// ---------------------------------------------------------------------------
// writePendingSleep / readPendingSleep — hermetic file I/O
// ---------------------------------------------------------------------------

test('writePendingSleep writes a valid JSON file with correct fields', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-test-'));
  t.after(() => rmSync(dir, { recursive: true }));

  const pendingPath = join(dir, 'pending-sleep.json');
  const now = new Date('2026-04-06T23:30:00');
  const pending = { time: formatTime(now), date: formatDate(now) };

  writePendingSleep(pending, pendingPath);

  assert.ok(existsSync(pendingPath), 'pending file should exist after write');

  const raw = readFileSync(pendingPath, 'utf8');
  const parsed = JSON.parse(raw) as { time: string; date: string };

  assert.equal(parsed.time, '23:30');
  assert.equal(parsed.date, '2026-04-06');
});

test('writePendingSleep produces valid JSON (re-parseable)', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-test-'));
  t.after(() => rmSync(dir, { recursive: true }));

  const pendingPath = join(dir, 'pending-sleep.json');
  writePendingSleep({ time: '00:01', date: '2026-01-01' }, pendingPath);

  assert.doesNotThrow(() => JSON.parse(readFileSync(pendingPath, 'utf8')));
});

// ---------------------------------------------------------------------------
// readPendingSleep
// ---------------------------------------------------------------------------

test('readPendingSleep returns parsed fields from a valid file', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-test-'));
  t.after(() => rmSync(dir, { recursive: true }));

  const pendingPath = join(dir, 'pending-sleep.json');
  writeFileSync(pendingPath, JSON.stringify({ time: '22:45', date: '2026-04-05' }) + '\n', 'utf8');

  const result = readPendingSleep(pendingPath);
  assert.equal(result.time, '22:45');
  assert.equal(result.date, '2026-04-05');
});

test('readPendingSleep throws when no file exists', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-test-'));
  t.after(() => rmSync(dir, { recursive: true }));

  const pendingPath = join(dir, 'pending-sleep.json');

  assert.throws(
    () => readPendingSleep(pendingPath),
    /No pending sleep found/
  );
});

test('readPendingSleep throws a useful error on invalid JSON — not an unhandled exception', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-test-'));
  t.after(() => rmSync(dir, { recursive: true }));

  const pendingPath = join(dir, 'pending-sleep.json');
  writeFileSync(pendingPath, '{ this is not valid json }', 'utf8');

  // JSON.parse throws SyntaxError — confirm it propagates as a thrown error,
  // not as an unhandled rejection or process crash.
  assert.throws(
    () => readPendingSleep(pendingPath),
    (err: unknown) => err instanceof SyntaxError
  );
});

test('readPendingSleep throws when time field is missing', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-test-'));
  t.after(() => rmSync(dir, { recursive: true }));

  const pendingPath = join(dir, 'pending-sleep.json');
  writeFileSync(pendingPath, JSON.stringify({ date: '2026-04-05' }), 'utf8');

  assert.throws(
    () => readPendingSleep(pendingPath),
    /Pending sleep file is invalid/
  );
});

test('readPendingSleep throws when date field is missing', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-test-'));
  t.after(() => rmSync(dir, { recursive: true }));

  const pendingPath = join(dir, 'pending-sleep.json');
  writeFileSync(pendingPath, JSON.stringify({ time: '23:00' }), 'utf8');

  assert.throws(
    () => readPendingSleep(pendingPath),
    /Pending sleep file is invalid/
  );
});

// ---------------------------------------------------------------------------
// wake now: reads pending file, inserts into DB, deletes file
// ---------------------------------------------------------------------------

test('wake now flow: reads pending, inserts entry, and removes pending file', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-test-'));
  const db = createSleepDb(':memory:');
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true });
  });

  const pendingPath = join(dir, 'pending-sleep.json');
  const sleepDate = '2026-04-05';
  const sleepTime = '23:00';
  writeFileSync(pendingPath, JSON.stringify({ time: sleepTime, date: sleepDate }) + '\n', 'utf8');

  const pending = readPendingSleep(pendingPath);
  const now = new Date('2026-04-06T07:00:00');
  const duration = minutesBetween(getPendingSleepDateTime(pending), now);
  const wakeTime = formatTime(now);

  db.insertEntry(pending.date, pending.time, wakeTime, duration);

  // simulate deletePendingSleep
  rmSync(pendingPath);

  const entries = db.getAllEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].date, sleepDate);
  assert.equal(entries[0].sleep_time, sleepTime);
  assert.equal(entries[0].wake_time, '07:00');
  assert.equal(entries[0].duration_minutes, 480);

  assert.ok(!existsSync(pendingPath), 'pending file should be deleted after wake');
});

// ---------------------------------------------------------------------------
// sleep status: elapsed time parsing
// ---------------------------------------------------------------------------

test('sleep status correctly calculates elapsed time from pending sleep', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-test-'));
  t.after(() => rmSync(dir, { recursive: true }));

  const pendingPath = join(dir, 'pending-sleep.json');
  // Slept at 23:00 on 2026-04-05; simulate "now" being 2026-04-06T07:00:00
  writeFileSync(pendingPath, JSON.stringify({ time: '23:00', date: '2026-04-05' }) + '\n', 'utf8');

  const pending = readPendingSleep(pendingPath);
  const simulatedNow = new Date('2026-04-06T07:00:00');
  const elapsed = minutesBetween(getPendingSleepDateTime(pending), simulatedNow);

  assert.equal(elapsed, 480); // 8 hours
});

test('sleep status elapsed rounds fractional minutes', () => {
  // 30 seconds past a minute boundary — should round to 1 minute
  const start = new Date('2026-04-06T00:00:00');
  const end = new Date('2026-04-06T00:01:30');
  assert.equal(minutesBetween(start, end), 2); // 90s rounds to 2 min
});
