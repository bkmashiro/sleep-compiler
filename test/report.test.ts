import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(fileURLToPath(import.meta.url), '../../');
const entry = join(root, 'src/index.ts');

function runReport(days: string): { status: number | null; stderr: string } {
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx/esm', entry, 'report', '--days', days],
    { encoding: 'utf8', env: { ...process.env, NO_COLOR: '1' } }
  );
  return { status: result.status, stderr: result.stderr };
}

test('report --days rejects NaN values', () => {
  const { status, stderr } = runReport('abc');
  assert.equal(status, 1);
  assert.match(stderr, /--days must be a positive integer/);
});

test('report --days rejects zero', () => {
  const { status, stderr } = runReport('0');
  assert.equal(status, 1);
  assert.match(stderr, /--days must be a positive integer/);
});

test('report --days rejects negative numbers', () => {
  const { status, stderr } = runReport('-5');
  assert.equal(status, 1);
  assert.match(stderr, /--days must be a positive integer/);
});

test('report --days accepts floats that parseInt truncates to a positive integer', () => {
  // parseInt('3.5', 10) === 3, which passes the positive-integer guard
  const { status } = runReport('3.5');
  assert.equal(status, 0);
});
