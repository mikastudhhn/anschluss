import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, departures, taxiOptions, needMinutes, sprintSpec, completeSprint, stroll, takeTaxi,
  kioskOffers, buyItem, loungeJob, resolveEvent, result, referenceArrival, eventPending,
} from '../src/logic/run.js';
import { SEC_PER_MIN, MIN_WINDOW, SPRINT_DIST, LOUNGE, ITEMS } from '../src/logic/content.js';

const fresh = (o = {}) => createRun({ seed: 99, regionId: 'de', ...o });
const made = (run, opt) => completeSprint(run, opt, { made: true, elapsed: 5, money: 0, bahncardUsed: false });

test('start money depends on character, stufe and perks', () => {
  assert.equal(fresh().money, 30);
  assert.equal(fresh({ characterId: 'studentin' }).money, 15);
  assert.ok(fresh({ characterId: 'studentin' }).items.includes('deutschlandticket'));
  assert.equal(fresh({ stufe: 2 }).money, 20);
  assert.equal(fresh({ perks: ['startgeld'] }).money, 35);
});

test('the appointment is reachable: a flawless reference journey arrives before it, same for every character', () => {
  for (let seed = 1; seed < 40; seed++) {
    const run = createRun({ seed, regionId: 'de' });
    assert.equal(run.termin % 5, 0);
    assert.ok(run.termin >= referenceArrival(run.net, seed) + run.net.buffer);
    assert.equal(createRun({ seed, regionId: 'de', characterId: 'rentner' }).termin, run.termin);
  }
});

test('stufe 4 moves the appointment 8 minutes earlier', () => {
  assert.equal(fresh({ stufe: 4 }).termin, fresh().termin - 8);
});

test('departures are sorted, deterministic and never closer than the minimum window', () => {
  const run = fresh();
  const deps = departures(run);
  assert.ok(deps.length >= 1);
  assert.deepEqual(deps, departures(fresh()));
  for (let i = 0; i < deps.length; i++) {
    assert.ok(deps[i].window >= MIN_WINDOW);
    assert.equal(deps[i].window, deps[i].dep - run.clock);
    assert.equal(deps[i].dep, deps[i].plannedDep + deps[i].depDelay);
    if (i) assert.ok(deps[i].dep >= deps[i - 1].dep);
  }
});

test('RE is free with Deutschlandticket, the pensioner pays half', () => {
  const re = r => departures(r).find(d => d.type === 'RE');
  const base = re(fresh()).price;
  assert.equal(re(fresh({ characterId: 'studentin' })).price, 0);
  assert.equal(re(fresh({ characterId: 'rentner' })).price, Math.round(base * 0.5));
});

test('a made sprint boards the train, pays, travels and logs the leg', () => {
  const run = fresh();
  const opt = departures(run)[0];
  const before = { money: run.money, clock: run.clock };
  const res = made(run, opt);
  assert.equal(res.made, true);
  assert.equal(run.at, opt.to);
  assert.equal(run.money, before.money - opt.price);
  assert.equal(run.clock, opt.dep + opt.ride + res.arrivalDelay);
  assert.ok(run.km > 20);
  assert.equal(run.legs.length, 1);
});

test('a missed sprint keeps you at the station, costs time and the next train of that line is later', () => {
  const run = fresh();
  const opt = departures(run)[0];
  const res = completeSprint(run, opt, { made: false, elapsed: opt.window * SEC_PER_MIN, money: 2, bahncardUsed: false });
  assert.equal(res.made, false);
  assert.equal(run.at, run.net.startId);
  assert.equal(run.money, 32);
  assert.ok(run.clock >= opt.dep);
  const again = departures(run).find(d => d.edgeId === opt.edgeId && d.lineIdx === opt.lineIdx);
  assert.ok(again.plannedDep > opt.plannedDep);
  made(run, again);
  assert.equal(run.legs[0].missed, 1);
});

test('without money you ride without ticket and may get caught', () => {
  let caught = 0, free = 0;
  for (let seed = 1; seed <= 80; seed++) {
    const run = createRun({ seed, regionId: 'nord' });
    run.money = 0;
    const opt = departures(run)[0];
    assert.equal(opt.payable, false);
    const res = made(run, opt);
    assert.equal(run.money, 0);
    if (res.caught) caught++; else free++;
  }
  assert.ok(caught > 5 && free > 30, `${caught}/${free}`);
});

test('need and sprint spec follow station size, character and items', () => {
  const run = fresh();
  const opt = departures(run)[0];
  const size = run.net.nodes[run.at].size;
  const spec = sprintSpec(run, opt);
  assert.equal(spec.distance, Math.round(SPRINT_DIST[size] * 0.9));
  assert.equal(spec.timeLimit, opt.window * SEC_PER_MIN);
  const slow = needMinutes(createRun({ seed: 99, regionId: 'de', characterId: 'rentner' }), opt);
  assert.ok(slow > needMinutes(run, opt));
  run.items.push('laufschuhe');
  assert.ok(sprintSpec(run, opt).speedMul > 1);
});

test('strolling is only allowed with plenty of time', () => {
  const run = fresh();
  const tight = departures(run).find(d => d.window < 2 * needMinutes(run, d));
  if (tight) assert.throws(() => stroll(run, tight));
  run.clock -= 60;
  const relaxed = departures(run).find(d => d.window >= 2 * needMinutes(run, d));
  assert.ok(relaxed);
  stroll(run, relaxed);
  assert.equal(run.at, relaxed.to);
});

