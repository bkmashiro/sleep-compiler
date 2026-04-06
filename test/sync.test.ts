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

test('csv importSync returns empty array for empty input', () => {
  assert.deepEqual(importSync('', 'csv'), []);
  assert.deepEqual(importSync('   \n  ', 'csv'), []);
});

test('csv importSync returns empty array when only header is present', () => {
  assert.deepEqual(importSync('date,sleep_time,wake_time,duration_minutes,note', 'csv'), []);
});

test('csv importSync throws on wrong header', () => {
  assert.throws(
    () => importSync('date,sleep_time,wake_time,duration_minutes\n2026-03-20,23:30,07:15,465', 'csv'),
    /Unsupported CSV header/
  );
});

test('csv importSync throws on invalid row', () => {
  assert.throws(
    () => importSync('date,sleep_time,wake_time,duration_minutes,note\n,23:30,07:15,465,', 'csv'),
    /Invalid CSV row/
  );
});

test('csv importSync throws when duration_minutes is not a number', () => {
  assert.throws(
    () => importSync('date,sleep_time,wake_time,duration_minutes,note\n2026-03-20,23:30,07:15,abc,', 'csv'),
    /Invalid CSV row/
  );
});

test('csv exportSync/importSync handles notes with commas and quotes', () => {
  const withSpecialNote: SleepEntry[] = [
    {
      id: 1,
      date: '2026-03-20',
      sleep_time: '22:00',
      wake_time: '06:00',
      duration_minutes: 480,
      note: 'Ate late, "restless"',
      created_at: '',
    },
  ];
  const exported = exportSync(withSpecialNote, 'csv');
  const imported = importSync(exported, 'csv');
  assert.equal(imported[0].note, 'Ate late, "restless"');
});

test('csv importSync treats empty note field as null', () => {
  const input = 'date,sleep_time,wake_time,duration_minutes,note\n2026-03-20,23:30,07:15,465,';
  const [entry] = importSync(input, 'csv');
  assert.equal(entry.note, null);
});

test('apple-health importSync filters out non-sleep records', () => {
  const xml = `<HealthData>
  <Record type="HKQuantityTypeIdentifierStepCount" startDate="2026-03-20 10:00:00" endDate="2026-03-20 10:30:00" value="500"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="2026-03-20 23:30:00" endDate="2026-03-21 07:15:00" value="HKCategoryValueSleepAnalysisAsleep"/>
</HealthData>`;
  const imported = importSync(xml, 'apple-health');
  assert.equal(imported.length, 1);
  assert.equal(imported[0].date, '2026-03-20');
});

test('apple-health importSync filters out non-Asleep sleep records', () => {
  const xml = `<HealthData>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="2026-03-20 23:30:00" endDate="2026-03-21 07:15:00" value="HKCategoryValueSleepAnalysisInBed"/>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="2026-03-20 23:30:00" endDate="2026-03-21 07:15:00" value="HKCategoryValueSleepAnalysisAsleep"/>
</HealthData>`;
  const imported = importSync(xml, 'apple-health');
  assert.equal(imported.length, 1);
});

test('apple-health importSync throws on record missing startDate', () => {
  const xml = `<HealthData>
  <Record type="HKCategoryTypeIdentifierSleepAnalysis" endDate="2026-03-21 07:15:00" value="HKCategoryValueSleepAnalysisAsleep"/>
</HealthData>`;
  assert.throws(() => importSync(xml, 'apple-health'), /missing startDate or endDate/);
});

test('apple-health importSync returns empty array for empty HealthData', () => {
  assert.deepEqual(importSync('<HealthData></HealthData>', 'apple-health'), []);
});

test('exportSync sorts entries by date ascending', () => {
  const unordered: SleepEntry[] = [
    { id: 2, date: '2026-03-22', sleep_time: '23:00', wake_time: '07:00', duration_minutes: 480, note: null, created_at: '' },
    { id: 1, date: '2026-03-20', sleep_time: '23:00', wake_time: '07:00', duration_minutes: 480, note: null, created_at: '' },
    { id: 3, date: '2026-03-21', sleep_time: '23:00', wake_time: '07:00', duration_minutes: 480, note: null, created_at: '' },
  ];
  const csv = exportSync(unordered, 'csv');
  const lines = csv.split('\n').slice(1);
  assert.equal(lines[0].startsWith('2026-03-20'), true);
  assert.equal(lines[1].startsWith('2026-03-21'), true);
  assert.equal(lines[2].startsWith('2026-03-22'), true);
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
