import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { createSleepDb } from '../src/db.js';
import {
  recordSleep,
  recordWake,
  readPendingSleep,
  writePendingSleep,
  deletePendingSleep,
  parsePendingTime,
  pendingSleepToDate,
  minutesBetween,
} from '../src/commands/quick.js';

function makeTempDir(t: { after: (fn: () => void) => void }): string {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-quick-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function makeDb(t: { after: (fn: () => void) => void }) {
  const db = createSleepDb(':memory:');
  t.after(() => db.close());
  return db;
}

// ---------------------------------------------------------------------------
// parsePendingTime
// ---------------------------------------------------------------------------

test('parsePendingTime parses a valid HH:MM string', () => {
  assert.deepEqual(parsePendingTime('23:45'), { hours: 23, minutes: 45 });
});

test('parsePendingTime parses midnight correctly', () => {
  assert.deepEqual(parsePendingTime('00:00'), { hours: 0, minutes: 0 });
});

test('parsePendingTime rejects non-padded times', () => {
  assert.throws(() => parsePendingTime('9:05'), /Invalid time format/);
});

test('parsePendingTime rejects hour 24', () => {
  assert.throws(() => parsePendingTime('24:00'), /Invalid time/);
});

test('parsePendingTime rejects minute 60', () => {
  assert.throws(() => parsePendingTime('12:60'), /Invalid time/);
});

// ---------------------------------------------------------------------------
// minutesBetween
// ---------------------------------------------------------------------------

test('minutesBetween returns correct positive difference', () => {
  const start = new Date('2026-04-06T23:00:00');
  const end = new Date('2026-04-07T07:30:00');
  assert.equal(minutesBetween(start, end), 510);
});

test('minutesBetween returns 0 when end is before start (never negative)', () => {
  const start = new Date('2026-04-06T08:00:00');
  const end = new Date('2026-04-06T07:00:00');
  assert.equal(minutesBetween(start, end), 0);
});

test('minutesBetween rounds fractional minutes', () => {
  const start = new Date('2026-04-06T00:00:00');
  const end = new Date('2026-04-06T00:01:29'); // 89s → rounds to 1 min
  assert.equal(minutesBetween(start, end), 1);
});

// ---------------------------------------------------------------------------
// pendingSleepToDate
// ---------------------------------------------------------------------------

test('pendingSleepToDate reconstructs the correct Date', () => {
  const dt = pendingSleepToDate({ date: '2026-04-06', time: '23:30' });
  assert.equal(dt.getHours(), 23);
  assert.equal(dt.getMinutes(), 30);
  assert.equal(dt.getFullYear(), 2026);
  assert.equal(dt.getMonth(), 3); // April = month 3 (0-indexed)
  assert.equal(dt.getDate(), 6);
});

// ---------------------------------------------------------------------------
// writePendingSleep / readPendingSleep / deletePendingSleep
// ---------------------------------------------------------------------------

test('writePendingSleep creates a valid JSON file', (t) => {
  const dir = makeTempDir(t);
  const filePath = join(dir, 'pending-sleep.json');

  writePendingSleep({ date: '2026-04-06', time: '23:00' }, filePath);

  assert.ok(existsSync(filePath));
  const parsed = readPendingSleep(filePath);
  assert.equal(parsed.date, '2026-04-06');
  assert.equal(parsed.time, '23:00');
});

test('readPendingSleep throws when file is absent', (t) => {
  const dir = makeTempDir(t);
  const filePath = join(dir, 'pending-sleep.json');

  assert.throws(() => readPendingSleep(filePath), /No pending sleep found/);
});

test('readPendingSleep throws when file has missing fields', (t) => {
  const dir = makeTempDir(t);
  const filePath = join(dir, 'pending-sleep.json');

  writePendingSleep({ date: '2026-04-06', time: '23:00' }, filePath);
  // Overwrite with partial data (missing `date` field)
  writeFileSync(filePath, JSON.stringify({ time: '23:00' }) + '\n', 'utf8');

  assert.throws(() => readPendingSleep(filePath), /Pending sleep file is invalid/);
});

test('deletePendingSleep removes an existing file', (t) => {
  const dir = makeTempDir(t);
  const filePath = join(dir, 'pending-sleep.json');

  writePendingSleep({ date: '2026-04-06', time: '22:00' }, filePath);
  assert.ok(existsSync(filePath));

  deletePendingSleep(filePath);
  assert.ok(!existsSync(filePath));
});

test('deletePendingSleep is a no-op when file does not exist', (t) => {
  const dir = makeTempDir(t);
  const filePath = join(dir, 'pending-sleep.json');

  assert.doesNotThrow(() => deletePendingSleep(filePath));
});

// ---------------------------------------------------------------------------
// recordSleep
// ---------------------------------------------------------------------------

test('recordSleep writes a pending-sleep.json with correct ISO date and time', (t) => {
  const dir = makeTempDir(t);
  const filePath = join(dir, 'pending-sleep.json');
  const now = new Date('2026-04-06T23:15:00');

  const result = recordSleep(now, filePath);

  assert.equal(result.date, '2026-04-06');
  assert.equal(result.time, '23:15');
  assert.ok(existsSync(filePath));

  const onDisk = readPendingSleep(filePath);
  assert.equal(onDisk.date, '2026-04-06');
  assert.equal(onDisk.time, '23:15');
});

test('recordSleep overwrites a previous pending sleep file', (t) => {
  const dir = makeTempDir(t);
  const filePath = join(dir, 'pending-sleep.json');

  recordSleep(new Date('2026-04-06T22:00:00'), filePath);
  recordSleep(new Date('2026-04-06T23:30:00'), filePath);

  const onDisk = readPendingSleep(filePath);
  assert.equal(onDisk.time, '23:30');
});

// ---------------------------------------------------------------------------
// recordWake
// ---------------------------------------------------------------------------

test('recordWake reads pending sleep, computes duration, inserts to DB, and deletes the file', (t) => {
  const dir = makeTempDir(t);
  const filePath = join(dir, 'pending-sleep.json');
  const db = makeDb(t);

  recordSleep(new Date('2026-04-06T23:00:00'), filePath);

  const wakeAt = new Date('2026-04-07T07:00:00');
  const result = recordWake(wakeAt, filePath, db);

  assert.equal(result.date, '2026-04-06');
  assert.equal(result.sleepTime, '23:00');
  assert.equal(result.wakeTime, '07:00');
  assert.equal(result.durationMinutes, 480);

  const entries = db.getAllEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].date, '2026-04-06');
  assert.equal(entries[0].sleep_time, '23:00');
  assert.equal(entries[0].wake_time, '07:00');
  assert.equal(entries[0].duration_minutes, 480);

  assert.ok(!existsSync(filePath), 'pending-sleep.json should be deleted after wake');
});

test('recordWake throws when there is no pending sleep', (t) => {
  const dir = makeTempDir(t);
  const filePath = join(dir, 'pending-sleep.json');
  const db = makeDb(t);

  assert.throws(
    () => recordWake(new Date(), filePath, db),
    /No pending sleep found/
  );
});

test('recordWake does not insert to DB when pending file is missing', (t) => {
  const dir = makeTempDir(t);
  const filePath = join(dir, 'pending-sleep.json');
  const db = makeDb(t);

  try {
    recordWake(new Date(), filePath, db);
  } catch {
    // expected
  }

  assert.equal(db.getAllEntries().length, 0);
});

test('recordWake handles overnight sleep spanning midnight correctly', (t) => {
  const dir = makeTempDir(t);
  const filePath = join(dir, 'pending-sleep.json');
  const db = makeDb(t);

  // Slept at 23:45 on Apr 5, woke at 07:15 on Apr 6
  recordSleep(new Date('2026-04-05T23:45:00'), filePath);
  const result = recordWake(new Date('2026-04-06T07:15:00'), filePath, db);

  assert.equal(result.date, '2026-04-05');
  assert.equal(result.durationMinutes, 450); // 7h 30m
});
