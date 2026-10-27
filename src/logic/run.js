// One journey from start to goal: money, clock, items and every decision between the sprints.
import { rngFor } from './rng.js';
import { generateNetwork, cityKm } from './network.js';
import {
  LINES, SEV, TAXI, RIDESHARE, MISSED_EMOJI, FARE_DODGE, ITEMS, CHARACTERS, START_MONEY, SEC_PER_MIN,
  MIN_WINDOW, SPRINT_DIST, SPRINT_SPEED, LOUNGE,
} from './content.js';

const has = (run, item) => run.items.includes(item);
const hasPerk = (run, perk) => run.perks.includes(perk);
const roll = (rng, table) => {
  const v = rng.weighted(table.map(([value, w], i) => [i, w]));
  const value = table[v][0];
  return Array.isArray(value) ? rng.int(value[0], value[1]) : value;
};

export function createRun({ seed, mode = 'free', day = null, characterId = 'pendler', stufe = 0, perks = [], regionId = 'nord' }) {
  const net = generateNetwork(seed, regionId);
  const termin = Math.ceil((referenceArrival(net, seed) + net.buffer) / 5) * 5 - (stufe >= 4 ? 8 : 0);
  return blankRun({ seed, mode, day, characterId, stufe, perks, regionId, net, termin });
}

// A flawless commuter who always takes the earliest comfortable arrival; the appointment is set from this.
export function referenceArrival(net, seed) {
  const run = blankRun({ seed, mode: 'ref', day: null, characterId: 'pendler', stufe: 0, perks: [], regionId: net.regionId, net, termin: 0 });
  run.money = Infinity;
  while (!run.done) {
    const deps = departures(run);
    const ok = deps.filter(d => d.window >= needMinutes(run, d) - 1);
    const pool = ok.length ? ok : deps;
    board(run, pool.reduce((a, b) => (b.dep + b.ride < a.dep + a.ride ? b : a)));
  }
  return run.clock;
}

function blankRun({ seed, mode, day, characterId, stufe, perks, regionId, net, termin }) {
  const ch = CHARACTERS[characterId];
  let money = ch.startMoney ?? START_MONEY;
  if (stufe >= 2) money -= 10;
  if (perks.includes('startgeld')) money += 5;
  return {
    seed, mode, day, characterId, stufe, perks: [...perks], regionId, net,
    at: net.startId, clock: net.startClock, money: Math.max(0, money), items: [...(ch.startItems || [])],
    bahncardUsed: 0, discountUsed: false, used: [], legs: [], path: [net.startId], km: 0, missed: 0, sprints: 0, hits: 0,
    effects: { ohrwurm: false, notBefore: 0 },
    termin, done: false,
  };
}

export const bahncardTotal = run => (has(run, 'bahncard') ? (hasPerk(run, 'goldcard') ? 2 : 1) : 0);

function fare(run, type, base) {
  if (type === 'RE' && has(run, 'deutschlandticket')) return 0;
  return CHARACTERS[run.characterId].ticketMul ? Math.round(base * CHARACTERS[run.characterId].ticketMul) : base;
}

function departureAt(run, edge, lineIdx, planned) {
  const line = edge.lines[lineIdx];
  const cancelP = LINES[line.type].cancel * (run.stufe >= 5 ? 2 : 1);
  const cancelled = rngFor(run.seed, edge.id, lineIdx, planned, 'x').chance(cancelP);
  let dep = planned + (cancelled ? 0 : roll(rngFor(run.seed, edge.id, lineIdx, planned, 'dep'), LINES[line.type].depDelay));
  dep = Math.max(dep, run.effects.notBefore);
  const type = cancelled ? 'SEV' : line.type;
  const price = fare(run, line.type, line.price);
  return {
    key: `${edge.id}:${lineIdx}:${planned}`, edgeId: edge.id, lineIdx, to: edge.to, city: run.net.nodes[edge.to].city,
    type, name: cancelled ? 'Ersatzbus' : `${line.type} ${line.number}`, plannedDep: planned, dep, depDelay: dep - planned,
    window: dep - run.clock, ride: cancelled ? Math.round(line.ride * SEV.rideMul) : line.ride,
    price, payable: run.money >= price, rel: cancelled ? 'fällt aus' : LINES[line.type].rel, cancelled,
  };
}

// Next departure of every line; if that one is out of reach, the one after it as well.
export function departures(run) {
  const out = [];
  for (const edge of run.net.edges.filter(e => e.from === run.at)) {
    edge.lines.forEach((line, lineIdx) => {
      let k = Math.floor((run.clock - 60 - line.phase) / line.takt);
      let found = 0;
      for (; found < 2; k++) {
        const d = departureAt(run, edge, lineIdx, line.phase + k * line.takt);
        if (d.window < MIN_WINDOW) continue;
        out.push(d);
        found++;
        if (d.window >= needMinutes(run, d)) break;
      }
    });
  }
  return out.sort((a, b) => a.dep - b.dep || a.key.localeCompare(b.key));
}

