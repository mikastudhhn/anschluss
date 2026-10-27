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
  const el = { dataset: { act, ...data }, disabled: false };
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

test('menu → daily → journey → sprints → result → share, end to end', async () => {
  assert.equal(app.screen, 'menu');
  assert.ok(els.ui.innerHTML.includes('Tagesreise #'));
  click('daily');
  assert.equal(app.screen, 'journey');
  click('begin');
  assert.equal(app.screen, 'station');
  for (let guard = 0; guard < 40 && app.screen !== 'result'; guard++) {
    if (app.screen === 'station' && els.ui.innerHTML.includes('data-act="event"')) { click('event', { id: '1' }); click('event-ok'); continue; }
    if (app.screen === 'ride') { pump(); continue; }
    const key = /data-act="dep" data-key="([^"]+)"/.exec(els.ui.innerHTML)[1];
    click('dep', { key });
    assert.ok(els.ui.innerHTML.includes('class="sheet"'));
    click('sprint', { key });
    assert.equal(app.screen, 'sprint');
    assert.equal(els.stage.hidden, false);
    pump();
    if (app.screen === 'ride') pump();
  }
  assert.equal(app.screen, 'result');
  assert.ok(els.ui.innerHTML.includes('Angekommen'));
  const p = JSON.parse(storage['anschluss.progress']);
  assert.ok(p.km > 0);
  assert.equal(Object.keys(p.daily).length, 1);
  click('copy-link');
  await flush();
  assert.match(copied, /^https:\/\/anschluss\.test\/#c=[\w-]+$/);
  click('share');
  await flush();
  assert.match(copied, /^Anschluss! Tagesreise #\d+\n.+ → .+\n.+(zu früh|zu spät|auf die Minute) ⭐+\nhttps:/);
  click('menu');
  assert.ok(els.ui.innerHTML.includes('gespielt'));
});

test('free journey setup respects unlocks', () => {
  click('setup');
  assert.equal(app.screen, 'setup');
  assert.ok(!els.ui.innerHTML.includes('data-act="pick-char" data-id="rentner"'));
  click('start-free');
  assert.equal(app.screen, 'journey');
  assert.equal(app.run.characterId, 'pendler');
  click('menu');
});
