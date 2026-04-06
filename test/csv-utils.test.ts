import assert from 'node:assert/strict';
import test from 'node:test';

import { escapeCsv } from '../src/csv-utils.js';

test('escapeCsv returns plain strings unchanged', () => {
  assert.equal(escapeCsv('hello'), 'hello');
  assert.equal(escapeCsv('2026-03-30'), '2026-03-30');
  assert.equal(escapeCsv('07:30'), '07:30');
});

test('escapeCsv converts numbers to strings unchanged when safe', () => {
  assert.equal(escapeCsv(42), '42');
  assert.equal(escapeCsv(7.75), '7.75');
  assert.equal(escapeCsv(0), '0');
});

test('escapeCsv wraps values containing a comma in double quotes', () => {
  assert.equal(escapeCsv('one,two'), '"one,two"');
});

test('escapeCsv wraps values containing a double-quote and escapes it', () => {
  assert.equal(escapeCsv('say "hi"'), '"say ""hi"""');
});

test('escapeCsv wraps values containing a newline in double quotes', () => {
  assert.equal(escapeCsv('line1\nline2'), '"line1\nline2"');
});

test('escapeCsv handles a value that is only a double-quote character', () => {
  assert.equal(escapeCsv('"'), '""""');
});

test('escapeCsv handles empty string', () => {
  assert.equal(escapeCsv(''), '');
});

test('escapeCsv handles a value with multiple commas and quotes together', () => {
  assert.equal(escapeCsv('a,"b",c'), '"a,""b"",c"');
});
