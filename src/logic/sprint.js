// The station sprint as a pure simulation. The renderer reads the state, `fx` carries one-shot effects.
import { makeRng } from './rng.js';
import { SPRINT_SPEED, SEC_PER_MIN } from './content.js';

export const W = 360, H = 560, HUD_H = 66, PLAYER_Y = 470;
export const LANES = [80, 180, 280];
export const BOX = { pillar: [24, 16], group: [82, 18], suitcase: [17, 14], pigeons: [28, 12] };
export const INTRO = 1.6;
const PHW = 12, PHH = 12, STUN = 1.0, FORK_LEN = 520, BOARD_T = 1.7, MISSED_T = 1.9, WRONG_T = 1.3;
const CLEAN_BONUS = 3, GOOD_ACC = 0.97, BAD_ACC = 0.35;

export const screenY = (sp, d) => PLAYER_Y - (d - sp.s);

export function createSprint(spec) {
  const rng = makeRng(spec.seed);
  const sp = {
    spec, rng, s: 0, D: spec.distance, v: SPRINT_SPEED * spec.speedMul, timeLeft: spec.timeLimit, elapsed: 0,
    phase: 'intro', t: 0, time: 0, slowmo: 0, curV: 0,
    player: { lane: 1, x: LANES[1], stun: 0, boost: 0, slow: 0, prevLane: 1, changeT: -9, phase: 0, amp: 1, board: 0 },
    obstacles: [], pickups: [], fork: null, lock: null, noGen: [], events: [],
    pfand: 0, hits: 0, bahncardLeft: spec.bahncard, bahncardUsed: false, wrongPlatform: false, wrongSide: false,
    trainX: 0, trainV: 0, doors: 1, fx: [], result: null,
  };
  setupPlatform(sp);
  generate(sp, 380, sp.D - 430);
  return sp;
}

function setupPlatform(sp) {
  const { rng, spec } = sp;
  const truth = rng.int(1, 14);
  let wrong;
  do { wrong = rng.int(1, 14); } while (wrong === truth);
  // Every source shows whether it is trustworthy (fresh app, clear announcement, working board).
  // Reading those cues while dodging is the skill; at least one source per sprint is trustworthy.
  const sources = ['tafel', 'app', 'durchsage'].filter(k => !(k === 'durchsage' && spec.mods.noDurchsage));
  const good = {};
  for (const k of sources) good[k] = rng.chance(0.45);
  if (spec.mods.appTruth) good.app = true;
  if (!sources.some(k => good[k])) good[rng.pick(sources)] = true;
  const say = k => (rng.chance(good[k] ? GOOD_ACC - spec.mods.infoPenalty : BAD_ACC) ? truth : wrong);
  sp.gleis = { truth, wrong, good, tafel: say('tafel'), app: spec.mods.appTruth ? truth : say('app'), durchsage: say('durchsage') };
  sp.gleis.shown = sp.gleis.tafel;
  if (spec.bus) {
    sp.gleis = { ...sp.gleis, tafel: truth, app: truth, durchsage: truth, shown: truth, good: { tafel: true, app: true, durchsage: true } };
    return;
  }
  const truthLeft = rng.chance(0.5);
  sp.fork = { d0: sp.D - FORK_LEN, sides: { L: truthLeft ? truth : wrong, R: truthLeft ? wrong : truth }, chosen: null };
  sp.noGen.push([sp.fork.d0 - 380, sp.D + 10]);
  sp.events.push({ at: sp.D * rng.range(0.2, 0.28), kind: 'app' });
  if (!spec.mods.noDurchsage) sp.events.push({ at: sp.D * rng.range(0.42, 0.5), kind: 'durchsage' });
}

