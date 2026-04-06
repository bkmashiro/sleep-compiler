import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { createSleepDb } from '../src/db.js';
import { getGoalHours, getGoalSummary, renderGoalStatus, setGoalHours } from '../src/goal.js';

test('getGoalHours returns null when config.json is missing', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-'));
  const configPath = join(dir, 'config.json');

  t.after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  assert.equal(getGoalHours(configPath), null);
});

test('getGoalHours returns null and warns when config.json is malformed', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-'));
  const configPath = join(dir, 'config.json');

  t.after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  writeFileSync(configPath, '{not valid json}', 'utf8');

  const warnings: string[] = [];
  const originalWarn = console.warn;
  console.warn = (...args: unknown[]) => {
    warnings.push(args.join(' '));
  };

  t.after(() => {
    console.warn = originalWarn;
  });

  assert.equal(getGoalHours(configPath), null);
  assert.equal(existsSync(configPath), true, 'malformed file should not be deleted');
  assert.equal(warnings.length, 1);
  assert.match(warnings[0], /malformed/);
});

test('setGoalHours persists goalHours to config.json', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-'));
  const configPath = join(dir, 'config.json');

  t.after(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  setGoalHours(8, configPath);

  assert.equal(getGoalHours(configPath), 8);
  assert.equal(existsSync(configPath), true);
  assert.equal(JSON.parse(readFileSync(configPath, 'utf8')).goalHours, 8);
});

test('getGoalSummary computes status for the last 7 calendar days', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  db.insertEntry('2026-03-27', '23:30', '07:00', 450);
  db.insertEntry('2026-03-28', '23:00', '07:12', 492);
  db.insertEntry('2026-03-29', '00:10', '07:00', 410);
  db.insertEntry('2026-03-30', '23:45', '07:40', 475);
  db.insertEntry('2026-03-31', '00:30', '06:36', 366);
  db.insertEntry('2026-04-01', '23:15', '07:45', 510);
  db.insertEntry('2026-04-02', '23:10', '06:52', 462);

  const summary = getGoalSummary(8, { dbPath, now: new Date('2026-04-02T12:00:00Z') });

  assert.equal(summary.goalHours, 8);
  assert.equal(summary.weeklyAverage, 7.5);
  assert.equal(summary.hitCount, 2);
  assert.equal(summary.hitRate, 29);
  assert.deepEqual(
    summary.days.map((day) => ({ label: day.label, hours: day.hours, status: day.status, deltaHours: day.deltaHours })),
    [
      { label: 'Fri', hours: 7.5, status: 'near', deltaHours: -0.5 },
      { label: 'Sat', hours: 8.2, status: 'hit', deltaHours: 0.2 },
      { label: 'Sun', hours: 6.8, status: 'miss', deltaHours: -1.2 },
      { label: 'Mon', hours: 7.9, status: 'near', deltaHours: -0.1 },
      { label: 'Tue', hours: 6.1, status: 'miss', deltaHours: -1.9 },
      { label: 'Wed', hours: 8.5, status: 'hit', deltaHours: 0.5 },
      { label: 'Thu', hours: 7.7, status: 'near', deltaHours: -0.3 },
    ]
  );
});

test('getGoalSummary returns zero weeklyAverage and hitRate when no days match', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  // after(() => ...) is not available outside test(), so use plain cleanup
  db.insertEntry('2026-04-02', '23:00', '06:59', 8 * 60 - 1); // 479 min → 1 min under 8h

  const summary = getGoalSummary(8, { dbPath, now: new Date('2026-04-02T12:00:00Z') });
  db.close();
  rmSync(dir, { recursive: true, force: true });

  const day = summary.days.find((d) => d.label === 'Thu');
  assert.ok(day, 'Thu entry should exist');
  assert.equal(day.status, 'near');
});

test('getGoalSummary marks a day as miss when 31 minutes under goal', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  db.insertEntry('2026-04-02', '23:00', '06:29', 8 * 60 - 31); // 449 min → 31 min under 8h

  const summary = getGoalSummary(8, { dbPath, now: new Date('2026-04-02T12:00:00Z') });
  db.close();
  rmSync(dir, { recursive: true, force: true });

  const day = summary.days.find((d) => d.label === 'Thu');
  assert.ok(day, 'Thu entry should exist');
  assert.equal(day.status, 'miss');
});

test('getGoalSummary marks a day as hit when exactly on goal', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  db.insertEntry('2026-04-02', '23:00', '07:00', 8 * 60); // exactly 480 min

  const summary = getGoalSummary(8, { dbPath, now: new Date('2026-04-02T12:00:00Z') });
  db.close();
  rmSync(dir, { recursive: true, force: true });

  const day = summary.days.find((d) => d.label === 'Thu');
  assert.ok(day, 'Thu entry should exist');
  assert.equal(day.status, 'hit');
});

test('getGoalSummary marks days with no entry as miss', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);
  // insert nothing
  const summary = getGoalSummary(8, { dbPath, now: new Date('2026-04-02T12:00:00Z') });
  db.close();
  rmSync(dir, { recursive: true, force: true });

  for (const day of summary.days) {
    assert.equal(day.hours, 0);
    assert.equal(day.status, 'miss');
  }
});

test('setGoalHours rejects zero and negative values', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-'));
  const configPath = join(dir, 'config.json');

  assert.throws(() => setGoalHours(0, configPath), /positive/);
  assert.throws(() => setGoalHours(-1, configPath), /positive/);

  rmSync(dir, { recursive: true, force: true });
});

test('renderGoalStatus prints the summary in the expected shape', () => {
  const output = renderGoalStatus({
    goalHours: 8,
    days: [
      { date: '2026-03-27', label: 'Fri', hours: 7.5, deltaHours: -0.5, status: 'near' },
      { date: '2026-03-28', label: 'Sat', hours: 8.2, deltaHours: 0.2, status: 'hit' },
      { date: '2026-03-29', label: 'Sun', hours: 6.8, deltaHours: -1.2, status: 'miss' },
      { date: '2026-03-30', label: 'Mon', hours: 7.9, deltaHours: -0.1, status: 'near' },
      { date: '2026-03-31', label: 'Tue', hours: 6.1, deltaHours: -1.9, status: 'miss' },
      { date: '2026-04-01', label: 'Wed', hours: 8.5, deltaHours: 0.5, status: 'hit' },
      { date: '2026-04-02', label: 'Thu', hours: 7.7, deltaHours: -0.3, status: 'near' },
    ],
    weeklyAverage: 7.5,
    hitCount: 2,
    totalDays: 7,
    hitRate: 29,
  });

  assert.match(output, /Sleep goal: 8h/);
  assert.match(output, /Last 7 days:/);
  assert.match(output, /Fri\s+█{12}\s+7\.5h\s+-0\.5h ⚠/);
  assert.match(output, /Sat\s+█{12}\s+8\.2h\s+\+0\.2h ✅/);
  assert.match(output, /Weekly average: 7\.5h  Goal hit: 2\/7 days \(29%\)/);
});
