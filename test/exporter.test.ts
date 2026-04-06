import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';
import { Command } from 'commander';

import { createSleepDb } from '../src/db.js';
import { escapeCsv, getExportRows, toCsv, toExportRow } from '../src/exporter.js';
import { registerExport } from '../src/commands/export.js';

function captureStdout(fn: () => void): string {
  const chunks: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  process.stdout.write = (chunk: unknown) => {
    chunks.push(String(chunk));
    return true;
  };
  try {
    fn();
  } finally {
    process.stdout.write = original;
  }
  return chunks.join('');
}

test('getExportRows returns export-friendly rows in ascending date order', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-export-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  db.insertEntry('2026-03-30', '23:30', '07:15', 465);
  db.insertEntry('2026-03-31', '00:15', '07:30', 435);
  db.insertEntry('2026-04-01', '23:00', '06:45', 465);

  assert.deepEqual(getExportRows(undefined, dbPath), [
    { date: '2026-03-30', bedtime: '23:30', waketime: '07:15', duration_hours: 7.75, score: 95 },
    { date: '2026-03-31', bedtime: '00:15', waketime: '07:30', duration_hours: 7.25, score: 85 },
    { date: '2026-04-01', bedtime: '23:00', waketime: '06:45', duration_hours: 7.75, score: 95 },
  ]);
});

test('getExportRows can limit output to the last N days', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-export-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  db.insertEntry('2026-03-30', '23:30', '07:15', 465);
  db.insertEntry('2026-03-31', '00:15', '07:30', 435);
  db.insertEntry('2026-04-01', '23:00', '06:45', 465);

  assert.deepEqual(getExportRows(2, dbPath), [
    { date: '2026-03-31', bedtime: '00:15', waketime: '07:30', duration_hours: 7.25, score: 85 },
    { date: '2026-04-01', bedtime: '23:00', waketime: '06:45', duration_hours: 7.75, score: 95 },
  ]);
});

test('getExportRows with days=N equal to total entries returns all entries', (t) => {
test('toExportRow score uses goal hours, not a hardcoded 8h', () => {
  const entry = { id: 1, date: '2026-04-01', sleep_time: '23:00', wake_time: '07:00', duration_minutes: 420, note: null, created_at: '' };

  // 420 min = 7h; goal 7h → perfect score
  assert.equal(toExportRow(entry, 7).score, 100);

  // 420 min vs 8h goal (480 min) → delta 60 → 100 - 20 = 80
  assert.equal(toExportRow(entry, 8).score, 80);

  // 420 min vs 9h goal (540 min) → delta 120 → 100 - 40 = 60
  assert.equal(toExportRow(entry, 9).score, 60);
});

test('toExportRow score is clamped to 0 when far below goal', () => {
  // 0 min vs 8h goal → delta 480 → 100 - 160 = -60, clamped to 0
  const entry = { id: 1, date: '2026-04-01', sleep_time: '00:00', wake_time: '00:00', duration_minutes: 0, note: null, created_at: '' };
  assert.equal(toExportRow(entry, 8).score, 0);
});

test('getExportRows uses provided goalHours for scoring', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-export-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  db.insertEntry('2026-03-30', '23:30', '07:15', 465);
  db.insertEntry('2026-03-31', '00:15', '07:30', 435);
  db.insertEntry('2026-04-01', '23:00', '06:45', 465);

  assert.deepEqual(getExportRows(3, dbPath), [
    { date: '2026-03-30', bedtime: '23:30', waketime: '07:15', duration_hours: 7.75, score: 95 },
    { date: '2026-03-31', bedtime: '00:15', waketime: '07:30', duration_hours: 7.25, score: 85 },
    { date: '2026-04-01', bedtime: '23:00', waketime: '06:45', duration_hours: 7.75, score: 95 },
  ]);
});

test('getExportRows with days=1 returns only the single most recent entry', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-export-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  db.insertEntry('2026-03-30', '23:30', '07:15', 465);
  db.insertEntry('2026-03-31', '00:15', '07:30', 435);
  db.insertEntry('2026-04-01', '23:00', '06:45', 465);

  assert.deepEqual(getExportRows(1, dbPath), [
    { date: '2026-04-01', bedtime: '23:00', waketime: '06:45', duration_hours: 7.75, score: 95 },
  ]);
});

