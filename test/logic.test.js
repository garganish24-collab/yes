const test = require('node:test');
const assert = require('node:assert');
const L = require('../src/logic.js');

const START = '2026-01-01';

function makeData() {
  const data = L.emptyData();
  data.habits = [
    { id: 'a', name: 'Workout', type: 'non', createdAt: START },
    { id: 'b', name: 'Diet', type: 'non', createdAt: START },
    { id: 'c', name: 'Read', type: 'neg', createdAt: START },
  ];
  data.challenge = { startDate: START, active: true, attempts: [] };
  return data;
}

// Ticks both non-negotiables for `count` days starting at `from`.
function completeDays(data, from, count) {
  for (let i = 0; i < count; i++) data.log[L.addDays(from, i)] = ['a', 'b'];
}

test('fill only counts non-negotiables, negotiables are bonus', () => {
  const data = makeData();
  data.log[START] = ['a', 'c'];
  const s = L.dayStats(data, START);
  assert.strictEqual(s.fill, 0.5);
  assert.strictEqual(s.negDone, 1);
  assert.strictEqual(s.complete, false);
});

test('all days met counts up one per day', () => {
  const data = makeData();
  completeDays(data, START, 20);
  const r = L.challengeProgress(data, L.addDays(START, 19));
  assert.strictEqual(r.progress, 20);
  assert.strictEqual(r.todayDone, true);
  assert.strictEqual(r.penalties.length, 0);
});

test('a miss after 11 good days drops back 10', () => {
  const data = makeData();
  completeDays(data, START, 11);
  data.log[L.addDays(START, 11)] = ['a']; // day 12, diet missed
  const r = L.challengeProgress(data, L.addDays(START, 12));
  assert.strictEqual(r.progress, 1);
  assert.strictEqual(r.peak, 11);
  assert.deepStrictEqual(r.penalties[0].missed, ['b']);
});

test('a miss early on floors at 0', () => {
  const data = makeData();
  completeDays(data, START, 4);
  const r = L.challengeProgress(data, L.addDays(START, 5)); // day 5 empty
  assert.strictEqual(r.progress, 0);
});

test('today is pending, not a miss, until it ends', () => {
  const data = makeData();
  completeDays(data, START, 3);
  const r = L.challengeProgress(data, L.addDays(START, 3));
  assert.strictEqual(r.progress, 3);
  assert.strictEqual(r.todayDone, false);
  assert.strictEqual(r.penalties.length, 0);
});

test('fixing a forgotten past day recalculates progress', () => {
  const data = makeData();
  completeDays(data, START, 10);
  delete data.log[L.addDays(START, 4)];
  const today = L.addDays(START, 10);
  assert.strictEqual(L.challengeProgress(data, today).progress, 5);
  data.log[L.addDays(START, 4)] = ['a', 'b'];
  assert.strictEqual(L.challengeProgress(data, today).progress, 10);
});

test('hitting 75 completes the challenge', () => {
  const data = makeData();
  completeDays(data, START, 80);
  const r = L.challengeProgress(data, L.addDays(START, 79));
  assert.strictEqual(r.progress, 75);
  assert.strictEqual(r.complete, true);
  assert.strictEqual(r.completedOn, L.addDays(START, 74));
});

test('habits added later do not count on earlier days', () => {
  const data = makeData();
  data.habits.push({ id: 'd', name: 'Water', type: 'non', createdAt: '2026-01-05' });
  completeDays(data, START, 4);
  const r = L.challengeProgress(data, '2026-01-04');
  assert.strictEqual(r.progress, 4);
  assert.strictEqual(L.dayStats(data, '2026-01-05').nonTotal, 3);
});

test('archived habits stop counting from the archive date', () => {
  const data = makeData();
  data.habits[1].archived = true;
  data.habits[1].archivedAt = '2026-01-03';
  assert.strictEqual(L.dayStats(data, '2026-01-02').nonTotal, 2);
  assert.strictEqual(L.dayStats(data, '2026-01-03').nonTotal, 1);
});
