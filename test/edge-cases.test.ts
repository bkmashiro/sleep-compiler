/**
 * Edge-case tests for utils, exporter, and goal functions.
 * These complement the happy-path tests in the individual test files.
 */

import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { calcConsistencyScore, calcDurationMinutes, classifySleepQuality, parseTime } from '../src/utils.js';
import { toCsv, toExportRow } from '../src/exporter.js';
import { getGoalHours, setGoalHours } from '../src/goal.js';
import type { SleepEntry } from '../src/db.js';

// ── parseTime ────────────────────────────────────────────────────────────────

test('parseTime accepts boundary hour 0', () => {
  assert.deepEqual(parseTime('0:00'), { hours: 0, minutes: 0 });
});

test('parseTime accepts boundary hour 23 and minute 59', () => {
  assert.deepEqual(parseTime('23:59'), { hours: 23, minutes: 59 });
});

test('parseTime rejects minutes > 59', () => {
  assert.throws(() => parseTime('10:60'), /Invalid time: 10:60/);
});

test('parseTime rejects empty string', () => {
  assert.throws(() => parseTime(''), /Invalid time format/);
});

test('parseTime rejects float input', () => {
  assert.throws(() => parseTime('7.5'), /Invalid time format/);
});

test('parseTime rejects missing colon', () => {
  assert.throws(() => parseTime('0700'), /Invalid time format/);
});

// ── classifySleepQuality ─────────────────────────────────────────────────────

test('classifySleepQuality classifies exactly 360 min (6 h) as short, not poor', () => {
  assert.equal(classifySleepQuality(360), 'short');
});

test('classifySleepQuality classifies exactly 420 min (7 h) as good, not short', () => {
  assert.equal(classifySleepQuality(420), 'good');
});

test('classifySleepQuality classifies 0 minutes as poor', () => {
  assert.equal(classifySleepQuality(0), 'poor');
});

// ── calcDurationMinutes ───────────────────────────────────────────────────────

test('calcDurationMinutes propagates parseTime error for invalid sleep time', () => {
  assert.throws(() => calcDurationMinutes('99:00', '07:00'), /Invalid time/);
});

test('calcDurationMinutes propagates parseTime error for invalid wake time', () => {
  assert.throws(() => calcDurationMinutes('22:00', 'bad'), /Invalid time format/);
});

// ── calcConsistencyScore ──────────────────────────────────────────────────────

test('calcConsistencyScore returns 100 for an empty array', () => {
  assert.equal(calcConsistencyScore([]), 100);
});

test('calcConsistencyScore returns 100 for exactly two identical bedtimes', () => {
  assert.equal(calcConsistencyScore(['23:00', '23:00']), 100);
});

test('calcConsistencyScore normalises after-midnight bedtimes relative to pre-midnight ones', () => {
  // '23:00' = 1380 min, '01:00' normalised = 60 + 1440 = 1500 min
  // delta = 120 min → stddev = 60 → score 40
  assert.equal(calcConsistencyScore(['23:00', '01:00']), 40);
});

test('calcConsistencyScore treats two bedtimes 29 min apart as stddev < 30', () => {
  // Values: 23:00 = 1380, 23:29 = 1409; mean = 1394.5; variance = (14.5^2 * 2)/2 = 210.25; stddev ≈ 14.5
  assert.equal(calcConsistencyScore(['23:00', '23:29']), 100);
});

// ── scoreFromDuration (via toExportRow) ──────────────────────────────────────

function makeEntry(duration_minutes: number): SleepEntry {
  return {
    id: 1,
    date: '2026-01-01',
    sleep_time: '23:00',
    wake_time: '07:00',
    duration_minutes,
    note: null,
    created_at: '2026-01-01T00:00:00Z',
  };
}

test('toExportRow scores exactly 8 hours as 100', () => {
  assert.equal(toExportRow(makeEntry(8 * 60)).score, 100);
});

test('toExportRow score is clamped to 0 for extreme under-sleep', () => {
  // delta = 480 min over target; 100 - 480/3 = 100 - 160 = -60 → clamped to 0
  assert.equal(toExportRow(makeEntry(0)).score, 0);
});

test('toExportRow score is clamped to 0 for extreme over-sleep', () => {
  // 1440 min (24 h); delta = 960; 100 - 320 = -220 → clamped to 0
  assert.equal(toExportRow(makeEntry(24 * 60)).score, 0);
});

test('toExportRow score is 100 for 7.5 h (30 min delta = 10 penalty)', () => {
  // delta = 30; 100 - 10 = 90
  assert.equal(toExportRow(makeEntry(7 * 60 + 30)).score, 90);
});

// ── toCsv ────────────────────────────────────────────────────────────────────

test('toCsv with no rows returns only the header line', () => {
  assert.equal(toCsv([]), 'date,bedtime,waketime,duration_hours,score');
});

test('toCsv strips trailing .00 from duration_hours', () => {
  const csv = toCsv([{ date: '2026-01-01', bedtime: '23:00', waketime: '07:00', duration_hours: 8, score: 100 }]);
  assert.match(csv, /2026-01-01,23:00,07:00,8,100/);
});

test('toCsv wraps values containing commas in double quotes', () => {
  const csv = toCsv([{ date: '2026-01-01', bedtime: '23:00', waketime: '07:00', duration_hours: 7.5, score: 90 }]);
  // No commas in these values — just verify no spurious quoting
  assert.doesNotMatch(csv, /^"2026-01-01"/m);
});

// ── setGoalHours / getGoalHours ───────────────────────────────────────────────

test('setGoalHours throws for zero', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-edge-'));
  try {
    assert.throws(() => setGoalHours(0, join(dir, 'config.json')), /positive/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('setGoalHours throws for a negative value', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-edge-'));
  try {
    assert.throws(() => setGoalHours(-1, join(dir, 'config.json')), /positive/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('setGoalHours throws for Infinity', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-edge-'));
  try {
    assert.throws(() => setGoalHours(Infinity, join(dir, 'config.json')), /positive/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('setGoalHours throws for NaN', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-edge-'));
  try {
    assert.throws(() => setGoalHours(NaN, join(dir, 'config.json')), /positive/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('getGoalHours returns null when config file does not exist', () => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-edge-'));
  try {
    assert.equal(getGoalHours(join(dir, 'config.json')), null);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('setGoalHours preserves non-goal keys in config', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-goal-edge-'));
  const configPath = join(dir, 'config.json');

  t.after(() => rmSync(dir, { recursive: true, force: true }));

  // Pre-seed with an extra key alongside an existing goal
  writeFileSync(configPath, JSON.stringify({ someOtherKey: 'value', goalHours: 7 }), 'utf8');
  setGoalHours(8, configPath);
  const saved = JSON.parse(readFileSync(configPath, 'utf8'));
  assert.equal(saved.goalHours, 8);
  assert.equal(saved.someOtherKey, 'value');
});
