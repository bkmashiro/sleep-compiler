import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const entry = join(root, 'src/index.ts');

function runReport(args: string[]): { stdout: string; stderr: string; status: number } {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx/esm', entry, 'report', ...args],
    { cwd: root, encoding: 'utf8' }
  );
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status ?? 1,
  };
}

test('report --days with a non-numeric value exits non-zero with an error message', () => {
  const { stderr, status } = runReport(['--days', 'abc']);
  assert.notEqual(status, 0);
  assert.match(stderr, /--days must be a positive integer/);
});

test('report --days with a negative number exits non-zero with an error message', () => {
  const { stderr, status } = runReport(['--days', '-5']);
  assert.notEqual(status, 0);
  assert.match(stderr, /--days must be a positive integer/);
});

test('report --days with zero exits non-zero with an error message', () => {
  const { stderr, status } = runReport(['--days', '0']);
  assert.notEqual(status, 0);
  assert.match(stderr, /--days must be a positive integer/);
});

test('report --days with a float is accepted (parseInt truncates to integer)', () => {
  // parseInt('3.5', 10) === 3, which is a valid positive integer
  const { status } = runReport(['--days', '3.5']);
  assert.equal(status, 0);
});

test('report --days with a valid positive integer succeeds', () => {
  const { status } = runReport(['--days', '7']);
  assert.equal(status, 0);
});
