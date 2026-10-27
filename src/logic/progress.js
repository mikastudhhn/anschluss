// Everything that survives between journeys. Pure functions; storage happens in the UI layer.
import { LADDER, MAX_STUFE } from './content.js';

export function newProgress() {
  return { km: 0, stufeMax: 0, runs: 0, onTime: 0, bestScore: null, daily: {}, name: '', sound: false };
}

export function parseProgress(raw) {
  const base = newProgress();
  let data;
  try { data = JSON.parse(raw); } catch { return base; }
  if (!data || typeof data !== 'object') return base;
  for (const k of Object.keys(base)) if (k in data && typeof data[k] === typeof base[k]) base[k] = data[k];
  if (typeof data.bestScore === 'number') base.bestScore = data.bestScore;
  return base;
}

export function unlocked(progress) {
  const u = { characters: ['pendler'], regions: ['nord'], perks: [] };
  for (const e of LADDER) {
    if (progress.km < e.km) break;
    ({ character: u.characters, region: u.regions, perk: u.perks })[e.kind].push(e.id);
  }
  return u;
}

export function nextUnlock(progress) {
  const i = LADDER.findIndex(e => progress.km < e.km);
  if (i < 0) return null;
  const from = i ? LADDER[i - 1].km : 0;
  return { entry: LADDER[i], fraction: (progress.km - from) / (LADDER[i].km - from) };
}

export function recordRun(progress, r) {
  const p = { ...progress, daily: { ...progress.daily } };
  const before = new Set(LADDER.filter(e => p.km >= e.km));
  p.km += r.km;
  const unlocks = LADDER.filter(e => p.km >= e.km && !before.has(e));
  // A repeated daily is practice with known delays: it only earns kilometres.
  if (r.mode === 'daily' && p.daily[r.day]) return { progress: p, unlocks, stufeUnlocked: null, dailyCounted: false };
  p.runs++;
  if (r.score >= 0) p.onTime++;
  if (p.bestScore === null || r.score > p.bestScore) p.bestScore = r.score;
  if (r.mode === 'daily') p.daily[r.day] = { score: r.score, stars: r.stars, line: r.line };
  let stufeUnlocked = null;
  if (r.score >= 0 && r.stufe === p.stufeMax && p.stufeMax < MAX_STUFE) stufeUnlocked = ++p.stufeMax;
  return { progress: p, unlocks, stufeUnlocked, dailyCounted: r.mode === 'daily' };
}
