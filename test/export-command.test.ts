import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

const CLI = ['node', '--import', 'tsx/esm', 'src/index.ts'];
const CWD = new URL('..', import.meta.url).pathname;

function runExport(args: string[]): { stdout: string; stderr: string; exitCode: number } {
  const result = spawnSync(CLI[0], [...CLI.slice(1), 'export', ...args], {
    cwd: CWD,
    encoding: 'utf8',
  });

  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    exitCode: result.status ?? 1,
  };
}

test('export with no flags exits with code 1 and prints a helpful error', () => {
  const { exitCode, stderr } = runExport([]);

  assert.equal(exitCode, 1);
  assert.match(stderr, /--csv|--json/);
});

test('export --csv exits 0 and outputs CSV header', () => {
  const { exitCode, stdout } = runExport(['--csv']);

  assert.equal(exitCode, 0);
  assert.match(stdout, /date,bedtime,waketime,duration_hours,score/);
});

test('export --json exits 0 and outputs valid JSON array', () => {
  const { exitCode, stdout } = runExport(['--json']);

  assert.equal(exitCode, 0);
  const parsed = JSON.parse(stdout);
  assert.ok(Array.isArray(parsed));
});

test('export --csv --json exits with code 1 (mutually exclusive)', () => {
  const { exitCode, stderr } = runExport(['--csv', '--json']);

  assert.equal(exitCode, 1);
  assert.match(stderr, /csv|json/i);
});

test('export --csv --days 0 exits with code 1 (invalid days)', () => {
  const { exitCode, stderr } = runExport(['--csv', '--days', '0']);

  assert.equal(exitCode, 1);
  assert.match(stderr, /days/i);
});

test('export --csv --days abc exits with code 1 (non-integer days)', () => {
  const { exitCode, stderr } = runExport(['--csv', '--days', 'abc']);

  assert.equal(exitCode, 1);
  assert.match(stderr, /days/i);
});

test('export --json --days 5 exits 0 and outputs valid JSON array', () => {
  const { exitCode, stdout } = runExport(['--json', '--days', '5']);

  assert.equal(exitCode, 0);
  const parsed = JSON.parse(stdout);
  assert.ok(Array.isArray(parsed));
});
