// Controller: screen flow, input, storage and the sprint loop.
import { hashOf, dayNumber } from './logic/rng.js';
import {
  createRun, departures, sprintSpec, completeSprint, stroll, takeTaxi, buyItem, loungeJob, resolveEvent, result,
} from './logic/run.js';
import { createSprint, updateSprint, steer } from './logic/sprint.js';
import { newProgress, parseProgress, unlocked, recordRun } from './logic/progress.js';
import { shareText, encodeChallenge, challengeFromHash, cleanName } from './logic/share.js';
import { OCCASIONS, TAXI } from './logic/content.js';
import { menuScreen, setupScreen, progressScreen, journeyScreen, stationScreen, rideScreen, resultScreen, clock } from './ui/screens.js';
import { createSprintView } from './ui/sprintView.js';
import { nodePoint } from './ui/mapView.js';
import { sfx, setSound, soundOn, unlock } from './ui/audio.js';

const KEY = 'anschluss.progress';
const load = () => { try { return parseProgress(localStorage.getItem(KEY)); } catch { return newProgress(); } };
const save = p => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode: session only */ } };

const ui = document.getElementById('ui');
const stage = document.getElementById('stage');
const canvas = document.getElementById('sprint');

const app = {
  progress: load(), screen: 'menu', run: null, ns: null, setup: { characterId: 'pendler', regionId: 'nord', stufe: 0 },
  challenge: challengeFromHash(location.hash), sprint: null, view: null, opt: null, paused: false, outcome: null, share: '',
};
setSound(app.progress.sound);

// ---------- rendering ----------
function render() {
  const keepScroll = ui.dataset.screen === app.screen ? ui.scrollTop : 0;
  const { progress, run } = app;
  let html = '';
  switch (app.screen) {
    case 'menu': html = menuScreen({ progress, day: dayNumber(), challenge: app.challenge, soundOn: soundOn() }); break;
    case 'setup': html = setupScreen({ progress, setup: app.setup }); break;
    case 'progress': html = progressScreen({ progress }); break;
    case 'journey': html = journeyScreen(run); break;
    case 'station': html = stationScreen(run, app.ns); break;
    case 'result': html = resultScreen({ run, ...app.outcome, challenge: compareTo(run), progress, share: app.share }); break;
  }
  ui.innerHTML = html;
  ui.dataset.screen = app.screen;
  ui.scrollTop = keepScroll;
  ui.hidden = false;
  stage.hidden = true;
}

function go(screen) { app.screen = screen; app.share = ''; render(); }

function clearChallenge() {
  if (!compareTo(app.run)) return;
  app.challenge = null;
  history.replaceState(null, '', location.pathname);
}

const compareTo = run => (app.challenge && run && (run.mode === 'challenge' || run.mode === 'daily') && app.challenge.day === run.day ? app.challenge : null);

// ---------- journey flow ----------
function startRun(opts) {
  app.run = createRun({ perks: [], ...opts });
  go('journey');
}