function mkObs(sp, type, lanes, extra) {
  const { rng } = sp;
  const o = { type, lanes, d: 0, hit: false, passed: false, t: rng.next() * 10, x: (LANES[lanes[0]] + LANES[lanes.at(-1)]) / 2, ...extra };
  if (type === 'pigeons') {
    o.flee = sp.spec.mods.pigeonsFlee || rng.chance(0.4); o.fled = false; o.fly = 0;
    o.birds = [[-17, 3], [0, -5], [16, 4]].map(([dx, dy]) => ({ dx, dy, face: rng.chance(0.5) ? -1 : 1, fx: rng.range(-1.3, 1.3), ph: rng.range(0, 6) }));
  } else if (type === 'suitcase') {
    o.from = lanes[0]; o.mv = 0; o.color = rng.int(0, 5); o.hx = 0; o.hy = 0; o.rot = 0; o.vx = 0; o.vy = 0; o.vr = 0;
  } else if (type === 'group') {
    o.jostle = 0; o.part = 0;
    o.people = [-68, -34, 0, 34, 68].map((dx, i) => ({ dx: dx + rng.range(-5, 5), dy: rng.range(-9, 9), c: rng.int(0, 6), hair: rng.int(0, 5),
      skin: rng.int(0, 4), cap: rng.chance(0.3), phone: i !== 2 && rng.chance(0.35), guide: i === 2 }));
    o.people.sort((a, b) => a.dy - b.dy);
  } else if (type === 'pillar') {
    o.poster = rng.int(0, 3);
  }
  return o;
}

// Rows of obstacles; every row leaves a lane free and gaps grow when the free lane jumps sides.
function generate(sp, from, to) {
  const { rng, spec } = sp;
  const L = spec.level + 1;
  let d = from, free = [0, 1, 2];
  for (;;) {
    const kind = rng.weighted([['pillar', 3], ['pigeons', 2.2], ['suitcase', 1.6], ['group', 1.6], ['double', 0.6 + 0.3 * L]]);
    const row = [];
    let rowFree;
    if (kind === 'group') {
      const a = rng.int(0, 1);
      row.push(mkObs(sp, 'group', [a, a + 1]));
      rowFree = [a === 0 ? 2 : 0];
    } else if (kind === 'double') {
      const f = rng.int(0, 2);
      rowFree = [f];
      for (let l = 0; l < 3; l++) if (l !== f) row.push(mkObs(sp, rng.pick(['pillar', 'pigeons', 'pillar']), [l]));
    } else if (kind === 'suitcase') {
      const a = rng.int(0, 2), b = a === 1 ? rng.pick([0, 2]) : 1;
      row.push(mkObs(sp, 'suitcase', [a], { to: b }));
      rowFree = [3 - a - b];
    } else {
      const a = rng.int(0, 2);
      row.push(mkObs(sp, kind, [a]));
      rowFree = [0, 1, 2].filter(l => l !== a);
    }
    let move = 2;
    for (const a of free) for (const b of rowFree) move = Math.min(move, Math.abs(a - b));
    const gap = (Math.max(175, 290 - 10 * L) + rng.range(-15, 45)) / spec.mods.density + (move === 2 ? 60 : move === 1 ? 15 : 0);
    d += gap;
    for (const [a, b] of sp.noGen) if (d > a && d < b) { d = b + rng.range(20, 80); free = [0, 1, 2]; }
    if (d > to) break;
    for (const o of row) { o.d = d; sp.obstacles.push(o); }
    if (rng.chance(0.55)) sp.pickups.push({ d, lane: rng.pick(rowFree), taken: false, t: rng.next() * 6 });
    free = rowFree;
  }
}

export function steer(sp, dir) {
  if (!['intro', 'run'].includes(sp.phase) || sp.lock !== null) return;
  const p = sp.player;
  const nl = Math.max(0, Math.min(2, p.lane + dir));
  if (nl !== p.lane) { p.prevLane = p.lane; p.changeT = sp.time; p.lane = nl; }
}

const collidable = o => !o.hit && !(o.type === 'pigeons' && o.fled);
function overlaps(sp, o, oy) {
  const [hw, hh] = BOX[o.type];
  return Math.abs(o.x - sp.player.x) < hw + PHW - 2 && Math.abs(oy - PLAYER_Y) < hh + PHH;
}

function advance(sp, v, dt) {
  sp.curV = v;
  sp.s += v * dt;
  sp.player.phase += dt * (7 + v * 0.03);
  for (const o of sp.obstacles) updateObs(sp, o, dt);
  sp.obstacles = sp.obstacles.filter(o => screenY(sp, o.d) < H + 140);
}

