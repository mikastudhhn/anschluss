import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSprint, updateSprint, steer, LANES, INTRO } from '../src/logic/sprint.js';

const spec = (o = {}) => ({
  seed: 5, distance: 3000, timeLimit: 40, speedMul: 1, size: 'mittel', bus: false, clock: 600, level: 0, bahncard: 0,
  train: { name: 'ICB 578', type: 'ICB', dest: 'Kassel' },
  mods: { boostStart: false, groupsYield: false, pigeonsFlee: false, appTruth: false, noDurchsage: false, softHits: false, moneyMul: 1, infoPenalty: 0, density: 1 },
  ...o, mods: { boostStart: false, groupsYield: false, pigeonsFlee: false, appTruth: false, noDurchsage: false, softHits: false, moneyMul: 1, infoPenalty: 0, density: 1, ...(o.mods || {}) },
});
const runUntilDone = (sp, choose) => {
  for (let i = 0; i < 20000 && !sp.result; i++) {
    if (choose) choose(sp);
    updateSprint(sp, 1 / 60);
  }
  return sp.result;
};
const goTruth = sp => {
  if (sp.phase !== 'run' || sp.lock !== null || !sp.fork) return;
  const want = sp.fork.sides.L === sp.gleis.truth ? 0 : 2;
  if (sp.player.lane !== want) steer(sp, want < sp.player.lane ? -1 : 1);
};

test('same spec gives the same course', () => {
  const a = createSprint(spec()), b = createSprint(spec());
  assert.deepEqual(a.obstacles.map(o => [o.type, o.d, o.lanes]), b.obstacles.map(o => [o.type, o.d, o.lanes]));
  assert.deepEqual(a.gleis, b.gleis);
});

test('every obstacle row leaves at least one lane free', () => {
  for (let seed = 1; seed < 40; seed++) {
    const sp = createSprint(spec({ seed, distance: 4800, level: 5, mods: { density: 1.25 } }));
    const rows = new Map();
    for (const o of sp.obstacles) {
      const lanes = o.type === 'suitcase' ? [o.from, o.to] : o.lanes;
      rows.set(o.d, [...(rows.get(o.d) || []), ...lanes]);
    }
    for (const lanes of rows.values()) assert.ok(new Set(lanes).size < 3, `seed ${seed}`);
  }
});

test('the platform fork has the true platform on exactly one side, and info sources only say true or the one wrong number', () => {
  for (let seed = 1; seed < 40; seed++) {
    const sp = createSprint(spec({ seed }));
    const { truth, wrong } = sp.gleis;
    assert.notEqual(truth, wrong);
    assert.deepEqual([sp.fork.sides.L, sp.fork.sides.R].sort(), [truth, wrong].sort());
    for (const k of ['tafel', 'app', 'durchsage']) assert.ok([truth, wrong].includes(sp.gleis[k]));
  }
});

test('at least one trustworthy source per sprint, and trustworthy sources are nearly always right', () => {
  let right = 0, total = 0;
  for (let seed = 1; seed < 400; seed++) {
    const sp = createSprint(spec({ seed }));
    const good = Object.keys(sp.gleis.good).filter(k => sp.gleis.good[k]);
    assert.ok(good.length >= 1);
    for (const k of good) { total++; if (sp.gleis[k] === sp.gleis.truth) right++; }
  }
  assert.ok(right / total > 0.93, String(right / total));
});

test('powerbank makes the app right; noise cancelling removes the announcement', () => {
  for (let seed = 1; seed < 30; seed++) {
    const sp = createSprint(spec({ seed, mods: { appTruth: true, noDurchsage: true } }));
    assert.equal(sp.gleis.app, sp.gleis.truth);
    assert.equal(sp.gleis.good.app, true);
    assert.ok(!sp.events.some(e => e.kind === 'durchsage'));
  }
});

test('an empty station with enough time is made, the right side wins', () => {
  const sp = createSprint(spec());
  sp.obstacles = []; sp.pickups = [];
  const r = runUntilDone(sp, goTruth);
  assert.equal(r.made, true);
  assert.equal(r.hits, 0);
  assert.ok(Math.abs(r.elapsed - 3000 / 260) < 0.3, String(r.elapsed));
  assert.equal(r.money, 3, 'clean sprint bonus');
});

test('too little time means the train is gone', () => {
  const sp = createSprint(spec({ timeLimit: 5 }));
  sp.obstacles = [];
  const r = runUntilDone(sp, goTruth);
  assert.equal(r.made, false);
  assert.ok(Math.abs(r.elapsed - 5) < 0.05);
});

test('the bahncard buys one more minute once', () => {
  const need = 3000 / 260;
  const sp = createSprint(spec({ timeLimit: need - 1.5, bahncard: 1 }));
  sp.obstacles = [];
  const r = runUntilDone(sp, goTruth);
  assert.equal(r.made, true);
  assert.equal(r.bahncardUsed, true);
});

test('the wrong platform sends you back and costs time', () => {
  const sp = createSprint(spec({ timeLimit: 60 }));
  sp.obstacles = [];
  const wrongSide = sp => {
    if (sp.phase !== 'run' || sp.lock !== null || !sp.fork) return;
    const want = sp.fork.sides.L === sp.gleis.truth ? 2 : 0;
    if (sp.player.lane !== want) steer(sp, want < sp.player.lane ? -1 : 1);
  };
  const r = runUntilDone(sp, wrongSide);
  assert.equal(r.made, true);
  assert.ok(r.wrongPlatform);
  assert.ok(r.elapsed > 3000 / 260 + 2);
});

test('hitting a pillar stuns you and costs the clean bonus', () => {
  const sp = createSprint(spec());
  const pillar = sp.obstacles.find(o => o.type === 'pillar');
  assert.ok(pillar, 'course has a pillar');
  sp.obstacles = [pillar];
  sp.player.lane = pillar.lanes[0];
  sp.player.x = LANES[sp.player.lane];
  sp.pickups = [];
  const r = runUntilDone(sp, s => { if (s.s < pillar.d - 10) s.player.lane = pillar.lanes[0]; else goTruth(s); });
  assert.equal(r.hits, 1);
  assert.equal(r.money, 0);
});

test('elbows let you push through groups without stumbling', () => {
  const find = mods => {
    for (let seed = 1; seed < 200; seed++) {
      const sp = createSprint(spec({ seed, mods }));
      const g = sp.obstacles.find(o => o.type === 'group');
      if (!g) continue;
      sp.obstacles = [g]; sp.pickups = [];
      const lane = g.lanes[0];
      const r = runUntilDone(sp, s => { if (s.s < g.d) s.player.lane = lane; else goTruth(s); });
      return r;
    }
  };
  assert.equal(find({}).hits, 1);
  assert.equal(find({ groupsYield: true }).hits, 0);
});

test('pfand bottles pay out and the rolling suitcase multiplies it', () => {
  const collect = moneyMul => {
    const sp = createSprint(spec({ mods: { moneyMul } }));
    sp.obstacles = [];
    sp.pickups = [{ d: 800, lane: 1, taken: false }, { d: 1200, lane: 1, taken: false }];
    return runUntilDone(sp, s => { if (s.s < 1300) s.player.lane = 1; else goTruth(s); }).money;
  };
  assert.equal(collect(1), 2 + 3);
  assert.equal(collect(1.5), Math.round((2 + 3) * 1.5));
});

test('the intro does not eat into the time limit', () => {
  const sp = createSprint(spec());
  for (let t = 0; t < INTRO; t += 1 / 60) updateSprint(sp, 1 / 60);
  assert.ok(sp.timeLeft > 39.9);
});
