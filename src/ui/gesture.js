// Turns pointer input into lane steps: a horizontal swipe steps once as soon as it is long enough,
// a short tap steps towards the side that was tapped.
const SWIPE = 24, TAP_MS = 300, TAP_SLOP = 12;

export function createGesture(width, onStep) {
  let g = null;
  return {
    down(x, y, t) { g = { x, y, t, done: false }; },
    move(x, y) {
      if (!g || g.done) return;
      const dx = x - g.x, dy = y - g.y;
      if (Math.abs(dx) >= SWIPE && Math.abs(dx) > Math.abs(dy)) { g.done = true; onStep(Math.sign(dx)); }
      else if (Math.abs(dy) > TAP_SLOP * 2) g.done = true;
    },
    up(x, y, t) {
      if (g && !g.done && t - g.t < TAP_MS && Math.hypot(x - g.x, y - g.y) < TAP_SLOP) onStep(x < width() / 2 ? -1 : 1);
      g = null;
    },
    cancel() { g = null; },
  };
}