function updateObs(sp, o, dt) {
  o.t += dt;
  const dist = o.d - sp.s;
  if (o.type === 'pigeons') {
    if (o.flee && !o.fled && dist < 150 && sp.phase === 'run') { o.fled = true; sp.fx.push({ type: 'coo' }); }
    if (o.fled) o.fly += dt;
  } else if (o.type === 'suitcase') {
    if (o.hit) { o.hx += o.vx * dt; o.hy += o.vy * dt; o.vy += 900 * dt; o.rot += o.vr * dt; }
    else if (dist < 380 && sp.phase === 'run') { o.mv = Math.min(1, o.mv + dt / 0.85); o.x = LANES[o.from] + (LANES[o.to] - LANES[o.from]) * (1 - Math.pow(1 - o.mv, 3)); }
  } else if (o.type === 'group') {
    o.jostle = Math.max(0, o.jostle - dt * 1.5);
    if (sp.spec.mods.groupsYield && dist < 260) o.part = Math.min(1, o.part + dt * 3);
  }
}

function hit(sp, o) {
  const p = sp.player;
  o.hit = true;
  if (o.type === 'group' && sp.spec.mods.groupsYield) {
    sp.fx.push({ type: 'text', str: 'Entschuldigung!', col: '#8fd3ff' });
    return;
  }
  sp.hits++;
  if (sp.spec.mods.softHits) p.slow = 0.5; else p.stun = STUN;
  if (o.type === 'pigeons') o.fled = true;
  if (o.type === 'suitcase') { o.vx = (o.x <= p.x ? -1 : 1) * (220 + sp.rng.next() * 80); o.vy = -280; o.vr = 10 * Math.sign(o.vx); }
  if (o.type === 'group') o.jostle = 1;
  sp.fx.push({ type: 'hit', obstacle: o.type, soft: sp.spec.mods.softHits });
}

function nearMiss(sp) {
  sp.slowmo = 0.25;
  sp.fx.push({ type: 'near' });
}

function updateFork(sp) {
  const f = sp.fork, p = sp.player;
  if (!f || f.chosen || sp.s < f.d0) return;
  if (p.lane === 1) {
    p.lane = p.x < 180 ? 0 : p.x > 180 ? 2 : sp.rng.chance(0.5) ? 0 : 2;
    sp.hits++;
    p.stun = STUN * 0.8;
    sp.fx.push({ type: 'wall' });
  }
  f.chosen = p.lane === 0 ? 'L' : 'R';
  sp.lock = p.lane;
  sp.wrongSide = f.sides[f.chosen] !== sp.gleis.truth;
}

function updateRun(sp, dt) {
  const p = sp.player, mods = sp.spec.mods;
  let mul = 1;
  if (p.boost > 0) { p.boost -= dt; mul *= 1.5; }
  if (p.slow > 0) { p.slow -= dt; mul *= 0.6; }
  if (p.stun > 0) { p.stun -= dt; mul *= 1 - 2 * Math.pow(Math.max(0, p.stun) / STUN, 1.3); }
  p.amp += (1 - p.amp) * Math.min(1, dt * 6);
  advance(sp, sp.v * mul, dt);
  sp.timeLeft -= dt;
  sp.elapsed += dt;
  while (sp.events.length && sp.s >= sp.events[0].at) {
    const e = sp.events.shift();
    sp.fx.push({ type: e.kind, gleis: sp.gleis[e.kind] });
  }
  updateFork(sp);
  if (sp.lock !== null) p.lane = sp.lock;
  if (p.stun <= 0) {
    for (const o of sp.obstacles) {
      if (!collidable(o)) continue;
      const oy = screenY(sp, o.d);
      if (oy > PLAYER_Y - 60 && oy < PLAYER_Y + 60 && overlaps(sp, o, oy)) { hit(sp, o); break; }
    }
  }
  for (const o of sp.obstacles) {
    if (o.passed || screenY(sp, o.d) <= PLAYER_Y + 8) continue;
    o.passed = true;
    if (!collidable(o) || p.stun > 0) continue;
    const hw = BOX[o.type][0];
    const gap = Math.abs(o.x - p.x) - hw - PHW;
    const dodged = sp.time - p.changeT < 0.35 && Math.abs(o.x - LANES[p.prevLane]) < hw + PHW;
    if (gap < 16 || dodged) nearMiss(sp);
  }
  for (const it of sp.pickups) {
    if (it.taken) continue;
    const oy = screenY(sp, it.d);
    if (Math.abs(oy - PLAYER_Y) < 26 && Math.abs(LANES[it.lane] - p.x) < 30) {
      it.taken = true;
      sp.pfand++;
      sp.fx.push({ type: 'coin', x: LANES[it.lane] });
    }
  }
  sp.pickups = sp.pickups.filter(it => !it.taken && screenY(sp, it.d) < H + 60);
  if (sp.s >= sp.D) {
    sp.s = sp.D;
    if (sp.wrongSide) { setPhase(sp, 'wrong'); sp.wrongPlatform = true; sp.fx.push({ type: 'wrong' }); }
    else { setPhase(sp, 'board'); sp.fx.push({ type: 'board' }); }
  } else if (sp.timeLeft <= 0) {
    if (sp.bahncardLeft > 0) {
      sp.bahncardLeft--;
      sp.bahncardUsed = true;
      sp.timeLeft += SEC_PER_MIN;
      sp.fx.push({ type: 'bahncard' });
    } else {
      sp.elapsed += sp.timeLeft;
      sp.timeLeft = 0;
      sp.missV = sp.curV;
      setPhase(sp, 'missed');
      sp.fx.push({ type: 'missed' });
    }
  }
}

