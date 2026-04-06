import test from 'node:test';
import assert from 'node:assert/strict';

import { formatDuration, getQualityLabel, getQualitySymbol, printHeader } from '../src/formatter.js';

// formatDuration

test('formatDuration returns 0h 00m for 0 minutes', () => {
  assert.equal(formatDuration(0), '0h 00m');
});

test('formatDuration pads single-digit minutes with leading zero', () => {
  assert.equal(formatDuration(59), '0h 59m');
});

test('formatDuration formats exactly 60 minutes as 1h 00m', () => {
  assert.equal(formatDuration(60), '1h 00m');
});

test('formatDuration formats 90 minutes as 1h 30m', () => {
  assert.equal(formatDuration(90), '1h 30m');
});

test('formatDuration formats 480 minutes as 8h 00m', () => {
  assert.equal(formatDuration(480), '8h 00m');
});

// getQualityLabel

test('getQualityLabel returns poor label for < 6h (359 min)', () => {
  assert.match(getQualityLabel(359), /poor/);
});

test('getQualityLabel returns poor label at boundary 0 minutes', () => {
  assert.match(getQualityLabel(0), /poor/);
});

test('getQualityLabel returns short label for 6h exactly (360 min)', () => {
  assert.match(getQualityLabel(360), /short/);
});

test('getQualityLabel returns short label for 419 min (< 7h)', () => {
  assert.match(getQualityLabel(419), /short/);
});

test('getQualityLabel returns good label for 7h exactly (420 min)', () => {
  assert.match(getQualityLabel(420), /good/);
});

test('getQualityLabel returns good label for 9h exactly (540 min)', () => {
  assert.match(getQualityLabel(540), /good/);
});

test('getQualityLabel returns long label for > 9h (541 min)', () => {
  assert.match(getQualityLabel(541), /long/);
});

// getQualitySymbol

test('getQualitySymbol returns ✗ for poor sleep (359 min)', () => {
  assert.match(getQualitySymbol(359), /✗/);
});

test('getQualitySymbol returns ⚠ for short sleep (360 min)', () => {
  assert.match(getQualitySymbol(360), /⚠/);
});

test('getQualitySymbol returns ✓ for good sleep (420 min)', () => {
  assert.match(getQualitySymbol(420), /✓/);
});

test('getQualitySymbol returns ✓ for good sleep at upper boundary (540 min)', () => {
  assert.match(getQualitySymbol(540), /✓/);
});

test('getQualitySymbol returns ○ for long sleep (541 min)', () => {
  assert.match(getQualitySymbol(541), /○/);
});

// printHeader

test('printHeader writes a non-empty string to stdout', () => {
  const lines: string[] = [];
  const original = console.log;
  console.log = (msg: string) => { lines.push(msg); };
  try {
    printHeader('Test');
    assert.ok(lines.length > 0, 'expected at least one console.log call');
    assert.ok(lines[0].length > 0, 'expected non-empty output');
  } finally {
    console.log = original;
  }
});
