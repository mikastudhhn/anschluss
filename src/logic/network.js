// Builds one journey: a layered rail network from start to goal with a timetable and an appointment.
import { makeRng, hashOf } from './rng.js';
import { CITIES, REGIONS, LINES, OCCASIONS, EVENTS, SPRINT_DIST, SPRINT_SPEED, SEC_PER_MIN, MIN_WINDOW } from './content.js';

const KM_PER_UNIT = 111;
const xy = c => [CITIES[c][0] * 0.63, CITIES[c][1]];
export const cityDist = (a, b) => { const A = xy(a), B = xy(b); return Math.hypot(A[0] - B[0], A[1] - B[1]); };
export const cityKm = (a, b) => Math.round(cityDist(a, b) * KM_PER_UNIT);
export const baseNeedMinutes = size => SPRINT_DIST[size] / SPRINT_SPEED / SEC_PER_MIN + 1;
const mod = (a, n) => ((a % n) + n) % n;

export function generateNetwork(seed, regionId) {
  const region = REGIONS[regionId];
  const rng = makeRng(hashOf(seed, regionId, 'net'));
  const pool = Object.keys(CITIES).filter(c => CITIES[c][1] >= region.minLat);
  for (let tries = 0; tries < 500; tries++) {
    const cities = pickCities(rng, pool, region);
    if (cities) return build(rng, cities, seed, regionId);
  }
  throw new Error(`no network for seed ${seed}`);
}

function pickCities(rng, pool, region) {
  const start = rng.pick(pool);
  const goals = pool.filter(c => cityDist(start, c) >= region.minTrip);
  if (!goals.length) return null;
  const goal = rng.pick(goals);
  const [sx, sy] = xy(start), [gx, gy] = xy(goal);
  const ex = gx - sx, ey = gy - sy, L2 = ex * ex + ey * ey, L = Math.sqrt(L2);
  const geo = c => {
    const [cx, cy] = xy(c);
    return { t: ((cx - sx) * ex + (cy - sy) * ey) / L2, lat: ((cx - sx) * ey - (cy - sy) * ex) / L };
  };
  const used = [start, goal];
  const layers = [[start]];
  const n = region.layers;
  for (let i = 1; i <= n; i++) {
    const t = i / (n + 1);
    const cands = rng.shuffle(pool.filter(c => {
      if (used.includes(c)) return false;
      const g = geo(c);
      return Math.abs(g.t - t) < 0.11 && Math.abs(g.lat) < Math.min(1.2, Math.max(0.75, 0.24 * L));
    }));
    const want = rng.int(2, 3), layer = [];
    for (const c of cands) {
      if (layer.length >= want) break;
      if (used.every(u => cityDist(u, c) >= 0.38) && layer.every(o => cityDist(o, c) >= 0.5)) layer.push(c);
    }
    if (layer.length < 2) return null;
    layer.sort((a, b) => geo(a).lat - geo(b).lat);
    used.push(...layer);
    layers.push(layer);
  }
  layers.push([goal]);
  return layers;
}

function build(rng, cityLayers, seed, regionId) {
  const nodes = {}, layers = [], edges = [];
  const last = cityLayers.length - 1;
  cityLayers.forEach((cities, li) => {
    const taken = new Set();
    layers.push(cities.map((city, idx) => {
      const id = `n${li}_${idx}`;
      // a layer never offers the same special stop twice, so every fork is a real choice
      const kind = li === 0 ? 'start' : li === last ? 'ziel'
        : rng.weighted([['bahnhof', 40], ['kiosk', 25], ['event', 22], ['lounge', 13]].filter(([k]) => !taken.has(k)));
      if (kind !== 'bahnhof') taken.add(kind);
      nodes[id] = { id, city, layer: li, kind, size: CITIES[city][2] };
      if (kind === 'event') nodes[id].event = rng.pick(Object.keys(EVENTS));
      return id;
    }));
  });
  const early = [...layers[1], ...layers[2]];
  if (!early.some(id => nodes[id].kind === 'kiosk')) {
    const node = nodes[rng.pick(layers[1])];
    node.kind = 'kiosk';
    delete node.event;
  }

  for (let li = 0; li < last; li++) {
    const A = layers[li], B = layers[li + 1];
    const pos = (j, len) => (len === 1 ? 0.5 : j / (len - 1));
    const nearest = (j, from, to) => {
      let best = 0;
      for (let k = 1; k < to.length; k++) {
        if (Math.abs(pos(k, to.length) - pos(j, from.length)) < Math.abs(pos(best, to.length) - pos(j, from.length))) best = k;
      }
      return best;
    };
    const pairs = [];
    const has = (a, b) => pairs.some(([x, y]) => x === a && y === b);
    const crosses = (a, b) => pairs.some(([x, y]) => (a - x) * (b - y) < 0);
    A.forEach((_, a) => { const b = nearest(a, A, B); if (!has(a, b)) pairs.push([a, b]); });
    B.forEach((_, b) => { if (!pairs.some(([, y]) => y === b)) { const a = nearest(b, B, A); pairs.push([a, b]); } });
    for (const [a, b0] of pairs.slice()) {
      for (const b of [b0 - 1, b0 + 1]) {
        if (b < 0 || b >= B.length || has(a, b) || crosses(a, b) || !rng.chance(0.45)) continue;
        pairs.push([a, b]);
      }
    }
    pairs.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    for (const [a, b] of pairs) {
      const from = A[a], to = B[b], km = cityKm(nodes[from].city, nodes[to].city);
      const types = km >= 60 && rng.chance(0.6) ? ['ICB', 'RE'] : ['RE'];
      edges.push({
        id: `e_${from}_${to}`, from, to, km,
        lines: types.map(type => {
          const L = LINES[type];
          return { type, number: rng.int(L.numbers[0], L.numbers[1]), ride: Math.round(L.ride(km)),
            price: Math.max(1, Math.round(L.price(km))), takt: L.takt, phase: 0 };
        }),
      });
    }
  }

  // Timetable: on the fastest planned path each transfer is tight but doable.
  const startClock = rng.int(7, 10) * 60 + rng.int(0, 11) * 5;
  const nominal = { [layers[0][0]]: startClock };
  for (let li = 0; li < last; li++) {
    for (const id of layers[li]) {
      const t0 = nominal[id], need = baseNeedMinutes(nodes[id].size);
      for (const e of edges.filter(x => x.from === id)) {
        for (const line of e.lines) {
          const extra = rng.range(...LINES[line.type].windowExtra);
          const dep = Math.round(t0 + Math.max(MIN_WINDOW + 1, need + extra));
          line.phase = mod(dep, line.takt);
          const arr = dep + line.ride;
          if (nominal[e.to] === undefined || arr < nominal[e.to]) nominal[e.to] = arr;
        }
      }
    }
  }
  const goalId = layers[last][0];
  return {
    seed, regionId, layers, nodes, edges, startId: layers[0][0], goalId,
    startClock, nominalArrival: nominal[goalId], buffer: rng.int(...REGIONS[regionId].buffer),
    occasion: rng.int(0, OCCASIONS.length - 1),
  };
}
