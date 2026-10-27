// Smoke tests for the presentation layer: every screen renders from real game states without throwing,
// and the sprint renderer draws whole sprints on a fake canvas.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, departures, completeSprint, sprintSpec, result } from '../src/logic/run.js';
import { createSprint, updateSprint, steer } from '../src/logic/sprint.js';
import { newProgress, recordRun } from '../src/logic/progress.js';
import { menuScreen, setupScreen, progressScreen, journeyScreen, stationScreen, rideScreen, resultScreen } from '../src/ui/screens.js';
import { mapSvg, nodePoint } from '../src/ui/mapView.js';
import { EVENTS } from '../src/logic/content.js';

globalThis.window = { devicePixelRatio: 2 };
globalThis.matchMedia = () => ({ matches: false });
const { createSprintView } = await import('../src/ui/sprintView.js');

function fakeCanvas() {
  const calls = { fillText: [] };
  const grad = { addColorStop() {} };
  const ctx = new Proxy({}, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'measureText') return s => ({ width: String(s).length * 7 });
      if (k === 'createLinearGradient' || k === 'createRadialGradient') return () => grad;
      if (k === 'fillText') return (s, x, y) => { if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error(`bad text pos for ${s}`); calls.fillText.push(String(s)); };
      return () => {};
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  return { canvas: { getContext: () => ctx, getBoundingClientRect: () => ({ width: 360, height: 560 }), width: 0, height: 0 }, calls };
}

const ns = (o = {}) => ({ notice: null, sheet: null, eventResult: null, movedFrom: null, ...o });

test('menu, setup and progress render for new and veteran players', () => {
  for (const p of [newProgress(), { ...newProgress(), km: 99999, stufeMax: 5, daily: { 3: { score: 4, stars: 3, line: '🚄🚆' } }, name: 'Mika' }]) {
    const challenge = { day: 3, score: -2, name: 'Jo<b>', line: '🚄' };
    const html = menuScreen({ progress: p, day: 3, challenge, soundOn: true });
    assert.ok(html.includes('Tagesreise #3'));
    assert.ok(!html.includes('<b>Jo<b>'), 'names are escaped');
    assert.ok(setupScreen({ progress: p, setup: { characterId: 'pendler', regionId: 'nord', stufe: 0 } }).includes('Freie Reise'));
    assert.ok(progressScreen({ progress: p }).includes('Vielfahrer'));
  }
});

test('a whole journey renders every screen along the way, including all node kinds and sheets', () => {
  for (let seed = 1; seed <= 25; seed++) {
    const run = createRun({ seed, regionId: seed % 2 ? 'de' : 'nord', characterId: ['pendler', 'studentin', 'rentner'][seed % 3], stufe: seed % 6 });
    assert.ok(journeyScreen(run).includes('<svg'));
    while (!run.done) {
      const kind = run.net.nodes[run.at].kind;
      const html = stationScreen(run, ns());
      assert.ok(html.includes('Abfahrten'));
      if (kind === 'event') {
        assert.ok(html.includes(EVENTS[run.net.nodes[run.at].event].title));
        assert.ok(stationScreen(run, ns({ eventResult: 'ok' })).includes('Weiter'));
      }
      if (kind === 'kiosk') assert.ok(html.includes('Kiosk'));
      const d = departures(run)[0];
      assert.ok(/sprinten/i.test(stationScreen(run, ns({ sheet: d }))));
      assert.ok(rideScreen(run, { emoji: '🚄', city: d.city }).includes('veh'));
      const [x, y] = nodePoint(run.net, run.at);
      assert.ok(Number.isFinite(x) && Number.isFinite(y));
      completeSprint(run, d, { made: true, elapsed: 5, money: 1, bahncardUsed: false });
    }
    const res = result(run);
    const rec = recordRun(newProgress(), { mode: 'daily', day: 1, stufe: 0, score: res.score, stars: res.stars, km: res.km, line: res.line });
    const html = resultScreen({ run: { ...run, mode: 'daily', day: 1 }, res, rec, challenge: { day: 1, score: 3, name: 'Mika', line: '🚄' }, progress: rec.progress, share: 'Kopiert!' });
    assert.ok(html.includes('Angekommen'));
    assert.ok(html.includes('Mika'));
    assert.ok(mapSvg(run).includes('e-done'));
  }
});

test('the sprint renderer draws complete sprints of every theme without errors', () => {
  const themes = [
    { clock: 9 * 60, size: 'gross', bus: false }, { clock: 18 * 60, size: 'mittel', bus: false },
    { clock: 22 * 60, size: 'gross', bus: false }, { clock: 12 * 60, size: 'klein', bus: false }, { clock: 12 * 60, size: 'gross', bus: true },
  ];
  for (const [i, t] of themes.entries()) {
    const run = createRun({ seed: 40 + i, regionId: 'de' });
    run.items.push('thermobecher', 'bahncard');
    const spec = { ...sprintSpec(run, departures(run)[0]), ...t, timeLimit: 10 + i * 6 };
    const sp = createSprint(spec);
    const { canvas, calls } = fakeCanvas();
    const view = createSprintView(canvas, ['pendler', 'studentin', 'rentner'][i % 3]);
    view.start(sp);
    for (let f = 0; f < 6000 && !sp.result; f++) {
      if (f % 23 === 0) steer(sp, f % 46 ? 1 : -1);
      updateSprint(sp, 1 / 60);
      view.step(sp, 1 / 60);
      view.render(f % 500 === 0);
    }
    assert.ok(sp.result, `theme ${i} finished`);
    assert.ok(calls.fillText.some(s => s.includes('Min') || s.includes('Bord') || s.includes('weg')));
  }
});
