import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { createSleepDb } from '../../src/db.js';
import { getExportRows, toCsv } from '../../src/exporter.js';

test('export: --json returns all entries in ascending date order', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-export-cmd-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  db.insertEntry('2026-04-01', '23:00', '07:00', 480);
  db.insertEntry('2026-04-02', '23:30', '07:30', 480);

  const rows = getExportRows(undefined, dbPath);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].date, '2026-04-01');
  assert.equal(rows[1].date, '2026-04-02');
});

test('export: empty database returns empty array', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-export-cmd-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const rows = getExportRows(undefined, dbPath);
  assert.equal(rows.length, 0);
});

test('export: --days limits result to the last N entries', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-export-cmd-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  db.insertEntry('2026-03-30', '23:00', '07:00', 480);
  db.insertEntry('2026-03-31', '23:00', '07:00', 480);
  db.insertEntry('2026-04-01', '23:00', '07:00', 480);

  const rows = getExportRows(2, dbPath);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].date, '2026-03-31');
  assert.equal(rows[1].date, '2026-04-01');
});

test('export: --csv produces the correct header and one row per entry', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-export-cmd-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  db.insertEntry('2026-04-01', '23:00', '07:00', 480);

  const rows = getExportRows(undefined, dbPath);
  const csv = toCsv(rows);
  const lines = csv.split('\n');

  assert.equal(lines[0], 'date,bedtime,waketime,duration_hours,score');
  assert.equal(lines.length, 2);
  assert.match(lines[1], /^2026-04-01,/);
});

test('export: score is capped at 100 and never negative', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-export-cmd-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  // Exactly 8h — should score 100
  db.insertEntry('2026-04-01', '23:00', '07:00', 480);
  // 1 minute — very far from 8h, score should be 0 (not negative)
  db.insertEntry('2026-04-02', '23:00', '23:01', 1);

  const rows = getExportRows(undefined, dbPath);
  assert.equal(rows[0].score, 100);
  assert.ok(rows[1].score >= 0, `Expected score >= 0, got ${rows[1].score}`);
});

test('export: duration_hours is rounded to two decimal places', (t) => {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-export-cmd-'));
  const dbPath = join(dir, 'sleep.db');
  const db = createSleepDb(dbPath);

  t.after(() => {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  });

  db.insertEntry('2026-04-01', '23:00', '06:45', 465); // 7.75h
  const [row] = getExportRows(undefined, dbPath);
  assert.equal(row.duration_hours, 7.75);
});
