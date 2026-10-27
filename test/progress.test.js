import { test } from 'node:test';
import assert from 'node:assert/strict';
import { newProgress, parseProgress, unlocked, nextUnlock, recordRun } from '../src/logic/progress.js';
import { LADDER, MAX_STUFE } from '../src/logic/content.js';

const run = (o = {}) => ({ mode: 'free', day: null, stufe: 0, score: -5, stars: 2, km: 300, line: '🚆🚆', ...o });

test('a new player has the pendler, the north and nothing else', () => {
  const u = unlocked(newProgress());
  assert.deepEqual(u.characters, ['pendler']);
  assert.deepEqual(u.regions, ['nord']);
  assert.deepEqual(u.perks, []);
  assert.equal(nextUnlock(newProgress()).entry, LADDER[0]);
});

test('kilometres from every journey climb the ladder, even failed ones', () => {
  const r1 = recordRun(newProgress(), run({ km: 450, score: -40, stars: 1 }));
  assert.equal(r1.progress.km, 450);
  assert.deepEqual(r1.unlocks, [LADDER[0]]);
  assert.ok(unlocked(r1.progress).characters.includes('studentin'));
  const r2 = recordRun(r1.progress, run({ km: 600 }));
  assert.deepEqual(r2.unlocks, [LADDER[1]]);
  assert.ok(unlocked(r2.progress).regions.includes('de'));
  const n = nextUnlock(r2.progress);
  assert.equal(n.entry, LADDER[2]);
  assert.ok(n.fraction > 0 && n.fraction < 1);
});

test('arriving on time at your highest stufe unlocks the next one, up to the max', () => {
  let p = newProgress();
  let r = recordRun(p, run({ score: -1 }));
  assert.equal(r.stufeUnlocked, null);
  r = recordRun(r.progress, run({ score: 0, stars: 3 }));
  assert.equal(r.stufeUnlocked, 1);
  r = recordRun(r.progress, run({ score: 5, stars: 3, stufe: 0 }));
  assert.equal(r.stufeUnlocked, null, 'lower stufe does not unlock');
  p = { ...r.progress, stufeMax: MAX_STUFE };
  assert.equal(recordRun(p, run({ score: 5, stars: 3, stufe: MAX_STUFE })).stufeUnlocked, null);
});

test('only the first daily attempt counts', () => {
  const r1 = recordRun(newProgress(), run({ mode: 'daily', day: 3, score: -8, line: 'A' }));
  assert.equal(r1.dailyCounted, true);
  const r2 = recordRun(r1.progress, run({ mode: 'daily', day: 3, score: 20, line: 'B' }));
  assert.equal(r2.dailyCounted, false);
  assert.equal(r2.progress.daily[3].score, -8);
  assert.equal(r2.progress.km, 600, 'kilometres still count');
});

test('stats track journeys, on-time arrivals and the best score', () => {
  let p = recordRun(newProgress(), run({ score: -3 })).progress;
  p = recordRun(p, run({ score: 7, stars: 3 })).progress;
  assert.equal(p.runs, 2);
  assert.equal(p.onTime, 1);
  assert.equal(p.bestScore, 7);
});

test('parseProgress survives garbage and keeps known fields', () => {
  assert.deepEqual(parseProgress('nope'), newProgress());
  assert.deepEqual(parseProgress(null), newProgress());
  const p = parseProgress(JSON.stringify({ km: 1234, name: 'Mika', unknown: 1 }));
  assert.equal(p.km, 1234);
  assert.equal(p.name, 'Mika');
  assert.equal(p.unknown, undefined);
});

test('recordRun does not mutate its input', () => {
  const p = newProgress();
  recordRun(p, run({ mode: 'daily', day: 1 }));
  assert.deepEqual(p, newProgress());
});
