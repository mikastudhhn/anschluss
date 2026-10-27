// Deterministic randomness: the daily journey must play out identically for everyone.

export function makeRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const range = (a, b) => a + (b - a) * next();
  const int = (a, b) => Math.floor(range(a, b + 1));
  const pick = arr => arr[Math.floor(next() * arr.length)];
  const chance = p => next() < p;
  const weighted = list => {
    let sum = 0;
    for (const [, w] of list) sum += w;
    let r = next() * sum;
    for (const [k, w] of list) if (w > 0 && (r -= w) < 0) return k;
    return list.filter(([, w]) => w > 0).pop()[0];
  };
  const shuffle = arr => {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(next() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  return { next, range, int, pick, chance, weighted, shuffle };
}

// Stable 32-bit hash of any mix of numbers and strings.
export function hashOf(...parts) {
  let h = 0x811c9dc5;
  for (const p of parts) {
    const str = String(p) + '\u0001';
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
  }
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  return h >>> 0;
}

export const rngFor = (...parts) => makeRng(hashOf(...parts));

const LAUNCH_UTC = Date.UTC(2026, 9, 27);

// Day 1 is the launch day, counted in the player's local calendar.
export function dayNumber(date = new Date()) {
  const local = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((local - LAUNCH_UTC) / 86400000) + 1;
}
