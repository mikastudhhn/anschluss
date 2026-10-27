// Controller: screen flow, input, storage and the sprint loop.
import { hashOf, dayNumber } from './logic/rng.js';
import { createRun, departures, sprintSpec, completeSprint, takeTaxi, buyItem, loungeJob, resolveEvent, result } from './logic/run.js';
import { createSprint, updateSprint, steer } from './logic/sprint.js';
import { newProgress, parseProgress, unlocked, recordRun, currentStreak } from './logic/progress.js';
import { shareText, encodeChallenge, challengeFromHash, cleanName } from './logic/share.js';
import { OCCASIONS, TAXI, MAX_STUFE } from './logic/content.js';
import {
  homeScreen, freeSheet, duelSheet, nameSheet, figurenScreen, planScreen, stationScreen, rideScreen, resultScreen, clock,
} from './ui/screens.js';
import { createSprintView, createRunnerPreview } from './ui/sprintView.js';
import { nodePoint } from './ui/mapView.js';
import { sfx, setSound, soundOn, unlock } from './ui/audio.js';

const KEY = 'anschluss.progress';
const load = () => { try { return parseProgress(localStorage.getItem(KEY)); } catch { return newProgress(); } };
const save = p => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: session only */ } };

const ui = document.getElementById('ui');
const stage = document.getElementById('stage');
const canvas = document.getElementById('sprint');

const app = {
  progress: load(), screen: 'home', sheet: null, sheetMsg: '', shareCtx: null, run: null, ns: null,
  setup: { regionId: 'nord', stufe: 0 }, challenge: challengeFromHash(location.hash),
  sprint: null, view: null, opt: null, paused: false, outcome: null,
};
if (!unlocked(app.progress).characters.includes(app.progress.character)) app.progress.character = 'pendler';
setSound(app.progress.sound);
document.fonts?.load('20px "Lilita One"');

let daily = null;
const dailyRun = day => createRun({ seed: hashOf('daily', day), mode: 'daily', day, regionId: 'de' });
const todaysRun = () => { const day = dayNumber(); if (daily?.day !== day) daily = dailyRun(day); return daily; };

// ---------- rendering ----------
let heroRaf = 0;
function render() {
  const keepScroll = ui.dataset.screen === app.screen ? ui.scrollTop : 0;
  const { progress, run } = app;
  const day = dayNumber();
  const sheets = {
    free: () => freeSheet({ progress, setup: app.setup }),
    duel: () => duelSheet({ progress, day }),
    name: () => nameSheet(progress, 'TEILEN', app.sheetMsg),
  };
  const sheetHtml = app.sheet ? sheets[app.sheet]() : '';
  let html = '';
  switch (app.screen) {
    case 'home': html = homeScreen({ progress, day, dailyRun: todaysRun(), challenge: app.challenge, soundOn: soundOn(), streak: currentStreak(progress, day), sheetHtml }); break;
    case 'figuren': html = figurenScreen({ progress }); break;
    case 'plan': html = planScreen(run); break;
    case 'station': html = stationScreen(run, app.ns); break;
    case 'result': html = resultScreen({ run, ...app.outcome, challenge: compareTo(run), progress, sheetHtml }); break;
  }
  ui.innerHTML = html;
  ui.dataset.screen = app.screen;
  ui.scrollTop = keepScroll;
  ui.hidden = false;
  stage.hidden = true;
  animateHero();
}

function animateHero() {
  cancelAnimationFrame(heroRaf);
  const hero = document.getElementById('hero');
  if (!hero) return;
  const draw = createRunnerPreview(hero, app.progress.character);
  const tick = now => { draw(now / 1000); heroRaf = requestAnimationFrame(tick); };
  heroRaf = requestAnimationFrame(tick);
}

function go(screen) { app.screen = screen; app.sheet = null; app.sheetMsg = ''; render(); }

function clearChallenge() {
  if (!compareTo(app.run)) return;
  app.challenge = null;
  try { history.replaceState(null, '', location.pathname); } catch { /* sandboxed embed */ }
}

const compareTo = run => (app.challenge && run && (run.mode === 'challenge' || run.mode === 'daily') && app.challenge.day === run.day ? app.challenge : null);

// ---------- journey flow ----------
function arrive(notice) {
  if (app.run.done) return finishRun();
  app.ns = { notice, eventResult: null, movedFrom: null, map: false };
  go('station');
}

