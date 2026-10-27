import { test } from 'node:test';
import assert from 'node:assert/strict';
import { generateNetwork } from '../src/logic/network.js';
import { REGIONS, CITIES } from '../src/logic/content.js';

const SEEDS = Array.from({ length: 60 }, (_, i) => 1000 + i * 7919);

test('same seed and region give the same network', () => {
  assert.deepEqual(generateNetwork(123, 'de'), generateNetwork(123, 'de'));
});

for (const region of ['nord', 'de']) {
  test(`${region}: layered network, start and goal, 2-3 stations per middle layer`, () => {
    for (const seed of SEEDS) {
      const net = generateNetwork(seed, region);
      assert.equal(net.layers.length, REGIONS[region].layers + 2);
      assert.equal(net.layers[0].length, 1);
      assert.equal(net.layers.at(-1).length, 1);
      for (const layer of net.layers.slice(1, -1)) assert.ok(layer.length >= 2 && layer.length <= 3, `seed ${seed}`);
      assert.equal(net.nodes[net.startId].kind, 'start');
      assert.equal(net.nodes[net.goalId].kind, 'ziel');
      const names = Object.values(net.nodes).map(n => n.city);
      assert.equal(new Set(names).size, names.length, 'no city twice');
      if (region === 'nord') for (const c of names) assert.ok(CITIES[c][1] >= REGIONS.nord.minLat, c);
    }
  });

  test(`${region}: every station is reachable and can reach the goal, edges never cross`, () => {
    for (const seed of SEEDS) {
      const net = generateNetwork(seed, region);
      for (let i = 0; i < net.layers.length - 1; i++) {
        const out = net.edges.filter(e => net.nodes[e.from].layer === i);
        for (const id of net.layers[i]) assert.ok(out.some(e => e.from === id), `out ${seed}`);
        for (const id of net.layers[i + 1]) assert.ok(out.some(e => e.to === id), `in ${seed}`);
        const pos = id => net.layers[net.nodes[id].layer].indexOf(id);
        for (const a of out) for (const b of out) {
          const crossing = (pos(a.from) - pos(b.from)) * (pos(a.to) - pos(b.to)) < 0;
          assert.ok(!crossing, `crossing edges seed ${seed}`);
        }
      }
    }
  });
}

test('every edge has a RE line, some have ICB too, all lines have sane timetable data', () => {
  let icb = 0;
  for (const seed of SEEDS) {
    const net = generateNetwork(seed, 'de');
    for (const e of net.edges) {
      assert.ok(e.km > 20);
      assert.ok(e.lines.some(l => l.type === 'RE'));
      for (const l of e.lines) {
        assert.ok(l.phase >= 0 && l.phase < l.takt);
        assert.ok(l.ride > 0 && l.price > 0);
        if (l.type === 'ICB') { icb++; assert.ok(l.ride < e.lines.find(x => x.type === 'RE').ride); }
      }
    }
  }
  assert.ok(icb > 50);
});

test('middle layers contain a kiosk somewhere early', () => {
  for (const seed of SEEDS) {
    const net = generateNetwork(seed, 'de');
    const early = [...net.layers[1], ...net.layers[2]].map(id => net.nodes[id].kind);
    assert.ok(early.includes('kiosk'), `seed ${seed}`);
  }
});

test('the timetable has a planned arrival after the start and a buffer for the appointment', () => {
  for (const seed of SEEDS) {
    const net = generateNetwork(seed, 'de');
    assert.ok(net.nominalArrival > net.startClock + 120);
    assert.ok(net.buffer >= REGIONS.de.buffer[0] && net.buffer <= REGIONS.de.buffer[1]);
  }
});

test('generation never fails, also for unusual seeds', () => {
  for (const region of ['nord', 'de']) for (let s = 0; s < 3000; s++) generateNetwork(s * 7919 + 13, region);
});
