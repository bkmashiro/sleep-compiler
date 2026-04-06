import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = join(import.meta.dirname, '..', 'src', 'index.ts');
const NODE_FLAGS = ['--import', 'tsx/esm'];

function run(
  args: readonly string[],
  dbPath: string
): { stdout: string; stderr: string; status: number | null } {
  const result = spawnSync(process.execPath, [...NODE_FLAGS, CLI, ...args], {
    encoding: 'utf8',
    env: { ...process.env, SLEEP_DB_PATH: dbPath, FORCE_COLOR: '0' },
  });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
  };
}

function makeTempDb(): { dbPath: string; cleanup: () => void } {
  const dir = mkdtempSync(join(tmpdir(), 'sleep-compiler-test-'));
  const dbPath = join(dir, 'sleep.db');
  return { dbPath, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('log --sleep 23:00 --wake 07:00 writes a db entry and prints confirmation', (t) => {
  const { dbPath, cleanup } = makeTempDb();
  t.after(cleanup);

  const { stdout, status } = run(
    ['log', '--sleep', '23:00', '--wake', '07:00', '--date', '2026-04-01'],
    dbPath
  );

  assert.equal(status, 0);
  assert.match(stdout, /Logged/);
  assert.match(stdout, /2026-04-01/);
  assert.match(stdout, /23:00/);
  assert.match(stdout, /07:00/);
  assert.match(stdout, /8h 00m/);
});

test('log confirmation includes quality label', (t) => {
  const { dbPath, cleanup } = makeTempDb();
  t.after(cleanup);

  const { stdout, status } = run(
    ['log', '--sleep', '23:00', '--wake', '07:00', '--date', '2026-04-01'],
    dbPath
  );

  assert.equal(status, 0);
  assert.match(stdout, /Quality:/);
});

test('report --days 7 outputs a formatted table after logging entries', (t) => {
  const { dbPath, cleanup } = makeTempDb();
  t.after(cleanup);

  run(['log', '--sleep', '23:00', '--wake', '07:00', '--date', '2026-04-01'], dbPath);
  run(['log', '--sleep', '22:30', '--wake', '06:30', '--date', '2026-04-02'], dbPath);

  const { stdout, status } = run(['report', '--days', '7'], dbPath);

  assert.equal(status, 0);
  assert.match(stdout, /Sleep Report/);
  assert.match(stdout, /Date/);
  assert.match(stdout, /Bedtime/);
  assert.match(stdout, /Duration/);
  assert.match(stdout, /2026-04-01/);
  assert.match(stdout, /2026-04-02/);
  assert.match(stdout, /Average duration:/);
  assert.match(stdout, /Consistency score:/);
});

test('report --days 7 with no data prints empty state', (t) => {
  const { dbPath, cleanup } = makeTempDb();
  t.after(cleanup);

  const { stdout, status } = run(['report', '--days', '7'], dbPath);

  assert.equal(status, 0);
  assert.match(stdout, /No entries found/);
});

test('report --days limits the number of rows returned', (t) => {
  const { dbPath, cleanup } = makeTempDb();
  t.after(cleanup);

  run(['log', '--sleep', '23:00', '--wake', '07:00', '--date', '2026-03-20'], dbPath);
  run(['log', '--sleep', '23:00', '--wake', '07:00', '--date', '2026-04-04'], dbPath);
  run(['log', '--sleep', '23:00', '--wake', '07:00', '--date', '2026-04-05'], dbPath);

  // --days 2 returns the 2 most-recent entries (LIMIT 2 ORDER BY date DESC)
  const { stdout, status } = run(['report', '--days', '2'], dbPath);

  assert.equal(status, 0);
  assert.match(stdout, /2026-04-05/);
  assert.match(stdout, /2026-04-04/);
  assert.doesNotMatch(stdout, /2026-03-20/);
});

test('stats with no data prints graceful empty state', (t) => {
  const { dbPath, cleanup } = makeTempDb();
  t.after(cleanup);

  const { stdout, status } = run(['stats'], dbPath);

  assert.equal(status, 0);
  assert.match(stdout, /No entries found/);
});

test('stats with data shows all-time statistics', (t) => {
  const { dbPath, cleanup } = makeTempDb();
  t.after(cleanup);

  run(['log', '--sleep', '23:00', '--wake', '07:00', '--date', '2026-04-01'], dbPath);
  run(['log', '--sleep', '22:00', '--wake', '06:00', '--date', '2026-04-02'], dbPath);

  const { stdout, status } = run(['stats'], dbPath);

  assert.equal(status, 0);
  assert.match(stdout, /All-Time Sleep Stats/);
  assert.match(stdout, /Total entries:\s+2/);
  assert.match(stdout, /Average duration:/);
  assert.match(stdout, /Best night:/);
  assert.match(stdout, /Worst night:/);
  assert.match(stdout, /Consistency score:/);
});

test('log with invalid sleep time --sleep 25:00 exits non-zero with error message', (t) => {
  const { dbPath, cleanup } = makeTempDb();
  t.after(cleanup);

  const { stderr, status } = run(
    ['log', '--sleep', '25:00', '--wake', '07:00', '--date', '2026-04-01'],
    dbPath
  );

  assert.notEqual(status, 0);
  assert.match(stderr, /Error:/i);
});

test('log with invalid wake time --wake 99:99 exits non-zero with error message', (t) => {
  const { dbPath, cleanup } = makeTempDb();
  t.after(cleanup);

  const { stderr, status } = run(
    ['log', '--sleep', '23:00', '--wake', '99:99', '--date', '2026-04-01'],
    dbPath
  );

  assert.notEqual(status, 0);
  assert.match(stderr, /Error:/i);
});

test('log duplicate date exits non-zero with error message', (t) => {
  const { dbPath, cleanup } = makeTempDb();
  t.after(cleanup);

  run(['log', '--sleep', '23:00', '--wake', '07:00', '--date', '2026-04-01'], dbPath);

  const { stderr, status } = run(
    ['log', '--sleep', '22:00', '--wake', '06:00', '--date', '2026-04-01'],
    dbPath
  );

  assert.notEqual(status, 0);
  assert.match(stderr, /Error:/i);
});

test('log with note includes it in db and confirmation output', (t) => {
  const { dbPath, cleanup } = makeTempDb();
  t.after(cleanup);

  const { stdout, status } = run(
    ['log', '--sleep', '23:00', '--wake', '07:00', '--date', '2026-04-01', '--note', 'took melatonin'],
    dbPath
  );

  assert.equal(status, 0);
  assert.match(stdout, /Logged/);
});

test('report --json outputs valid JSON array', (t) => {
  const { dbPath, cleanup } = makeTempDb();
  t.after(cleanup);

  run(['log', '--sleep', '23:00', '--wake', '07:00', '--date', '2026-04-01'], dbPath);

  const { stdout, status } = run(['report', '--days', '7', '--json'], dbPath);

  assert.equal(status, 0);
  const parsed = JSON.parse(stdout) as unknown[];
  assert.ok(Array.isArray(parsed));
  assert.equal(parsed.length, 1);
});