function arrive(notice) {
  if (app.run.done) return finishRun();
  app.ns = { notice, sheet: null, eventResult: null, movedFrom: null };
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
  const t0 = performance.now(), dur = 1500, hold = 250;
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

function arrivalNotice(out) {
  const run = app.run, city = run.net.nodes[run.at].city;
  const parts = [`Ankunft ${city} ${clock(run.clock)}`];
  let kind = 'good';
  if (out.caught) { parts.push('Kontrolle! Ohne Ticket erwischt: +30 Min'); kind = 'bad'; }
  if (out.arrivalDelay > 0) { parts.push(`+${out.arrivalDelay} Min Verspätung`); kind = out.arrivalDelay >= 10 ? 'bad' : 'meh'; }
  else if (!out.caught) parts.push('pünktlich');
  if (out.refund) parts.push(`Fahrgastrechte: ${out.refund} € zurück`);
  if (out.dodged && !out.caught) parts.push('ohne Ticket durchgekommen');
  return { html: parts.join(' · '), kind };
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
  app.sprint = createSprint(sprintSpec(run, opt));
  app.view = createSprintView(canvas, run.characterId);
  app.paused = false;
  app.screen = 'sprint';
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
  arrive({ html: `${opt.cancelled ? 'Bus' : 'Zug'} weg! ${run.clock - before} Min verloren.${outcome.money ? ` ♻ ${outcome.money} € Pfand eingesammelt.` : ''}`, kind: 'bad' });
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
function shareLink(day, score, line) {
  const token = encodeChallenge({ day, score, name: app.progress.name, line });
  return `${location.origin}${location.pathname}#c=${token}`;
}

async function shareResult(day, entry, run) {
  const nameInput = document.getElementById('name');
  if (nameInput) { app.progress.name = cleanName(nameInput.value); save(app.progress); }
  const net = run?.net;
  const from = net ? net.nodes[net.startId].city : '';
  const to = net ? net.nodes[net.goalId].city : '';
  const occasion = net ? OCCASIONS[net.occasion].name : '';
  const link = shareLink(day, entry.score, entry.line);
  const text = shareText({ day, from, to, occasion, line: entry.line, score: entry.score, stars: entry.stars, link });
  try {
    if (navigator.share) { await navigator.share({ text }); app.share = 'Geteilt!'; }
    else { await navigator.clipboard.writeText(text); app.share = 'Kopiert! Jetzt in den Gruppenchat damit.'; }
  } catch (err) {
    if (err?.name === 'AbortError') return;
    app.share = text;
  }
  render();
}

async function copyLink(day, entry) {
  const nameInput = document.getElementById('name');
  if (nameInput) { app.progress.name = cleanName(nameInput.value); save(app.progress); }
  const link = shareLink(day, entry.score, entry.line);
  try { await navigator.clipboard.writeText(link); app.share = 'Link kopiert.'; } catch { app.share = link; }
  render();
}

// ---------- actions ----------
const findDep = key => departures(app.run).find(d => d.key === key);
const dailyRun = day => createRun({ seed: hashOf('daily', day), mode: 'daily', day, regionId: 'de' });

const actions = {
  sound() { setSound(!soundOn()); app.progress.sound = soundOn(); save(app.progress); sfx.click(); render(); },
  menu() { if (app.run?.done) clearChallenge(); app.run = null; go('menu'); },
  setup() { go('setup'); },
  progress() { go('progress'); },
  daily() { const day = dayNumber(); app.run = dailyRun(day); go('journey'); },
  challenge() {
    const day = app.challenge.day;
    app.run = createRun({ seed: hashOf('daily', day), mode: day === dayNumber() ? 'daily' : 'challenge', day, regionId: 'de' });
    go('journey');
  },
  'pick-char'(el) { app.setup.characterId = el.dataset.id; render(); },
  'pick-region'(el) { app.setup.regionId = el.dataset.id; render(); },
  'pick-stufe'(el) { app.setup.stufe = Number(el.dataset.id); render(); },
  'start-free'() {
    startRun({ ...app.setup, seed: (Math.random() * 4294967296) >>> 0, mode: 'free', perks: unlocked(app.progress).perks });
  },
  begin() { arrive(null); },
  dep(el) { app.ns.sheet = findDep(el.dataset.key); render(); },
  'close-sheet'() { app.ns.sheet = null; render(); },
  sprint(el) { const opt = findDep(el.dataset.key); app.ns.sheet = null; startSprint(opt); },
  stroll(el) { const opt = findDep(el.dataset.key); board(() => stroll(app.run, opt), opt); },
  taxi(el) {
    const run = app.run, from = run.at, to = el.dataset.to;
    takeTaxi(run, to);
    rideAnimation(from, TAXI.emoji, { html: `Ankunft ${run.net.nodes[to].city} ${clock(run.clock)} · Taxi`, kind: 'meh' });
  },
  buy(el) { if (buyItem(app.run, el.dataset.id)) sfx.coin(); render(); },
  lounge() { if (loungeJob(app.run)) app.ns.notice = { html: 'Gejobbt. Geld da, Zeit weg.', kind: 'meh' }; render(); },
  event(el) {
    const run = app.run, from = run.at;
    app.ns.eventResult = resolveEvent(run, Number(el.dataset.id));
    app.ns.movedFrom = run.at !== from ? from : null;
    render();
  },
  'event-ok'() {
    const run = app.run;
    if (app.ns.movedFrom) {
      const emoji = run.legs.at(-1).emoji;
      return rideAnimation(app.ns.movedFrom, emoji, { html: `${app.ns.eventResult} Jetzt ${clock(run.clock)}.`, kind: 'meh' });
    }
    app.ns.notice = { html: app.ns.eventResult, kind: 'meh' };
    app.ns.eventResult = null;
    render();
  },
  share() {
    const run = app.run;
    const entry = app.progress.daily[run.day] && run.mode === 'daily' ? app.progress.daily[run.day] : app.outcome.res;
    shareResult(run.day, entry, run);
  },
  'copy-link'() {
    const run = app.run;
    const entry = app.progress.daily[run.day] && run.mode === 'daily' ? app.progress.daily[run.day] : app.outcome.res;
    copyLink(run.day, entry);
  },
  'share-daily'() {
    const day = dayNumber();
    shareResult(day, app.progress.daily[day], dailyRun(day));
  },
  again() { clearChallenge(); go('setup'); },
};

ui.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el || el.disabled) return;
  unlock();
  const fn = actions[el.dataset.act];
  if (fn) fn(el);
});

render();

// Debug handle for manual testing in the browser console.
window.__anschluss = { app, render };
