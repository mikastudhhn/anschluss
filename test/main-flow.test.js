// Drives the real controller (src/main.js) through a whole daily journey on a fake DOM.
import { test } from 'node:test';
import assert from 'node:assert/strict';

class El {
  constructor(id) { Object.assign(this, { id, dataset: {}, hidden: false, listeners: {}, innerHTML: '', scrollTop: 0, attrs: {}, textContent: '' }); }
  addEventListener(t, fn) { (this.listeners[t] ||= []).push(fn); }
  removeEventListener(t, fn) { this.listeners[t] = (this.listeners[t] || []).filter(f => f !== fn); }
  getBoundingClientRect() { return { left: 0, top: 0, width: 360, height: 560 }; }
  setAttribute(k, v) { this.attrs[k] = v; }
  getContext() {
    return new Proxy({}, {
      get: (t, k) => (k in t ? t[k] : k === 'measureText' ? s => ({ width: String(s).length * 7 })
        : k.startsWith('create') ? () => ({ addColorStop() {} }) : () => {}),
      set: (t, k, v) => { t[k] = v; return true; },
    });
  }
}
const els = { ui: new El('ui'), stage: new El('stage'), sprint: new El('sprint') };
const winListeners = {};
let frames = [], now = 0, copied = '';
const storage = {};
Object.assign(globalThis, {
  document: {
    getElementById: id => els[id] || (id === 'veh' && els.ui.innerHTML.includes('id="veh"') ? new El('veh') : null),
    addEventListener() {}, hidden: false,
  },
  window: { addEventListener: (t, fn) => { (winListeners[t] ||= []).push(fn); }, devicePixelRatio: 1 },
  location: { hash: '', origin: 'https://anschluss.test', pathname: '/' },
  history: { replaceState() {} },
  localStorage: { getItem: k => storage[k] ?? null, setItem: (k, v) => { storage[k] = v; } },
  requestAnimationFrame: fn => { frames.push(fn); return frames.length; },
  cancelAnimationFrame() {},
  matchMedia: () => ({ matches: false }),
});
globalThis.window.__proto__ = globalThis;
Object.defineProperty(globalThis, 'navigator', { value: { clipboard: { writeText: async t => { copied = t; } } }, configurable: true });
globalThis.performance = { now: () => now };

await import('../src/main.js');
const { app } = globalThis.window.__anschluss;
const { steer } = await import('../src/logic/sprint.js');

const click = (act, data = {}) => {
  const el = { dataset: { act, ...data }, disabled: false, hasAttribute: () => false };
  for (const fn of els.ui.listeners.click) fn({ target: { closest: () => el } });
};
const pump = (ms = 16, max = 4000) => {
  for (let i = 0; i < max && frames.length; i++) {
    const batch = frames; frames = [];
    now += ms;
    for (const fn of batch) fn(now);
    const sp = app.sprint;
    if (sp) {
      sp.obstacles = [];
      if (sp.fork && sp.phase === 'run' && sp.lock === null) {
        const want = sp.fork.sides.L === sp.gleis.truth ? 0 : 2;
        if (sp.player.lane !== want) steer(sp, want < sp.player.lane ? -1 : 1);
      }
    }
  }
};
const flush = () => new Promise(r => setTimeout(r, 0));

test('home → daily → plan → sprints → result → share, end to end', async () => {
  assert.equal(app.screen, 'home');
  assert.ok(els.ui.innerHTML.includes('TAGESREISE #'));
  click('daily');
  assert.equal(app.screen, 'plan');
  click('begin');
  assert.equal(app.screen, 'station');
  for (let guard = 0; guard < 40 && app.screen !== 'result'; guard++) {
    if (app.screen === 'station' && els.ui.innerHTML.includes('data-act="event"')) { click('event', { id: '1' }); click('event-ok'); continue; }
    if (app.screen === 'ride') { pump(); continue; }
    const key = /data-act="dep" data-key="([^"]+)"/.exec(els.ui.innerHTML)[1];
    click('dep', { key });
    assert.equal(app.screen, 'sprint', 'one tap on a train starts the sprint');
    assert.equal(els.stage.hidden, false);
    pump();
    if (app.screen === 'ride') pump();
  }
  assert.equal(app.screen, 'result');
  assert.match(els.ui.innerHTML, /PÜNKTLICH!|KNAPP!|ZU SPÄT!/);
  const p = JSON.parse(storage['anschluss.progress']);
  assert.ok(p.km > 0);
  assert.equal(Object.keys(p.daily).length, 1);
  assert.equal(p.streak.count, 1);
  click('share');
  assert.ok(els.ui.innerHTML.includes('Wie heißt du?'), 'asks for a name first');
  click('send');
  await flush();
  assert.match(copied, /^Anschluss! Tagesreise #\d+\n.+ → .+\n.+(zu früh|zu spät|auf die Minute) ⭐+\nhttps:\/\/anschluss\.test\/#c=[\w-]+$/);
  assert.ok(els.ui.innerHTML.includes('Kopiert!'));
  click('home');
  assert.equal(app.screen, 'home');
  assert.ok(els.ui.innerHTML.includes('🔥 1 Tag'));
  assert.ok(els.ui.innerHTML.includes('data-act="share-daily"'));
});

test('free journey uses the chosen character and only unlocked options', () => {
  click('free');
  assert.ok(els.ui.innerHTML.includes('Freie Reise'));
  assert.ok(!els.ui.innerHTML.includes('data-act="pick-region" data-id="de"'), 'region locked');
  click('pick-stufe', { id: '3' });
  assert.equal(app.setup.stufe, app.progress.stufeMax >= 3 ? 3 : app.progress.stufeMax);
  click('start-free');
  assert.equal(app.screen, 'plan');
  assert.equal(app.run.characterId, 'pendler');
  click('home');
});
