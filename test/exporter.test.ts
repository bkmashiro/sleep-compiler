import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import test from 'node:test';

import { createSleepDb } from '../src/db.js';
import { escapeCsv, getExportRows, toCsv } from '../src/exporter.js';

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
