import assert from 'node:assert/strict';
import test from 'node:test';

import { exportSync, importSync } from '../src/sync.js';
import type { SleepEntry } from '../src/db.js';

const entries: SleepEntry[] = [
  {
    id: 1,
    date: '2026-03-20',
    sleep_time: '23:30',
    wake_time: '07:15',
    duration_minutes: 465,
    note: 'Solid night',
    created_at: '',
  },
  {
    id: 2,
    date: '2026-03-21',
    sleep_time: '00:10',
    wake_time: '08:00',
    duration_minutes: 470,
    note: 'Weekend, slept in',
    created_at: '',
  },
];

test('csv sync export/import round-trips sleep entries', () => {
  const exported = exportSync(entries, 'csv');
  const imported = importSync(exported, 'csv');

  assert.deepEqual(imported, [
    {
      date: '2026-03-20',
      sleep_time: '23:30',
      wake_time: '07:15',
      duration_minutes: 465,
      note: 'Solid night',
    },
    {
      date: '2026-03-21',
      sleep_time: '00:10',
      wake_time: '08:00',
      duration_minutes: 470,
      note: 'Weekend, slept in',
    },
  ]);
});

test('apple-health sync export/import round-trips sleep entries', () => {
  const exported = exportSync(entries, 'apple-health');
  const imported = importSync(exported, 'apple-health');

  assert.deepEqual(imported, [
    {
      date: '2026-03-20',
      sleep_time: '23:30',
      wake_time: '07:15',
      duration_minutes: 465,
      note: null,
    },
    {
      date: '2026-03-21',
      sleep_time: '00:10',
      wake_time: '08:00',
      duration_minutes: 470,
      note: null,
    },
  ]);
});
