import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { createSleepDb } from '../../src/db.js';

// Inline the pure helpers from quick.ts (they are not exported).
// This lets us test the logic without coupling to the global fs path.

interface PendingSleep {
  time: string;
  date: string;
}

function writePendingSleep(dir: string, pending: PendingSleep): void {
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'pending-sleep.json'), `${JSON.stringify(pending, null, 2)}\n`, 'utf8');
}

function readPendingSleep(dir: string): PendingSleep {
  const raw = readFileSync(join(dir, 'pending-sleep.json'), 'utf8');
  const parsed = JSON.parse(raw) as Partial<PendingSleep>;
  if (typeof parsed.time !== 'string' || typeof parsed.date !== 'string') {
    throw new Error('Pending sleep file is invalid.');
  }
  return { time: parsed.time, date: parsed.date };
}

function deletePendingSleep(dir: string): void {
  const path = join(dir, 'pending-sleep.json');
  if (existsSync(path)) rmSync(path);
}

function minutesBetween(start: Date, end: Date): number {
  return Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000));
}

function buildSleepDateTime(pending: PendingSleep): Date {
  const match = pending.time.match(/^(\d{2}):(\d{2})$/);
  if (!match) throw new Error(`Invalid time: ${pending.time}`);
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const date = new Date(`${pending.date}T00:00:00`);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

test('quick sleep now: writes pending-sleep.json with time and date', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-quick-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const now = new Date('2026-04-06T23:15:00');
  const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const date = now.toISOString().slice(0, 10);

  writePendingSleep(dir, { time, date });

  assert.ok(existsSync(join(dir, 'pending-sleep.json')), 'pending-sleep.json should exist after sleep now');
  const pending = readPendingSleep(dir);
  assert.equal(pending.time, '23:15');
  assert.equal(pending.date, '2026-04-06');
});

test('quick wake now: saves entry to DB and removes pending-sleep.json', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-quick-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  // Simulate "sleep now" at 23:00
  writePendingSleep(dir, { time: '23:00', date: '2026-04-06' });
  assert.ok(existsSync(join(dir, 'pending-sleep.json')));

  // Simulate "wake now" at 07:00 the next day
  const pending = readPendingSleep(dir);
  const wakeTime = '07:00';
  const sleepDt = buildSleepDateTime(pending);
  const wakeDt = new Date('2026-04-07T07:00:00');
  const duration = minutesBetween(sleepDt, wakeDt);

  db.insertEntry(pending.date, pending.time, wakeTime, duration);
  deletePendingSleep(dir);

  // Pending file should be gone
  assert.ok(!existsSync(join(dir, 'pending-sleep.json')), 'pending-sleep.json should be removed after wake now');

  // Entry should be in DB
  const entries = db.getAllEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0].sleep_time, '23:00');
  assert.equal(entries[0].wake_time, '07:00');
  assert.equal(entries[0].duration_minutes, 480);
});

test('quick wake now: duration handles cross-midnight correctly', () => {
  const pending: PendingSleep = { time: '23:30', date: '2026-04-06' };
  const sleepDt = buildSleepDateTime(pending);
  const wakeDt = new Date('2026-04-07T06:00:00');
  const duration = minutesBetween(sleepDt, wakeDt);
  assert.equal(duration, 390); // 6.5h
});

test('quick status: pending file absent means not sleeping', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-quick-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  assert.ok(!existsSync(join(dir, 'pending-sleep.json')));
});

test('quick status: pending file present shows sleep start time', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-quick-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  writePendingSleep(dir, { time: '22:45', date: '2026-04-06' });
  const pending = readPendingSleep(dir);
  assert.equal(pending.time, '22:45');
});

test('quick: minutesBetween returns 0 for identical times', () => {
  const t1 = new Date('2026-04-06T23:00:00');
  assert.equal(minutesBetween(t1, t1), 0);
});

test('quick: minutesBetween returns 0 when end is before start (no negative durations)', () => {
  const start = new Date('2026-04-07T07:00:00');
  const end = new Date('2026-04-06T23:00:00');
  assert.equal(minutesBetween(start, end), 0);
});

test('quick: pending-sleep.json is valid JSON with expected shape', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-quick-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  writePendingSleep(dir, { time: '23:00', date: '2026-04-06' });
  const raw = readFileSync(join(dir, 'pending-sleep.json'), 'utf8');
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  assert.equal(typeof parsed.time, 'string');
  assert.equal(typeof parsed.date, 'string');
});

test('quick: invalid pending-sleep.json throws on read', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-quick-'));
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  writeFileSync(join(dir, 'pending-sleep.json'), '{"time": 123}', 'utf8');
  assert.throws(() => readPendingSleep(dir), /invalid/i);
});