test('taxi leaves now, costs money and needs enough of it', () => {
  const run = fresh();
  const t = taxiOptions(run)[0];
  run.money = t.price - 1;
  assert.equal(taxiOptions(run)[0].payable, false);
  assert.throws(() => takeTaxi(run, t.to));
  run.money = t.price + 5;
  const clock = run.clock;
  takeTaxi(run, t.to);
  assert.equal(run.money, 5);
  assert.equal(run.clock, clock + t.ride);
  assert.equal(run.legs[0].emoji, '🚕');
});

test('kiosk offers unowned items, buying needs money and the regular-customer perk halves the first buy', () => {
  const run = fresh({ perks: ['stammkunde'] });
  const offers = kioskOffers(run);
  assert.equal(offers.length, 3);
  assert.equal(kioskOffers(fresh({ perks: ['kiosk4'] })).length, 4);
  const first = offers[0];
  assert.equal(first.price, Math.ceil(ITEMS[first.id].price / 2));
  const before = run.money;
  assert.ok(buyItem(run, first.id));
  assert.equal(run.money, before - first.price);
  assert.equal(kioskOffers(run)[0].price, ITEMS[kioskOffers(run)[0].id].price);
  assert.ok(!kioskOffers(run).some(o => o.id === first.id));
  run.money = 0;
  assert.equal(buyItem(run, offers[1].id), false);
});

test('lounge trades time for money', () => {
  const run = fresh();
  const { money, clock } = run;
  loungeJob(run);
  assert.equal(run.money, money + LOUNGE.pay);
  assert.equal(run.clock, clock + LOUNGE.minutes);
  const vip = fresh({ perks: ['lounge'] });
  loungeJob(vip);
  assert.equal(vip.money, 30 + Math.round(LOUNGE.pay * 1.5));
});

test('events: keep the wallet, pay the musician, wait out the signal failure', () => {
  const run = fresh();
  run.net.nodes[run.at].event = 'fundsache';
  resolveEvent(run, 0);
  assert.equal(run.money, 45);

  run.net.nodes[run.at].event = 'musiker';
  run.used = [];
  resolveEvent(run, 0);
  assert.equal(run.money, 42);
  const opt = departures(run)[0];
  assert.ok(sprintSpec(run, opt).speedMul > 1.1);
  made(run, opt);
  assert.equal(run.effects.ohrwurm, false);

  const run2 = fresh();
  run2.net.nodes[run2.at].event = 'stellwerk';
  const t0 = run2.clock;
  resolveEvent(run2, 0);
  for (const d of departures(run2)) assert.ok(d.dep >= t0 + 20);
});

test('bahncard: one use per journey, the gold perk gives two', () => {
  const plain = fresh();
  assert.equal(sprintSpec(plain, departures(plain)[0]).bahncard, 0);
  const run = fresh();
  run.money = 99;
  run.items.push('bahncard');
  assert.equal(sprintSpec(run, departures(run)[0]).bahncard, 1);
  const gold = fresh({ perks: ['goldcard'] });
  gold.items.push('bahncard');
  assert.equal(sprintSpec(gold, departures(gold)[0]).bahncard, 2);
  completeSprint(run, departures(run)[0], { made: true, elapsed: 5, money: 0, bahncardUsed: true });
  assert.equal(sprintSpec(run, departures(run)[0]).bahncard, 0);
});

test('fahrgastrechte refunds half the fare after 30 minutes delay', () => {
  for (let seed = 1; seed < 400; seed++) {
    const run = createRun({ seed, regionId: 'de' });
    run.items.push('fahrgastrechte');
    const opt = departures(run).find(d => d.price > 0);
    const before = run.money;
    const res = made(run, opt);
    if (res.arrivalDelay >= 30) {
      assert.equal(res.refund, Math.ceil(opt.price / 2));
      assert.equal(run.money, before - opt.price + res.refund);
      return;
    }
  }
  assert.fail('no 30 minute delay found');
});

test('a full journey ends at the goal with a score against the appointment', () => {
  const run = fresh();
  while (!run.done) made(run, departures(run)[0]);
  assert.equal(run.at, run.net.goalId);
  const r = result(run);
  assert.equal(r.score, run.termin - run.clock);
  assert.equal(r.stars, r.score >= 0 ? 3 : r.score >= -15 ? 2 : 1);
  assert.equal(r.line, run.legs.map(l => '🏃'.repeat(l.missed) + l.emoji).join(''));
  assert.equal(r.km, run.km);
});

test('events and the lounge can only be used once per station visit, even after a missed train', () => {
  const run = fresh();
  run.net.nodes[run.at].event = 'fundsache';
  assert.equal(eventPending(run), true);
  resolveEvent(run, 0);
  assert.equal(eventPending(run), false);
  const opt = departures(run)[0];
  completeSprint(run, opt, { made: false, elapsed: opt.window * SEC_PER_MIN, money: 0, bahncardUsed: false });
  resolveEvent(run, 0);
  assert.equal(run.money, 45, 'wallet only once');
  assert.equal(loungeJob(run), true);
  assert.equal(loungeJob(run), false);
  assert.equal(run.money, 45 + LOUNGE.pay);
});