function rideAnimation(fromId, emoji, notice) {
  const run = app.run;
  app.screen = 'ride';
  ui.innerHTML = rideScreen(run, { emoji, city: run.net.nodes[run.at].city });
  ui.dataset.screen = 'ride';
  ui.hidden = false;
  stage.hidden = true;
  const veh = document.getElementById('veh');
  const [x1, y1] = nodePoint(run.net, fromId), [x2, y2] = nodePoint(run.net, run.at);
  const t0 = performance.now(), dur = 1300, hold = 200;
  let done = false;
  const finish = () => { if (!done) { done = true; ui.removeEventListener('pointerdown', finish); arrive(notice); } };
  ui.addEventListener('pointerdown', finish);
  (function tick(now) {
    if (done) return;
    const k = Math.min(1, (now - t0) / dur), e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    veh.textContent = emoji;
    veh.setAttribute('x', (x1 + (x2 - x1) * e).toFixed(1));
    veh.setAttribute('y', (y1 + (y2 - y1) * e + 6).toFixed(1));
    if (now - t0 < dur + hold) requestAnimationFrame(tick); else finish();
  })(t0);
}

const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function arrivalNotice(out) {
  if (out.caught) return { html: 'Kontrolle! Ohne Ticket erwischt. +30 Min.', kind: 'bad' };
  const parts = [];
  let kind = 'good';
  if (out.arrivalDelay >= 10) { parts.push(`+${out.arrivalDelay} Min Verspätung. ${pick(['Natürlich.', 'Wie immer.', 'Überraschung!'])}`); kind = 'bad'; }
  else if (out.arrivalDelay > 0) { parts.push(`+${out.arrivalDelay} Min Verspätung.`); kind = 'meh'; }
  else parts.push(pick(['Pünktlich! Wer hätte das gedacht.', 'Auf die Minute. Ein Wunder.', 'Pünktlich angekommen.']));
  if (out.refund) parts.push(`Fahrgastrechte: +${out.refund} €`);
  if (out.dodged) parts.push('Ohne Ticket durchgekommen.');
  return { html: parts.join(' '), kind };
}

function board(fn, opt) {
  const from = app.run.at;
  const out = fn();
  rideAnimation(from, opt.cancelled ? '🚌' : opt.type === 'ICB' ? '🚄' : '🚆', arrivalNotice(out));
}

function finishRun() {
  const run = app.run, res = result(run);
  const rec = recordRun(app.progress, { mode: run.mode, day: run.day, stufe: run.stufe, score: res.score, stars: res.stars, km: res.km, line: res.line });
  app.progress = rec.progress;
  save(app.progress);
  app.outcome = { res, rec };
  go('result');
  sfx[res.score >= 0 ? 'win' : 'fail']();
  if (rec.unlocks.length || rec.stufeUnlocked) setTimeout(() => sfx.unlock(), 700);
}

// ---------- sprint ----------
let rafId = 0, last = 0;
function startSprint(opt) {
  const run = app.run;
  app.opt = opt;
  const tutorial = app.progress.runs === 0 && run.sprints < 2;
  app.sprint = createSprint({ ...sprintSpec(run, opt), tutorial });
  app.view = createSprintView(canvas, run.characterId);
  app.paused = false;
  app.screen = 'sprint';
  cancelAnimationFrame(heroRaf);
  ui.hidden = true;
  stage.hidden = false;
  app.view.start(app.sprint);
  last = performance.now();
  cancelAnimationFrame(rafId);
  rafId = requestAnimationFrame(frame);
}

function frame(now) {
  const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
  last = now;
  const sp = app.sprint;
  if (!app.paused) { updateSprint(sp, dt); app.view.step(sp, dt); }
  app.view.render(app.paused);
  if (sp.result) return endSprint(sp.result);
  rafId = requestAnimationFrame(frame);
}

function endSprint(outcome) {
  const run = app.run, opt = app.opt;
  app.sprint = null;
  if (outcome.made) return board(() => completeSprint(run, opt, outcome), opt);
  const before = run.clock;
  completeSprint(run, opt, outcome);
  arrive({ html: `${opt.cancelled ? 'Bus' : 'Zug'} weg. −${run.clock - before} Min.${outcome.money ? ` Immerhin ${outcome.money} € Pfand.` : ''}`, kind: 'bad' });
}

function sprintInput(dir) {
  if (!app.sprint) return;
  if (app.paused) { app.paused = false; return; }
  steer(app.sprint, dir);
}

canvas.addEventListener('pointerdown', e => {
  e.preventDefault();
  unlock();
  const r = canvas.getBoundingClientRect();
  sprintInput(e.clientX - r.left < r.width / 2 ? -1 : 1);
}, { passive: false });
canvas.addEventListener('touchstart', e => e.preventDefault(), { passive: false });

window.addEventListener('keydown', e => {
  if (!app.sprint || e.repeat) return;
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { sprintInput(-1); e.preventDefault(); }
  else if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { sprintInput(1); e.preventDefault(); }
  else if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') app.paused = !app.paused;
});
document.addEventListener('visibilitychange', () => { if (document.hidden && app.sprint) app.paused = true; });
window.addEventListener('resize', () => app.view?.resize());

// ---------- sharing ----------
function dailyContext() {
  const run = app.screen === 'result' ? app.run : todaysRun();
  const recorded = run.mode === 'daily' && app.progress.daily[run.day];
  return { run, entry: recorded || app.outcome.res };
}

