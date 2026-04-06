import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { createSleepDb } from '../../src/db.js';
import { getGoalHours, getGoalSummary, setGoalHours } from '../../src/goal.js';

test('goal set: persists a valid goal and can be retrieved', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-cmd-'));
  const configPath = join(dir, 'config.json');
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  setGoalHours(8, configPath);
  assert.equal(getGoalHours(configPath), 8);
});

test('goal set: overwrites a previously set goal', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-cmd-'));
  const configPath = join(dir, 'config.json');
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  setGoalHours(7, configPath);
  setGoalHours(9, configPath);
  assert.equal(getGoalHours(configPath), 9);
});

test('goal set: throws for zero hours', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-cmd-'));
  const configPath = join(dir, 'config.json');
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  assert.throws(() => setGoalHours(0, configPath), /positive number/);
});

test('goal set: throws for negative hours', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-cmd-'));
  const configPath = join(dir, 'config.json');
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  assert.throws(() => setGoalHours(-1, configPath), /positive number/);
});

test('goal set: throws for non-finite values', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-cmd-'));
  const configPath = join(dir, 'config.json');
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  assert.throws(() => setGoalHours(Infinity, configPath), /positive number/);
  assert.throws(() => setGoalHours(NaN, configPath), /positive number/);
});

test('goal status: returns null when no goal has been set', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-cmd-'));
  const configPath = join(dir, 'config.json');
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  assert.equal(getGoalHours(configPath), null);
});

test('goal status: getGoalSummary with no entries has all-zero hours and 0% hit rate', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-cmd-'));
  const dbPath = join(dir, 'sleep.db');
  t.after(() => rmSync(dir, { recursive: true, force: true }));

  const now = new Date('2026-04-06T12:00:00Z');
  const summary = getGoalSummary(8, { dbPath, now });

  assert.equal(summary.goalHours, 8);
  assert.equal(summary.totalDays, 7);
  assert.equal(summary.hitCount, 0);
  assert.equal(summary.hitRate, 0);
  assert.ok(summary.days.every((d) => d.hours === 0), 'all days should have 0h when DB is empty');
  assert.ok(summary.days.every((d) => d.status === 'miss'), 'all days should be miss when DB is empty');
});

test('goal status: getGoalSummary counts hit/near/miss correctly', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-cmd-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const now = new Date('2026-04-06T12:00:00Z');
  // last 7 days: 2026-03-31 to 2026-04-06
  db.insertEntry('2026-03-31', '23:00', '07:30', 510); // hit (8.5h >= 8h)
  db.insertEntry('2026-04-01', '23:30', '07:00', 450); // near (7.5h, 30min under)
  db.insertEntry('2026-04-02', '00:00', '05:00', 300); // miss (5h, >30min under)
  // remaining 4 days have no entries → miss

  const summary = getGoalSummary(8, { dbPath, now });

  const statusByDate = new Map(summary.days.map((d) => [d.date, d.status]));
  assert.equal(statusByDate.get('2026-03-31'), 'hit');
  assert.equal(statusByDate.get('2026-04-01'), 'near');
  assert.equal(statusByDate.get('2026-04-02'), 'miss');
  assert.equal(summary.hitCount, 1);
});

test('goal status: getGoalSummary weeklyAverage rounds to 1 decimal', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-cmd-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);
  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const now = new Date('2026-04-06T12:00:00Z');
  db.insertEntry('2026-03-31', '23:00', '07:00', 480); // 8h
  db.insertEntry('2026-04-01', '23:00', '06:00', 420); // 7h
  // remaining 5 days: 0h each → weekly total = 15h over 7 days ≈ 2.1h

  const summary = getGoalSummary(8, { dbPath, now });
  assert.equal(summary.weeklyAverage, 2.1);
});