export function taxiOptions(run) {
  return run.net.edges.filter(e => e.from === run.at).map(e => {
    const price = Math.round(TAXI.price(e.km));
    return { key: `taxi:${e.to}`, to: e.to, city: run.net.nodes[e.to].city, price, ride: Math.round(TAXI.ride(e.km)), payable: run.money >= price };
  });
}

function speedMul(run) {
  let m = CHARACTERS[run.characterId].speedMul || 1;
  if (has(run, 'laufschuhe')) m *= 1.1;
  if (has(run, 'rollkoffer')) m *= 0.9;
  if (run.effects.ohrwurm) m *= 1.15;
  return m;
}

function sprintDistance(run, option) {
  const node = run.net.nodes[run.at];
  const d = SPRINT_DIST[node.size] * (CHARACTERS[run.characterId].distMul || 1) * (option.cancelled ? SEV.sprintMul : 1);
  return Math.round(d);
}

export function needMinutes(run, option) {
  return sprintDistance(run, option) / (SPRINT_SPEED * speedMul(run)) / SEC_PER_MIN + 1;
}

// Everything the sprint simulation needs; the run stays the single source of truth.
export function sprintSpec(run, option) {
  const ch = CHARACTERS[run.characterId];
  return {
    seed: rngFor(run.seed, run.at, option.key, run.sprints).next() * 4294967296 >>> 0,
    distance: sprintDistance(run, option),
    timeLimit: option.window * SEC_PER_MIN,
    speedMul: speedMul(run),
    size: run.net.nodes[run.at].size,
    level: run.sprints,
    bus: option.cancelled,
    train: { name: option.name, type: option.type, dest: option.city },
    clock: run.clock,
    bahncard: bahncardTotal(run) - run.bahncardUsed,
    mods: {
      boostStart: has(run, 'thermobecher'),
      groupsYield: !!ch.groupsYield || has(run, 'ellenbogen'),
      groupsPart: !!ch.groupsYield,
      pigeonsFlee: has(run, 'taubenfutter'),
      appTruth: has(run, 'powerbank'),
      noDurchsage: has(run, 'noisecancel'),
      softHits: has(run, 'noisecancel'),
      moneyMul: has(run, 'rollkoffer') ? 1.5 : 1,
      infoPenalty: run.stufe >= 1 ? 0.12 : 0,
      density: run.stufe >= 3 ? 1.25 : 1,
    },
  };
}

function travel(run, to, ride, emoji, km) {
  run.clock += ride;
  run.km += km;
  run.legs.push({ emoji, missed: run.missed, city: run.net.nodes[to].city });
  run.path.push(to);
  run.missed = 0;
  run.at = to;
  run.effects.notBefore = 0;
  if (to === run.net.goalId) run.done = true;
}

function board(run, option) {
  const edge = run.net.edges.find(e => e.id === option.edgeId);
  const line = edge.lines[option.lineIdx];
  const out = { made: true, arrivalDelay: 0, refund: 0, caught: false, dodged: !option.payable };
  if (option.payable) run.money -= option.price;
  run.clock = option.dep;
  if (!option.cancelled) out.arrivalDelay = roll(rngFor(run.seed, edge.id, option.lineIdx, option.plannedDep, 'ride'), LINES[line.type].rideDelay);
  if (out.dodged) out.caught = rngFor(run.seed, edge.id, option.plannedDep, 'control').chance(FARE_DODGE.risk);
  const penalty = out.caught ? FARE_DODGE.penalty : 0;
  if (has(run, 'fahrgastrechte') && out.arrivalDelay >= 30 && option.payable && option.price > 0) {
    out.refund = Math.ceil(option.price / 2);
    run.money += out.refund;
  }
  travel(run, option.to, option.ride + out.arrivalDelay + penalty, option.cancelled ? SEV.emoji : LINES[line.type].emoji, edge.km);
  return out;
}

export function completeSprint(run, option, { made, elapsed, money, bahncardUsed, hits = 0 }) {
  run.sprints++;
  run.hits += hits;
  run.money += Math.round(money);
  run.effects.ohrwurm = false;
  if (bahncardUsed) run.bahncardUsed++;
  if (!made) {
    run.clock += Math.ceil(elapsed / SEC_PER_MIN);
    run.missed++;
    return { made: false };
  }
  return board(run, option);
}