function backtrack(sp) {
  sp.wrongSide = false;
  sp.fork = null;
  sp.lock = null;
  sp.noGen = [];
  const back = 650;
  sp.s = sp.D - back;
  sp.obstacles = [];
  sp.pickups = [];
  generate(sp, sp.s + 260, sp.D - 150);
  sp.gleis.shown = sp.gleis.truth;
  sp.trainX = 0; sp.trainV = 0; sp.doors = 1;
  sp.fx.push({ type: 'backtrack', gleis: sp.gleis.truth });
  setPhase(sp, 'run');
}

function setPhase(sp, phase) { sp.phase = phase; sp.t = 0; }

function finish(sp, made) {
  const bonus = made && sp.hits === 0 ? CLEAN_BONUS : 0;
  sp.result = {
    made, elapsed: sp.elapsed, hits: sp.hits, bahncardUsed: sp.bahncardUsed, wrongPlatform: sp.wrongPlatform,
    money: Math.round((sp.pfand + bonus) * sp.spec.mods.moneyMul),
  };
  setPhase(sp, 'done');
}

export function updateSprint(sp, dt) {
  if (sp.result) return;
  if (sp.slowmo > 0) { sp.slowmo = Math.max(0, sp.slowmo - dt); dt *= 0.35; }
  sp.time += dt;
  sp.t += dt;
  const p = sp.player;
  p.x += (LANES[p.lane] - p.x) * Math.min(1, dt * 16);
  switch (sp.phase) {
    case 'intro':
      p.amp += (0.15 - p.amp) * Math.min(1, dt * 6);
      p.phase += dt * 4;
      if (sp.t >= INTRO) {
        setPhase(sp, 'run');
        if (sp.spec.mods.boostStart) { p.boost = 2.5; sp.fx.push({ type: 'boost' }); }
        sp.fx.push({ type: 'go' });
      }
      break;
    case 'run': updateRun(sp, dt); break;
    case 'wrong':
      sp.timeLeft -= dt;
      sp.elapsed += dt;
      p.amp += (0 - p.amp) * Math.min(1, dt * 6);
      if (sp.timeLeft <= 0) { sp.elapsed += sp.timeLeft; sp.timeLeft = 0; setPhase(sp, 'missed'); sp.missV = 0; sp.fx.push({ type: 'missed' }); }
      else if (sp.t > WRONG_T) backtrack(sp);
      break;
    case 'board':
      p.board = Math.min(1, sp.t / 0.45);
      p.phase += dt * 12;
      p.amp = 1 - p.board;
      if (sp.t > 0.5) sp.doors = Math.max(0, 1 - (sp.t - 0.5) / 0.3);
      if (sp.t > 0.95) { sp.trainV += 560 * dt; sp.trainX += sp.trainV * dt; }
      if (sp.t > BOARD_T) finish(sp, true);
      break;
    case 'missed': {
      sp.missV *= Math.max(0, 1 - dt * 2.8);
      p.amp += (0 - p.amp) * Math.min(1, dt * 3);
      let v = sp.missV;
      if (sp.s + v * dt > sp.D - 40) v = Math.max(0, (sp.D - 40 - sp.s) / dt);
      advance(sp, v, dt);
      sp.doors = Math.max(0, 1 - sp.t / 0.35);
      if (sp.t > 0.4) { sp.trainV += 460 * dt; sp.trainX += sp.trainV * dt; }
      if (sp.t > MISSED_T) finish(sp, false);
      break;
    }
  }
}
