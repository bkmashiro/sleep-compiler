import test from 'node:test';
import assert from 'node:assert/strict';

import { classifySleepQuality } from '../src/utils.js';

const cases = [
  [350, 'poor', 'classifies sleep below 6 hours as poor'],
  [390, 'short', 'classifies 6 to 7 hours as short'],
  [465, 'good', 'classifies 7 to 9 hours as good'],
  [540, 'good', 'keeps exactly 9 hours in the good bucket'],
  [600, 'long', 'classifies sleep above 9 hours as long'],
] as const;

for (const [minutes, expected, name] of cases) {
  test(name, () => {
    assert.equal(classifySleepQuality(minutes), expected);
  });
}