test('getExportRows with days exceeding total entries returns all entries', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-export-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  db.insertEntry('2026-03-30', '23:30', '07:15', 465);
  db.insertEntry('2026-03-31', '00:15', '07:30', 435);

  assert.deepEqual(getExportRows(10, dbPath), [
    { date: '2026-03-30', bedtime: '23:30', waketime: '07:15', duration_hours: 7.75, score: 95 },
    { date: '2026-03-31', bedtime: '00:15', waketime: '07:30', duration_hours: 7.25, score: 85 },
  ]);
});

test('getExportRows on empty database returns empty array', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-export-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  assert.deepEqual(getExportRows(undefined, dbPath), []);
  assert.deepEqual(getExportRows(3, dbPath), []);
});

test('toCsv renders the requested header and values', () => {
  const csv = toCsv([
    { date: '2024-01-15', bedtime: '23:30', waketime: '07:15', duration_hours: 7.75, score: 92 },
    { date: '2024-01-16', bedtime: '00:15', waketime: '07:30', duration_hours: 7.25, score: 78 },
  ]);

  assert.equal(
    csv,
    ['date,bedtime,waketime,duration_hours,score', '2024-01-15,23:30,07:15,7.75,92', '2024-01-16,00:15,07:30,7.25,78'].join('\n')
  );
});

test('export command --format csv outputs CSV', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-export-cmd-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  db.insertEntry('2026-03-30', '23:30', '07:15', 465);

  const program = new Command();
  program.exitOverride();
  registerExport(program, dbPath);

  const output = captureStdout(() => {
    program.parse(['export', '--format', 'csv'], { from: 'user' });
  });

  assert.ok(output.startsWith('date,bedtime,waketime,duration_hours,score\n'));
  assert.ok(output.includes('2026-03-30,23:30,07:15,7.75,95'));
});

test('export command --format json outputs valid JSON array', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-export-cmd-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  db.insertEntry('2026-03-30', '23:30', '07:15', 465);

  const program = new Command();
  program.exitOverride();
  registerExport(program, dbPath);

  const output = captureStdout(() => {
    program.parse(['export', '--format', 'json'], { from: 'user' });
  });

  const parsed = JSON.parse(output.trim());
  assert.ok(Array.isArray(parsed));
  assert.equal(parsed.length, 1);
  assert.deepEqual(parsed[0], {
    date: '2026-03-30',
    bedtime: '23:30',
    waketime: '07:15',
    duration_hours: 7.75,
    score: 95,
  });
});

test('export command defaults to csv when --format is omitted', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-export-cmd-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  db.insertEntry('2026-03-30', '23:30', '07:15', 465);

  const program = new Command();
  program.exitOverride();
  registerExport(program, dbPath);

  const output = captureStdout(() => {
    program.parse(['export'], { from: 'user' });
  });

  assert.ok(output.startsWith('date,bedtime,waketime,duration_hours,score\n'));
});

test('export command rejects unknown --format value', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-export-cmd-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const program = new Command();
  program.exitOverride();
  registerExport(program, dbPath);

  const stderrChunks: string[] = [];
  const originalStderr = process.stderr.write.bind(process.stderr);
  process.stderr.write = (chunk: unknown) => {
    stderrChunks.push(String(chunk));
    return true;
  };

  let exited = false;
  const originalExit = process.exit.bind(process);
  (process as NodeJS.Process & { exit: (code?: number) => never }).exit = ((code?: number) => {
    exited = true;
    throw new Error(`process.exit(${code})`);
  }) as (code?: number) => never;

  try {
    program.parse(['export', '--format', 'tsv'], { from: 'user' });
  } catch {
    // expected — thrown by our process.exit override
  } finally {
    process.stderr.write = originalStderr;
    (process as NodeJS.Process & { exit: (code?: number) => never }).exit = originalExit as (code?: number) => never;
    db.close();
  }

  assert.ok(exited, 'process.exit should have been called');
  assert.ok(stderrChunks.join('').includes('Unknown format'));
});
