import test from 'node:test';
import assert from 'node:assert/strict';

import { calcConsistencyScore } from '../src/utils.js';

const cases = [
  [['23:00', '23:00', '23:00'], 100, 'returns 100% for identical bedtimes'],
  [['23:00', '23:20', '22:40'], 100, 'returns 100% when variance stays under 30 minutes'],
  [['23:00', '23:40', '22:20'], 80, 'returns 80% when variance stays under 45 minutes'],
  [['23:00', '23:55', '21:50', '00:05'], 60, 'returns 60% for moderate bedtime variance'],
  [['23:00', '00:30', '21:30'], 40, 'returns 40% for high bedtime variance'],
] as const;

for (const [bedtimes, expected, name] of cases) {
  test(name, () => {
    assert.equal(calcConsistencyScore([...bedtimes]), expected);
  });
}
