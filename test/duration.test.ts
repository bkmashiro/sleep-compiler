import test from 'node:test';
import assert from 'node:assert/strict';

import { calcDurationMinutes } from '../src/utils.js';

const cases = [
  ['23:30', '07:15', 465, 'calculates overnight sleep across midnight'],
  ['22:00', '06:30', 510, 'calculates a full overnight sleep across midnight'],
  ['07:00', '08:00', 60, 'allows a same-day nap'],
  ['00:00', '08:00', 480, 'handles midnight start'],
  ['23:59', '00:01', 2, 'handles a minimal overnight edge case'],
  ['08:00', '08:00', 24 * 60, 'identical sleep and wake time is treated as 24h overnight sleep'],
] as const;

for (const [sleepTime, wakeTime, expected, name] of cases) {
  test(name, () => {
    assert.equal(calcDurationMinutes(sleepTime, wakeTime), expected);
  });
}