export const canStroll = (run, option) => option.window >= 2 * needMinutes(run, option);

export function stroll(run, option) {
  if (!canStroll(run, option)) throw new Error('not enough time to stroll');
  return board(run, option);
}

export function takeTaxi(run, to) {
  const t = taxiOptions(run).find(x => x.to === to);
  if (!t || !t.payable) throw new Error('taxi not affordable');
  run.money -= t.price;
  travel(run, to, t.ride, TAXI.emoji, cityKm(run.net.nodes[run.at].city, t.city));
}

export function kioskOffers(run) {
  const n = hasPerk(run, 'kiosk4') ? 4 : 3;
  const order = rngFor(run.seed, run.at, 'kiosk').shuffle(Object.keys(ITEMS));
  return order.filter(id => !has(run, id)).slice(0, n).map(id => ({ id, ...ITEMS[id], price: itemPrice(run, id) }));
}

export const itemPrice = (run, id) => (hasPerk(run, 'stammkunde') && !run.discountUsed ? Math.ceil(ITEMS[id].price / 2) : ITEMS[id].price);

export function buyItem(run, id) {
  const price = itemPrice(run, id);
  if (has(run, id) || run.money < price) return false;
  run.money -= price;
  run.items.push(id);
  if (hasPerk(run, 'stammkunde')) run.discountUsed = true;
  return true;
}

// Lounge and events are one-offs per station, also when you are stuck there after a missed train.
export const loungeUsed = run => run.used.includes(`lounge:${run.at}`);
export const eventPending = run => !!run.net.nodes[run.at].event && !run.used.includes(`event:${run.at}`);

export function loungeJob(run) {
  if (loungeUsed(run)) return false;
  run.used.push(`lounge:${run.at}`);
  run.money += Math.round(LOUNGE.pay * (hasPerk(run, 'lounge') ? 1.5 : 1));
  run.clock += LOUNGE.minutes;
  return true;
}

// Returns a short text describing what happened.
export function resolveEvent(run, choice) {
  if (!eventPending(run)) return '';
  run.used.push(`event:${run.at}`);
  const node = run.net.nodes[run.at];
  const rng = rngFor(run.seed, node.id, 'event');
  const outs = run.net.edges.filter(e => e.from === run.at);
  switch (node.event) {
    case 'mitfahr': {
      if (choice !== 0) return 'Du bleibst bei der Bahn.';
      const e = rng.pick(outs);
      const ride = Math.round(TAXI.ride(e.km) * rng.range(0.7, 1.6));
      travel(run, e.to, ride, RIDESHARE.emoji, e.km);
      return `Nach ${ride} Minuten bist du in ${run.net.nodes[e.to].city}.`;
    }
    case 'fundsache': {
      if (choice === 0) { run.money += 15; return '+15 €. Das Karma notiert sich das.'; }
      const gift = rng.shuffle(Object.keys(ITEMS)).find(id => !has(run, id));
      if (!gift) return 'Der Besitzer bedankt sich herzlich. Mehr nicht.';
      run.items.push(gift);
      return `Der Besitzer schenkt dir: ${ITEMS[gift].name}.`;
    }
    case 'stellwerk': {
      if (choice === 0) { run.effects.notBefore = run.clock + 20; return 'Du wartest. Alle Züge frühestens in 20 Minuten.'; }
      if (run.money < 12) { run.effects.notBefore = run.clock + 20; return 'Zu wenig Geld fürs Taxi. Du wartest.'; }
      run.money -= 12;
      const e = rng.pick(outs);
      travel(run, e.to, Math.round(TAXI.ride(e.km)), TAXI.emoji, e.km);
      return `Das Taxi bringt dich nach ${run.net.nodes[e.to].city}.`;
    }
    case 'musiker': {
      if (choice !== 0 || run.money < 3) return 'Du gehst weiter. Der Blues verfolgt dich trotzdem.';
      run.money -= 3;
      run.effects.ohrwurm = true;
      return 'Ohrwurm! Nächster Sprint +15 % Tempo.';
    }
    case 'automat': {
      if (choice !== 0) return 'Ehrlich währt am längsten. Angeblich.';
      run.money += 8;
      if (rng.chance(0.35)) { run.clock += 15; return '+8 €, aber die Security will deine Personalien. +15 Min.'; }
      return '+8 €. Keiner hat was gesehen.';
    }
  }
  return '';
}

export function result(run) {
  const score = run.termin - run.clock;
  return {
    score, stars: score >= 0 ? 3 : score >= -15 ? 2 : 1, km: run.km, money: run.money,
    line: run.legs.map(l => MISSED_EMOJI.repeat(l.missed) + l.emoji).join(''),
  };
}