async function share({ run, entry }) {
  const net = run.net;
  const link = `${location.origin}${location.pathname}#c=${encodeChallenge({ day: run.day, score: entry.score, name: app.progress.name, line: entry.line })}`;
  const text = shareText({
    day: run.day, from: net.nodes[net.startId].city, to: net.nodes[net.goalId].city, occasion: OCCASIONS[net.occasion].name,
    line: entry.line, score: entry.score, stars: entry.stars, link,
  });
  try {
    if (navigator.share) { await navigator.share({ text }); app.sheet = null; }
    else { await navigator.clipboard.writeText(text); app.sheet = 'name'; app.sheetMsg = 'Kopiert! Ab in den Gruppenchat.'; }
  } catch (err) {
    if (err?.name === 'AbortError') return;
    app.sheet = 'name';
    app.sheetMsg = text;
  }
  render();
}

function shareOrAskName(ctx) {
  app.shareCtx = ctx;
  if (!app.progress.name) { app.sheet = 'name'; app.sheetMsg = ''; return render(); }
  share(ctx);
}

// ---------- actions ----------
const findDep = key => departures(app.run).find(d => d.key === key);

const actions = {
  sound() { setSound(!soundOn()); app.progress.sound = soundOn(); save(app.progress); sfx.click(); render(); },
  home() { if (app.run?.done) clearChallenge(); app.run = null; go('home'); },
  figuren() { go('figuren'); },
  'close-sheet'() { app.sheet = null; if (app.ns) app.ns.map = false; render(); },
  daily() { app.run = dailyRun(dayNumber()); go('plan'); },
  challenge() {
    const day = app.challenge.day;
    app.run = createRun({ seed: hashOf('daily', day), mode: day === dayNumber() ? 'daily' : 'challenge', day, regionId: 'de' });
    go('plan');
  },
  free() { if (app.screen !== 'home') { clearChallenge(); app.screen = 'home'; } app.sheet = 'free'; render(); },
  duel() { app.sheet = 'duel'; render(); },
  'pick-char'(el) { app.progress.character = el.dataset.id; save(app.progress); sfx.click(); render(); },
  'pick-region'(el) { app.setup.regionId = el.dataset.id; render(); },
  'pick-stufe'(el) { app.setup.stufe = Math.min(Number(el.dataset.id), app.progress.stufeMax, MAX_STUFE); render(); },
  'start-free'() {
    const u = unlocked(app.progress);
    app.run = createRun({
      seed: (Math.random() * 4294967296) >>> 0, mode: 'free', characterId: app.progress.character, perks: u.perks,
      regionId: u.regions.includes(app.setup.regionId) ? app.setup.regionId : 'nord', stufe: app.setup.stufe,
    });
    go('plan');
  },
  begin() { arrive(null); },
  map() { app.ns.map = true; render(); },
  dep(el) { startSprint(findDep(el.dataset.key)); },
  taxi(el) {
    const run = app.run, from = run.at, to = el.dataset.to;
    takeTaxi(run, to);
    rideAnimation(from, TAXI.emoji, { html: `Taxi. Teuer, aber da. ${clock(run.clock)}`, kind: 'meh' });
  },
  buy(el) { if (buyItem(app.run, el.dataset.id)) sfx.coin(); render(); },
  lounge() { if (loungeJob(app.run)) { app.ns.notice = { html: 'Gejobbt. Geld da, Zeit weg.', kind: 'meh' }; sfx.coin(); } render(); },
  event(el) {
    const run = app.run, from = run.at;
    app.ns.eventResult = resolveEvent(run, Number(el.dataset.id));
    app.ns.movedFrom = run.at !== from ? from : null;
    render();
  },
  'event-ok'() {
    const run = app.run;
    if (app.ns.movedFrom) {
      return rideAnimation(app.ns.movedFrom, run.legs.at(-1).emoji, { html: `${app.ns.eventResult} Jetzt ${clock(run.clock)}.`, kind: 'meh' });
    }
    app.ns.notice = { html: app.ns.eventResult, kind: 'meh' };
    app.ns.eventResult = null;
    render();
  },
  share() { shareOrAskName(dailyContext()); },
  'share-daily'() { shareOrAskName(dailyContext()); },
  send() {
    const input = document.getElementById('name');
    app.progress.name = cleanName(input?.value || '');
    save(app.progress);
    share(app.sheet === 'duel' || !app.shareCtx ? dailyContext() : app.shareCtx);
  },
};

ui.addEventListener('click', e => {
  const el = e.target.closest('[data-act], [data-stop]');
  if (!el || el.hasAttribute('data-stop') || el.disabled) return;
  unlock();
  actions[el.dataset.act]?.(el);
});

render();

// Debug handle for manual testing in the browser console.
window.__anschluss = { app, render };
