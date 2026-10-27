// Synthesized sound, no files. Starts muted until the player turns it on.
const S = { on: false, ctx: null, out: null, noise: null };

export function setSound(on) {
  S.on = on;
  if (on) unlock();
}
export const soundOn = () => S.on;

export function unlock() {
  if (!S.on) return;
  if (S.ctx) { if (S.ctx.state !== 'running') S.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  try {
    S.ctx = new AC();
    S.out = S.ctx.createGain();
    S.out.gain.value = 0.55;
    S.out.connect(S.ctx.destination);
    const len = S.ctx.sampleRate * 2;
    S.noise = S.ctx.createBuffer(1, len, S.ctx.sampleRate);
    const d = S.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  } catch { S.ctx = null; }
}

const live = () => S.on && S.ctx && S.ctx.state === 'running';
function play(fn) { if (live()) { try { fn(S.ctx.currentTime + 0.01); } catch { /* ignore audio glitches */ } } }
function osc(type, f0, t0, dur, vol, f1) {
  const c = S.ctx, o = c.createOscillator(), g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f0, t0);
  if (f1) o.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(S.out);
  o.start(t0); o.stop(t0 + dur + 0.02);
}
function nz(t0, dur, vol, type, f0, f1, q) {
  const c = S.ctx, s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
  s.buffer = S.noise;
  f.type = type; f.frequency.setValueAtTime(f0, t0);
  if (f1) f.frequency.exponentialRampToValueAtTime(f1, t0 + dur);
  f.Q.value = q || 1;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + Math.min(0.03, dur / 3));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  s.connect(f); f.connect(g); g.connect(S.out);
  s.start(t0, Math.random()); s.stop(t0 + dur + 0.02);
}
function bell(f, t, dur, vol) {
  osc('sine', f, t, dur, vol);
  osc('sine', f * 2, t, dur * 0.6, vol * 0.25);
  osc('sine', f * 3.01, t, dur * 0.35, vol * 0.1);
}

export const sfx = {
  gong: () => play(t => { bell(784, t, 1.4, 0.22); bell(659.3, t + 0.42, 1.4, 0.22); bell(523.3, t + 0.84, 2.0, 0.24); }),
  step: () => play(t => nz(t, 0.05, 0.05, 'lowpass', 700)),
  hit: () => play(t => { osc('sine', 150, t, 0.22, 0.45, 50); nz(t, 0.14, 0.25, 'lowpass', 1400); }),
  coo: () => play(t => { osc('triangle', 380, t, 0.14, 0.15, 300); osc('triangle', 360, t + 0.16, 0.2, 0.15, 270); }),
  coin: () => play(t => { osc('square', 988, t, 0.07, 0.06); osc('square', 1319, t + 0.07, 0.12, 0.06); }),
  boost: () => play(t => [660, 880, 1320].forEach((f, i) => osc('sine', f, t + i * 0.06, 0.12, 0.18))),
  whoosh: () => play(t => nz(t, 0.3, 0.28, 'bandpass', 500, 2600, 2)),
  beep: () => play(t => [0, 0.2, 0.4].forEach(d => osc('square', 1046, t + d, 0.1, 0.06))),
  depart: () => play(t => { nz(t, 1.8, 0.18, 'lowpass', 180, 700); osc('sawtooth', 55, t, 1.6, 0.04, 70); }),
  win: () => play(t => [523, 659, 784, 1046].forEach((f, i) => osc('triangle', f, t + i * 0.09, 0.25, 0.2))),
  fail: () => play(t => { osc('sawtooth', 300, t, 0.35, 0.08, 220); osc('sawtooth', 240, t + 0.35, 0.6, 0.08, 150); }),
  ping: () => play(t => { osc('sine', 1318, t, 0.12, 0.15); osc('sine', 1760, t + 0.09, 0.18, 0.13); }),
  star: () => play(t => { osc('sine', 1046, t, 0.3, 0.2); osc('sine', 1568, t + 0.05, 0.3, 0.1); }),
  click: () => play(t => osc('sine', 880, t, 0.06, 0.12)),
  unlock: () => play(t => [784, 988, 1175, 1568].forEach((f, i) => osc('sine', f, t + i * 0.08, 0.3, 0.16))),
};
