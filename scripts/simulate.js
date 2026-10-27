// Balancing check: a bot plays many journeys. Usage: node scripts/simulate.js [runs] [region] [stufe] [skill 0..1]
import { createRun, departures, needMinutes, sprintSpec, completeSprint, kioskOffers, buyItem, result } from '../src/logic/run.js';
import { createSprint, updateSprint, steer, screenY, PLAYER_Y } from '../src/logic/sprint.js';
import { makeRng } from '../src/logic/rng.js';

const [runs = 400, region = 'de', stufe = 0, skill = 0.85] = process.argv.slice(2).map((v, i) => (i === 1 ? v : Number(v)));

function bot(sp, rng, mem) {
  if (sp.phase !== 'run' || sp.lock !== null) return;
  mem.cool -= 1 / 60;
  if (mem.cool > 0) return;
  mem.cool = 0.12 + rng.next() * 0.15;
  const known = [sp.gleis.tafel];
  if (sp.events.every(e => e.kind !== 'app')) known.push(sp.gleis.app);
  if (!sp.spec.mods.noDurchsage && sp.events.every(e => e.kind !== 'durchsage')) known.push(sp.gleis.durchsage);
  if (sp.fork && sp.s > sp.fork.d0 - 320) {
    const votes = {};
    for (const g of known) votes[g] = (votes[g] || 0) + 1;
    // attentive bots read the trust cues, the rest go with the majority
    const trusted = ['tafel', 'app', 'durchsage'].filter(k => sp.gleis.good[k] && known.includes(sp.gleis[k]));
    if (mem.attentive ??= rng.next() < skill) for (const k of trusted) votes[sp.gleis[k]] = (votes[sp.gleis[k]] || 0) + 10;
    const pickG = Number(Object.entries(votes).sort((a, b) => b[1] - a[1])[0][0]);
    const want = sp.fork.sides.L === pickG ? 0 : 2;
    if (sp.player.lane !== want) steer(sp, want < sp.player.lane ? -1 : 1);
    return;
  }
  const ahead = sp.obstacles.filter(o => !o.hit && !(o.type === 'pigeons' && o.fled) && o.d > sp.s && o.d - sp.s < 230);
  if (!ahead.length) return;
  const rowD = Math.min(...ahead.map(o => o.d));
  if (mem.row !== rowD) { mem.row = rowD; mem.blind = rng.next() > skill; }
  if (mem.blind) return;
  const blocked = new Set();
  for (const o of ahead.filter(o => o.d === rowD)) {
    if (o.type === 'suitcase') { blocked.add(o.from); blocked.add(o.to); } else o.lanes.forEach(l => blocked.add(l));
  }
  const lane = sp.player.lane;
  if (!blocked.has(lane)) return;
  const free = [0, 1, 2].filter(l => !blocked.has(l)).sort((a, b) => Math.abs(a - lane) - Math.abs(b - lane));
  if (free.length) steer(sp, free[0] < lane ? -1 : 1);
}

const stats = { scores: [], stars: [0, 0, 0, 0], sprints: 0, made: 0, missedLegs: 0, money: [], types: {}, hits: 0, km: [] };
for (let i = 0; i < runs; i++) {
  const rng = makeRng(9000 + i);
  const run = createRun({ seed: 5000 + i, regionId: region, stufe });
  for (let guard = 0; guard < 60 && !run.done; guard++) {
    const node = run.net.nodes[run.at];
    if (node.kind === 'kiosk' && !run._k?.[run.at]) {
      (run._k ||= {})[run.at] = true;
      for (const o of kioskOffers(run)) if (run.money - o.price >= 20) buyItem(run, o.id);
    }
    const deps = departures(run);
    const affordable = deps.filter(d => d.payable);
    const pool = affordable.length ? affordable : deps;
    const feasible = pool.filter(d => d.window >= needMinutes(run, d) - Number(process.env.BOLD ?? 0.8));
    const opt = (feasible.length ? feasible : pool).reduce((a, b) => (b.dep + b.ride < a.dep + a.ride ? b : a));
    const sp = createSprint({ ...sprintSpec(run, opt), level: run.sprints });
    const mem = { cool: 0 };
    while (!sp.result) { bot(sp, rng, mem); updateSprint(sp, 1 / 60); }
    stats.sprints++;
    stats.hits += sp.result.hits;
    if (sp.result.made) { stats.made++; stats.types[opt.type] = (stats.types[opt.type] || 0) + 1; }
    completeSprint(run, opt, sp.result);
  }
  const r = result(run);
  stats.scores.push(r.score);
  stats.stars[r.stars]++;
  stats.money.push(run.money);
  stats.km.push(run.km);
  stats.missedLegs += run.legs.reduce((a, l) => a + l.missed, 0);
}
const q = (arr, p) => arr.slice().sort((a, b) => a - b)[Math.floor(p * (arr.length - 1))];
console.log(`runs ${runs} region ${region} stufe ${stufe} skill ${skill}`);
console.log(`on time ${(100 * stats.stars[3] / runs).toFixed(1)}%  ⭐⭐ ${(100 * stats.stars[2] / runs).toFixed(1)}%  ⭐ ${(100 * stats.stars[1] / runs).toFixed(1)}%`);
console.log(`score p10 ${q(stats.scores, 0.1)}  median ${q(stats.scores, 0.5)}  p90 ${q(stats.scores, 0.9)}`);
console.log(`sprints made ${(100 * stats.made / stats.sprints).toFixed(1)}%  missed per run ${(stats.missedLegs / runs).toFixed(2)}  hits per sprint ${(stats.hits / stats.sprints).toFixed(2)}`);
console.log(`end money median ${q(stats.money, 0.5)}  km median ${q(stats.km, 0.5)}  boarded`, stats.types);
