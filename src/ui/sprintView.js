// Canvas renderer for one sprint. Reads the simulation state; turns its `fx` queue into sound, particles and text.
import { W, H, HUD_H, PLAYER_Y, LANES, INTRO, screenY } from '../logic/sprint.js';
import { SEC_PER_MIN, LINES, SEV } from '../logic/content.js';
import { sfx } from './audio.js';

const TAU = Math.PI * 2;
const FONT = '"Nunito", ui-rounded, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';
const DISP = '"Lilita One", "Nunito", ui-rounded, system-ui, sans-serif';
const INK = '#14183a', YEL = '#ffd21f', RED = '#ff4b3e', GRN = '#2fd27a';
const WALL = 30;
const SHOPC = [[255, 207, 90], [90, 209, 255], [255, 107, 138], [138, 255, 193], [195, 155, 255], [255, 154, 61]];
const SUITC = ['#e63946', '#3a86ff', '#8338ec', '#2a9d8f', '#f4a261', '#ff006e'];
const JACKETS = ['#ffbe0b', '#fb5607', '#3a86ff', '#8ac926', '#ff006e', '#9b5de5', '#00bbf9'];
const HAIR = ['#2b1d14', '#5a3a22', '#c9a26b', '#1a1a1a', '#8d5524', '#d9d9d9'];
const SKIN = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac'];
const POSTERS = [['#ff5a5f', '#fff'], ['#ffd400', '#0b2a6b'], ['#3ddc97', '#0d2b1f'], ['#4da3ff', '#fff']];
const CONF = ['#ffd400', '#ff5a5f', '#3ddc97', '#4da3ff', '#ffffff', '#c39bff'];
const THEMES = {
  tag: { floor: '#5a5f68', alt: '#60656e', tile: 40, walls: 'tiles', light: [220, 240, 255], li: 0.1, vign: 0.42 },
  abend: { floor: '#262c38', alt: '#2c3341', tile: 60, walls: 'shops', light: [255, 214, 160], li: 0.15, vign: 0.5 },
  nacht: { floor: '#1b202b', alt: '#1f2531', tile: 60, walls: 'shops', dim: true, light: [160, 190, 255], li: 0.12, vign: 0.68, tint: 'rgba(10,20,70,0.16)' },
  dorf: { floor: '#857c6c', alt: '#8d8474', tile: 30, walls: 'brick', light: [255, 245, 220], li: 0.05, vign: 0.3 },
  sev: { floor: '#202329', alt: '#202329', tile: 60, walls: 'street', light: [255, 190, 110], li: 0.2, vign: 0.6, tint: 'rgba(20,30,60,0.12)' },
};
const CHAR_LOOK = {
  pendler: { jacket: ['#ff9a3d', '#e8661a'], hair: '#3a2618' },
  studentin: { jacket: ['#b48cf2', '#8f5bd6'], hair: '#5a3a22' },
  rentner: { jacket: ['#cdb48c', '#a68a64'], hair: '#d9d9d9' },
};
const SIGNS = ['↑  Gleise 1–14', '←  Ausgang  ·  Taxi  →', '↑  Fernverkehr', 'WC  ·  Lounge  →', '↑  Alle Züge (theoretisch)'];
const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const ease = t => 1 - Math.pow(1 - t, 3);
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
function hash(n) {
  n = Math.imul(n ^ 0x5bd1e995, 0x27d4eb2d); n ^= n >>> 15; n = Math.imul(n, 0x165667b1); n ^= n >>> 13;
  return n >>> 0;
}

export function themeFor(spec) {
  if (spec.bus) return 'sev';
  if (spec.size === 'klein') return 'dorf';
  const h = Math.floor(spec.clock / 60) % 24;
  if (h >= 20 || h < 6) return 'nacht';
  return h >= 17 ? 'abend' : 'tag';
}

// ---------- drawing helpers (draw into the active context) ----------
let ctx = null;
function rrect(x, y, w, h, r) {
  ctx.beginPath();
  if (w <= 0 || h <= 0) return;
  r = Math.min(r, w / 2, h / 2);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function rrect2(x, y, w, h, rl, rR) {
  ctx.beginPath();
  rl = Math.min(rl, h / 2); rR = Math.min(rR, h / 2);
  ctx.moveTo(x + rl, y);
  ctx.arcTo(x + w, y, x + w, y + h, rR); ctx.arcTo(x + w, y + h, x, y + h, 6);
  ctx.arcTo(x, y + h, x, y, 6); ctx.arcTo(x, y, x + w, y, rl);
  ctx.closePath();
}
const circle = (x, y, r) => { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill(); };
const line = (x1, y1, x2, y2) => { ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
const shadow = (x, y, rx, ry, a) => { ctx.fillStyle = `rgba(0,0,0,${a})`; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, TAU); ctx.fill(); };
const font = (w, s, f) => { ctx.font = `${w} ${s}px ${f || FONT}`; };
function text(str, x, y, color, align, base) {
  ctx.fillStyle = color; ctx.textAlign = align || 'left'; ctx.textBaseline = base || 'alphabetic';
  ctx.fillText(str, x, y);
}
function ellipsize(str, maxW) {
  if (ctx.measureText(str).width <= maxW) return str;
  let s = str;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}
function wrap(str, maxW, maxLines) {
  const words = str.split(' '), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) { const keep = lines.slice(0, maxLines); keep[maxLines - 1] = ellipsize(lines.slice(maxLines - 1).join(' '), maxW); return keep; }
  return lines;
}
const FLAPCH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
function flap(str, t, delay) {
  let out = '';
  for (let i = 0; i < str.length; i++) {
    const settle = (delay || 0) + 0.035 * i + 0.15;
    out += t >= settle || str[i] === ' ' ? str[i] : FLAPCH[(Math.random() * FLAPCH.length) | 0];
  }
  return out;
}
function starPath(x, y, r) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + (i * Math.PI) / 5, rad = i % 2 ? r * 0.45 : r; ctx.lineTo(x + Math.cos(a) * rad, y + Math.sin(a) * rad); }
  ctx.closePath();
}
function outlined(str, x, y, col, lw) {
  ctx.lineJoin = 'round'; ctx.lineWidth = lw || 6; ctx.strokeStyle = INK;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.strokeText(str, x, y);
  ctx.fillStyle = col; ctx.fillText(str, x, y);
}

function drawRunner(look, x, y, run, bob, sc, lean, ghost) {
  ctx.save();
  ctx.translate(x, y);
  if (!ghost) shadow(0, 13, 15, 5, 0.32);
  ctx.scale(sc, sc); ctx.rotate(lean); ctx.translate(0, -bob);
  if (ghost) ctx.globalAlpha *= 0.18;
  for (const side of [-1, 1]) {
    const len = 13 + side * run * 6;
    ctx.fillStyle = '#2c3e66'; rrect(side * 6 - 4, 2, 8, len, 4); ctx.fill();
    ctx.fillStyle = '#f4f4f4'; ctx.beginPath(); ctx.ellipse(side * 6, 2 + len, 5, 3.2, 0, 0, TAU); ctx.fill();
  }
  ctx.lineCap = 'round';
  for (const side of [-1, 1]) {
    const ex = side * 16, ey = -3 - side * run * 7;
    ctx.strokeStyle = look.jacket[1]; ctx.lineWidth = 6; line(side * 11, -12, ex, ey);
    ctx.fillStyle = '#f0bf96'; circle(ex, ey + 1, 3);
  }
  const g = ctx.createLinearGradient(-13, 0, 13, 0);
  g.addColorStop(0, look.jacket[0]); g.addColorStop(1, look.jacket[1]);
  ctx.fillStyle = g; rrect(-13, -18, 26, 24, 9); ctx.fill();
  ctx.fillStyle = '#17a398'; rrect(-10, -15, 20, 19, 6); ctx.fill();
  ctx.fillStyle = '#128a80'; rrect(-10, -15, 20, 8, 5); ctx.fill();
  ctx.fillStyle = '#f0bf96'; circle(-8.5, -25, 2.5); circle(8.5, -25, 2.5);
  ctx.fillStyle = look.hair; circle(0, -26, 9);
  ctx.restore();
}


// The player character on its own, e.g. running on the home screen.
export function createRunnerPreview(canvas, characterId) {
  const own = canvas.getContext('2d');
  const look = CHAR_LOOK[characterId] || CHAR_LOOK.pendler;
  return t => {
    ctx = own;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const k = canvas.width / 70;
    ctx.setTransform(k, 0, 0, k, canvas.width / 2, canvas.height * 0.68);
    const phase = t * 9;
    drawRunner(look, 0, 0, Math.sin(phase), Math.abs(Math.cos(phase)) * 3, 1, 0.08, false);
  };
}

export function createSprintView(canvas, characterId) {
  const own = canvas.getContext('2d');
  let scale = 1;
  const V = { particles: [], texts: [], banner: null, app: null, shake: 0, flash: 0, flapT: 0, gleisFlapT: 0, stepI: 0, chips: {}, sp: null, theme: 'tag' };
  const look = CHAR_LOOK[characterId] || CHAR_LOOK.pendler;

  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    scale = (r.width / W) * dpr;
    canvas.width = Math.round(W * scale);
    canvas.height = Math.round(H * scale);
  }

  // ---------- effects ----------
  function burst(type, x, y, n) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * TAU, sp = Math.random();
      const P = { type, x, y, vx: 0, vy: 0, t: 0, life: 1, rot: Math.random() * TAU, vr: 0, size: 3, color: '#fff', world: false };
      if (type === 'dust') { P.vx = Math.cos(a) * (40 + sp * 80); P.vy = Math.sin(a) * (20 + sp * 40) - 20; P.life = 0.5; P.size = 3 + sp * 4; P.world = true; }
      else if (type === 'feather') { P.vx = Math.cos(a) * (60 + sp * 90); P.vy = -60 - sp * 120; P.life = 1.3; P.vr = (Math.random() - 0.5) * 8; P.size = 4 + sp * 3; P.world = true; }
      else if (type === 'confetti') { P.vx = (Math.random() - 0.5) * 420; P.vy = -250 - sp * 380; P.life = 2.2; P.vr = (Math.random() - 0.5) * 14; P.size = 4 + sp * 4; P.color = pick(CONF); }
      else if (type === 'spark') { P.vx = Math.cos(a) * (90 + sp * 120); P.vy = Math.sin(a) * (90 + sp * 120); P.life = 0.45; P.size = 2 + sp * 2; }
      V.particles.push(P);
    }
  }
  function popText(str, x, y, col, size) {
    V.texts.push({ str, x: clamp(x, 80, 280), y, col: col || '#fff', size: size || 22, t: 0, dur: 0.9 });
  }
  function banner(textStr, chip, col, garbled) { V.banner = { text: textStr, chip, col, garbled, t: 0, dur: 4 }; sfx.gong(); }

  function garble(str) {
    return str.split(' ').map((w, i) => (i % 3 === 1 ? '*knister*' : w.length > 3 && i % 2 ? w.slice(0, 2) + '…' : w)).join(' ');
  }

  function consume(sp) {
    const p = sp.player, ty = PLAYER_Y - 72;
    for (const f of sp.fx) {
      switch (f.type) {
        case 'go': popText('Los!', 180, 300, '#ffd400', 46); break;
        case 'boost': popText('Kaffee!', p.x, ty, '#ffd27a'); burst('spark', p.x, PLAYER_Y - 8, 14); sfx.boost(); break;
        case 'coo': sfx.coo(); break;
        case 'coin': popText('+Pfand', f.x, ty, '#9be15d', 18); burst('spark', f.x, PLAYER_Y - 8, 8); sfx.coin(); break;
        case 'near': popText('Knapp!', p.x, PLAYER_Y - 82, '#8fd3ff', 22); sfx.whoosh(); break;
        case 'text': popText(f.str, p.x, ty, f.col, 18); break;
        case 'hit':
          if (!reduceMotion) { V.shake = 11; V.flash = 0.35; }
          sfx.hit();
          burst('dust', p.x, PLAYER_Y - 6, 10);
          if (f.obstacle === 'pigeons') { burst('feather', p.x, PLAYER_Y - 10, 16); sfx.coo(); }
          popText(f.soft ? 'Egal.' : { pillar: pick(['Autsch!', 'Säule?!']), pigeons: 'Gurr!!', suitcase: pick(['Mein Koffer!', 'Sorry!']), group: pick(['Hey!', 'Drängeln!?', 'Na hallo?']) }[f.obstacle], p.x, ty);
          try { navigator.vibrate?.(45); } catch { /* unsupported */ }
          break;
        case 'wall':
          if (!reduceMotion) { V.shake = 9; V.flash = 0.3; }
          sfx.hit();
          popText('Entscheide dich!', 180, PLAYER_Y - 80, '#ffd400', 20);
          break;
        case 'app':
          V.app = { n: f.gleis, good: sp.gleis.good.app, t: 0, dur: 4 };
          V.chips.app = { n: f.gleis, good: sp.gleis.good.app };
          sfx.ping();
          break;
        case 'durchsage': {
          const good = sp.gleis.good.durchsage;
          const msg = `${sp.spec.train.name} nach ${sp.spec.train.dest} fährt heute von Gleis ${f.gleis}.`;
          banner(good ? msg : garble(msg).replace(/Gleis \S+$/, `Gl… ${f.gleis}`), good ? null : 'kaum zu verstehen', '#7a6a4a', !good);
          V.chips.durchsage = { n: f.gleis, good };
          break;
        }
        case 'wrong': popText('Falsches Gleis!', 180, 300, '#ff5a5a', 30); sfx.fail(); break;
        case 'backtrack':
          popText(`Zurück zu Gleis ${f.gleis}!`, 180, 300, '#ffd400', 24);
          V.gleisFlapT = 0;
          V.chips.tafel = { n: f.gleis, good: true };
          break;
        case 'bahncard': popText('BahnCard: Zug wartet!', 180, 260, '#3ddc97', 22); sfx.star(); break;
        case 'board': setTimeout(() => sfx.beep(), 450); setTimeout(() => sfx.win(), 500); setTimeout(() => sfx.depart(), 950); break;
        case 'missed': sfx.beep(); setTimeout(() => sfx.depart(), 400); if (!reduceMotion) V.shake = 6; break;
      }
    }
    sp.fx.length = 0;
  }

  function step(sp, dt) {
    V.sp = sp;
    V.flapT += dt; V.gleisFlapT += dt;
    if (sp.phase === 'board' && sp.t > 0.5 && !V.confetti) { V.confetti = true; burst('confetti', 180, PLAYER_Y - 70, 70); }
    const si = Math.floor(sp.player.phase / Math.PI);
    if (sp.phase === 'run' && si !== V.stepI) { V.stepI = si; sfx.step(); }
    consume(sp);
    if (V.banner) { V.banner.t += dt; if (V.banner.t > V.banner.dur) V.banner = null; }
    if (V.app) { V.app.t += dt; if (V.app.t > V.app.dur) V.app = null; }
    if (V.chips.app) V.tutChip += dt;
    for (const P of V.particles) {
      P.t += dt; P.x += P.vx * dt; P.y += P.vy * dt; P.rot += P.vr * dt;
      if (P.world) P.y += sp.curV * dt;
      if (P.type === 'feather') { P.vy = Math.min(P.vy + 120 * dt, 50); P.vx *= 1 - dt * 2; P.x += Math.sin(P.t * 6) * 20 * dt; }
      else if (P.type === 'confetti') { P.vy += 520 * dt; P.vx *= 1 - dt * 1.2; }
      else { P.vx *= 1 - dt * 4.5; P.vy *= 1 - dt * 4.5; }
    }
    V.particles = V.particles.filter(P => P.t < P.life);
    for (const T of V.texts) T.t += dt;
    V.texts = V.texts.filter(T => T.t < T.dur);
    V.shake = Math.max(0, V.shake - dt * 30);
    V.flash = Math.max(0, V.flash - dt * 2);
  }

  function start(sp) {
    V.sp = sp;
    V.theme = themeFor(sp.spec);
    V.particles = []; V.texts = []; V.banner = null; V.app = null; V.confetti = false;
    V.flapT = 0; V.gleisFlapT = 0;
    V.chips = { tafel: { n: sp.gleis.tafel, good: sp.gleis.good.tafel } };
    V.tutChip = 0;
    resize();
  }

  // ---------- world ----------
  const TH = () => THEMES[V.theme];
  const sY = d => screenY(V.sp, d);
  function eachWorld(spacing, offset, margin, fn) {
    const s = V.sp.s;
    const dMin = s + PLAYER_Y - H - margin, dMax = s + PLAYER_Y + margin;
    const k0 = Math.ceil((dMin - offset) / spacing), k1 = Math.floor((dMax - offset) / spacing);
    for (let k = k0; k <= k1; k++) fn(k, sY(k * spacing + offset));
  }
  const worldOff = m => ((PLAYER_Y + V.sp.s) % m + m) % m;

  function drawFloor() {
    const th = TH(), T = th.tile;
    ctx.fillStyle = th.floor;
    ctx.fillRect(0, 0, W, H);
    const off = worldOff(T);
    if (th.alt !== th.floor) {
      ctx.fillStyle = th.alt;
      for (let y = off - T; y < H; y += T) {
        const k = Math.round((PLAYER_Y + V.sp.s - y) / T);
        for (let c = 0; c * T < W; c++) if (((k + c) & 1) === 0) ctx.fillRect(c * T, y, T, T);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      for (let y = off - T; y < H; y += T) ctx.fillRect(0, y, W, 1);
      for (let c = 1; c * T < W; c++) ctx.fillRect(c * T, 0, 1, H);
    }
    if (th.walls === 'street') {
      ctx.fillStyle = 'rgba(240,240,240,0.55)';
      const o2 = worldOff(56);
      for (let y = o2 - 56; y < H; y += 56) { ctx.fillRect(128, y, 4, 28); ctx.fillRect(228, y, 4, 28); }
    } else {
      ctx.fillStyle = 'rgba(210,215,228,0.14)';
      ctx.fillRect(125, 0, 10, H); ctx.fillRect(225, 0, 10, H);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      const o2 = worldOff(10);
      for (let y = o2 - 10; y < H; y += 10) { ctx.fillRect(125, y, 10, 3); ctx.fillRect(225, y, 10, 3); }
    }
  }

  function drawLights() {
    const th = TH();
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const street = th.walls === 'street';
    eachWorld(street ? 220 : 260, 0, 120, (k, y) => {
      const cx = street ? (k & 1 ? 54 : 306) : 180;
      ctx.save();
      ctx.translate(cx, y);
      ctx.scale(1, street ? 0.7 : 0.45);
      const r = street ? 120 : 170;
      const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      g.addColorStop(0, rgba(th.light, th.li)); g.addColorStop(1, rgba(th.light, 0));
      ctx.fillStyle = g;
      ctx.fillRect(-r, -r, 2 * r, 2 * r);
      ctx.restore();
    });
    ctx.restore();
  }

  function drawWalls() {
    const th = TH();
    for (const side of [0, 1]) {
      const x0 = side ? W - WALL : 0;
      const inner = side ? x0 : x0 + WALL;
      if (th.walls === 'shops') {
        ctx.fillStyle = '#151923';
        ctx.fillRect(x0, 0, WALL, H);
        eachWorld(170, side * 85, 170, (k, y) => {
          const hk = hash(k * 7 + side * 3);
          const c = SHOPC[hk % SHOPC.length];
          const f = th.dim ? 0.55 : 1;
          const gx = x0 + 4;
          if (th.dim && hk % 3 === 0) {
            ctx.fillStyle = '#0c0f15'; ctx.fillRect(gx, y - 130, 22, 130);
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            for (let yy = y - 128; yy < y; yy += 6) ctx.fillRect(gx, yy, 22, 1);
            return;
          }
          const g = ctx.createLinearGradient(side ? x0 + WALL : x0, 0, side ? x0 : x0 + WALL, 0);
          g.addColorStop(0, rgba(c, 0.15 * f)); g.addColorStop(1, rgba(c, 0.6 * f));
          ctx.fillStyle = g; ctx.fillRect(gx, y - 130, 22, 130);
          ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(gx, y - 66, 22, 2);
          ctx.fillStyle = rgba(c, f); ctx.fillRect(gx - 1, y - 142, 24, 8);
          ctx.save();
          ctx.globalCompositeOperation = 'lighter';
          const g2 = ctx.createLinearGradient(inner, 0, side ? inner - 56 : inner + 56, 0);
          g2.addColorStop(0, rgba(c, 0.13 * f)); g2.addColorStop(1, rgba(c, 0));
          ctx.fillStyle = g2; ctx.fillRect(side ? inner - 56 : inner, y - 130, 56, 130);
          ctx.restore();
        });
        ctx.fillStyle = '#323a4c';
      } else if (th.walls === 'tiles') {
        ctx.fillStyle = '#dfe3e8'; ctx.fillRect(x0, 0, WALL, H);
        ctx.fillStyle = 'rgba(0,0,0,0.08)';
        const o = worldOff(10);
        for (let y = o - 10; y < H; y += 10) ctx.fillRect(x0, y, WALL, 1);
        ctx.fillRect(x0 + 10, 0, 1, H); ctx.fillRect(x0 + 20, 0, 1, H);
        ctx.fillStyle = '#1f9d55'; ctx.fillRect(side ? x0 + 4 : x0 + 20, 0, 6, H);
        ctx.fillStyle = '#9aa1ab';
      } else if (th.walls === 'brick') {
        ctx.fillStyle = '#7a3b2a'; ctx.fillRect(x0, 0, WALL, H);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        const o = worldOff(16);
        for (let y = o - 16; y < H; y += 8) {
          ctx.fillRect(x0, y, WALL, 1);
          const row = Math.round((PLAYER_Y + V.sp.s - y) / 8);
          for (let x = x0 + ((row & 1) ? 0 : 8); x < x0 + WALL; x += 16) ctx.fillRect(x, y, 1, 8);
        }
        eachWorld(240, side * 120, 60, (k, y) => {
          const bx = side ? x0 + 2 : x0 + 6;
          ctx.fillStyle = '#5a3a22'; ctx.fillRect(bx, y - 8, 22, 10);
          ctx.fillStyle = '#3f8f3a'; circle(bx + 5, y - 10, 5); circle(bx + 11, y - 12, 6); circle(bx + 17, y - 10, 5);
          ctx.fillStyle = hash(k + side) % 2 ? '#e63946' : '#ffd400';
          circle(bx + 6, y - 14, 2); circle(bx + 13, y - 17, 2); circle(bx + 18, y - 13, 2);
        });
        ctx.fillStyle = '#4a2a1e';
      } else {
        ctx.fillStyle = '#565c66'; ctx.fillRect(x0, 0, WALL, H);
        ctx.fillStyle = 'rgba(0,0,0,0.18)';
        const o = worldOff(24);
        for (let y = o - 24; y < H; y += 24) ctx.fillRect(x0, y, WALL, 1);
        ctx.fillStyle = '#9aa0a8';
      }
      ctx.fillRect(side ? x0 : WALL - 3, 0, 3, H);
    }
  }

  function drawDoor(cx, top, bot, open) {
    const dw = 34, x = cx - dw / 2, y = top + 12, h = bot - y;
    ctx.fillStyle = '#9aa3ae'; rrect(x - 2, y - 2, dw + 4, h + 2, 4); ctx.fill();
    const g = ctx.createLinearGradient(0, y, 0, bot);
    g.addColorStop(0, '#fff3c4'); g.addColorStop(1, '#ffcf5a');
    ctx.fillStyle = g; ctx.fillRect(x, y, dw, h);
    const pw = (dw / 2) * (1 - open);
    if (pw > 0.5) {
      ctx.fillStyle = '#dfe4ea'; ctx.fillRect(x, y, pw, h); ctx.fillRect(x + dw - pw, y, pw, h);
      ctx.fillStyle = '#1b2230';
      if (pw > 8) { ctx.fillRect(x + 3, y + 5, pw - 6, 22); ctx.fillRect(x + dw - pw + 3, y + 5, pw - 6, 22); }
    }
    ctx.fillStyle = open > 0.98 ? '#3ddc97' : '#ff4d4d';
    circle(cx, top + 6, 2.5);
  }

  function drawCar(x, top, bot, i, st) {
    const w = 340, h = bot - top;
    ctx.save();
    rrect2(x, top, w, h, i === -4 ? 34 : 8, i === 1 ? 46 : 8);
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, '#ffffff'); g.addColorStop(0.7, '#e7ebf0'); g.addColorStop(1, '#c4cbd4');
    ctx.fillStyle = g; ctx.fill(); ctx.clip();
    ctx.fillStyle = '#1b2230'; ctx.fillRect(x, top + 16, w, 26);
    ctx.fillStyle = '#d9dee5';
    for (let k = 1; k < 9; k++) ctx.fillRect(x + k * 38, top + 16, 3, 26);
    ctx.fillStyle = st.color; ctx.fillRect(x, top + 48, w, 6);
    if (i === 1) { ctx.fillStyle = '#ffe9a8'; circle(x + w - 10, bot - 14, 4); }
    ctx.restore();
    for (const dx of [110, 210, 310]) if (!(i === 1 && dx === 310)) drawDoor(x + dx, top, bot, st.open);
    font('800', 10);
    text(st.label, x + 26, top + 70, st.color, 'left');
    if (st.dest) { font('700', 9); text('→ ' + st.dest, x + 128, top + 70, '#6b7280', 'left'); }
  }

  function drawCars(top, bot, st) {
    const base = -30 + st.x;
    for (let i = -4; i <= 1; i++) {
      const cx = base + i * 350;
      if (cx > W || cx + 340 < 0) continue;
      drawCar(cx, top, bot, i, st);
    }
  }

  function drawBusSeg(x, top, bot, i) {
    const w = 340, sp = V.sp;
    ctx.save();
    rrect2(x, top, w, bot - top, i === -1 ? 14 : 6, i === 1 ? 26 : 6);
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, '#fbfbf7'); g.addColorStop(1, '#cfd3d6');
    ctx.fillStyle = g; ctx.fill(); ctx.clip();
    ctx.fillStyle = '#1b2230'; ctx.fillRect(x, top + 10, w, 32);
    ctx.fillStyle = SEV.color; ctx.fillRect(x, top + 48, w, 8);
    ctx.restore();
    for (const dx of [110, 210, 310]) if (!(i === 1 && dx === 310)) drawDoor(x + dx, top, bot, sp.doors);
    font('900', 11); text('SEV', x + 24, top + 72, SEV.color, 'left');
    ctx.fillStyle = '#1d2129'; circle(x + 60, bot, 9); circle(x + w - 60, bot, 9);
  }

  function drawTrainArea(y) {
    const sp = V.sp;
    ctx.fillStyle = sp.spec.bus ? '#16191f' : '#0e1119';
    ctx.fillRect(0, -40, W, y + 38);
    if (sp.spec.bus) {
      const top = y - 92, bot = y - 12, base = -30 + sp.trainX;
      for (let i = -1; i <= 1; i++) { const cx = base + i * 350; if (cx <= W && cx + 340 >= 0) drawBusSeg(cx, top, bot, i); }
      ctx.fillStyle = '#9aa0a8'; ctx.fillRect(0, y - 4, W, 8);
      ctx.strokeStyle = '#8f96a2'; ctx.lineWidth = 3; line(342, y + 8, 342, y - 58);
      ctx.fillStyle = '#ffd400'; circle(342, y - 68, 12);
      ctx.fillStyle = '#1f9d55'; circle(342, y - 68, 10);
      font('900', 13); text('H', 342, y - 67.5, '#ffd400', 'center', 'middle');
      return;
    }
    ctx.fillStyle = '#2b2f38';
    for (let x = 0; x < W; x += 18) ctx.fillRect(x, y - 40, 8, 30);
    ctx.fillStyle = '#6b7280'; ctx.fillRect(0, y - 36, W, 3); ctx.fillRect(0, y - 18, W, 3);
    const top = y - 96, bot = y - 10;
    const color = (LINES[sp.spec.train.type] || LINES.RE).color;
    const main = { color, label: sp.spec.train.type, open: sp.doors, x: sp.trainX };
    if (sp.fork) {
      const truthLeft = sp.fork.sides.L === sp.gleis.truth;
      const wrong = { color: '#6b7280', label: 'RE', open: 0, x: 0, dest: 'Hintertupfingen' };
      for (const [side, x0, x1] of [['L', -10, 180], ['R', 180, W + 10]]) {
        ctx.save();
        ctx.beginPath(); ctx.rect(x0, -50, x1 - x0, y + 60); ctx.clip();
        drawCars(top, bot, (side === 'L') === truthLeft ? main : wrong);
        ctx.restore();
      }
    } else drawCars(top, bot, main);
    ctx.fillStyle = '#cfd3da'; ctx.fillRect(0, y - 4, W, 10);
    ctx.fillStyle = 'rgba(255,212,0,0.6)'; ctx.fillRect(0, y + 24, W, 7);
  }

  function drawFork() {
    const sp = V.sp, f = sp.fork;
    if (!f) return;
    const yb = sY(f.d0), yt = sY(sp.D) - 100;
    if (yb < -20 || yt > H + 20) return;
    const x0 = 136, x1 = 224;
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x0 + 6, yt, x1 - x0, yb - yt + 10);
    const g = ctx.createLinearGradient(x0, 0, x1, 0);
    g.addColorStop(0, '#4a5368'); g.addColorStop(0.5, '#3a4254'); g.addColorStop(1, '#2a3040');
    ctx.fillStyle = g; ctx.fillRect(x0, yt, x1 - x0, yb - yt);
    ctx.save();
    ctx.beginPath(); ctx.rect(x0, yb - 16, x1 - x0, 16); ctx.clip();
    ctx.fillStyle = '#ffd400'; ctx.fillRect(x0, yb - 16, x1 - x0, 16);
    ctx.fillStyle = '#111';
    for (let x = x0 - 20; x < x1; x += 16) { ctx.beginPath(); ctx.moveTo(x, yb); ctx.lineTo(x + 8, yb); ctx.lineTo(x + 24, yb - 16); ctx.lineTo(x + 16, yb - 16); ctx.fill(); }
    ctx.restore();
  }

  // ---------- entities ----------
  function drawPlayer() {
    const sp = V.sp, p = sp.player;
    const run = Math.sin(p.phase) * p.amp, bob = Math.abs(Math.cos(p.phase)) * 3 * p.amp;
    const y = PLAYER_Y - p.board * 46, sc = 1 - p.board * 0.35;
    const alpha = 1 - clamp((p.board - 0.55) / 0.45, 0, 1);
    if (alpha <= 0) return;
    const lean = clamp((LANES[p.lane] - p.x) * 0.006, -0.35, 0.35);
    ctx.save();
    ctx.globalAlpha = alpha;
    if (p.boost > 0 && sp.phase === 'run') { drawRunner(look, p.x, y + 26, run, bob, sc, lean, true); drawRunner(look, p.x, y + 13, run, bob, sc, lean, true); }
    if (p.stun > 0 && Math.floor(sp.time * 14) % 2 === 0) ctx.globalAlpha *= 0.55;
    drawRunner(look, p.x, y, run, bob, sc, lean, false);
    ctx.restore();
    if (p.stun > 0) for (let i = 0; i < 3; i++) { const a = sp.time * 7 + i * 2.09; ctx.fillStyle = '#ffd400'; starPath(p.x + Math.cos(a) * 15, y - 44 + Math.sin(a) * 5, 4.5); ctx.fill(); }
    if (sp.phase === 'wrong' || (sp.phase === 'missed' && sp.t > 0.8)) { font('800', 18); text(sp.phase === 'wrong' ? '?!' : '…', p.x + 14, y - 40, 'rgba(255,255,255,0.85)', 'left'); }
  }

  function drawPillar(o, x, y) {
    shadow(x + 6, y + 12, 30, 9, 0.35);
    const g = ctx.createLinearGradient(x - 22, 0, x + 22, 0);
    g.addColorStop(0, '#9aa1ae'); g.addColorStop(0.45, '#dde1e8'); g.addColorStop(1, '#7d8492');
    ctx.fillStyle = g; ctx.fillRect(x - 22, y - 90, 44, 102);
    ctx.fillStyle = '#5d6472'; ctx.fillRect(x - 25, y + 6, 50, 9);
    const [bg, fg] = POSTERS[o.poster];
    ctx.fillStyle = bg; rrect(x - 15, y - 66, 30, 42, 3); ctx.fill();
    ctx.fillStyle = fg; circle(x, y - 54, 6); ctx.fillRect(x - 10, y - 42, 20, 3); ctx.fillRect(x - 10, y - 36, 14, 3);
  }

  function drawBird(x, y, face, fly, wingPh, peck) {
    ctx.save();
    ctx.translate(x, y); ctx.scale(face * 1.25, 1.25);
    if (fly) {
      const w = Math.sin(wingPh);
      ctx.fillStyle = '#a9b0bc';
      ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(-6, -10 - w * 9); ctx.lineTo(4, -3); ctx.fill();
      ctx.beginPath(); ctx.moveTo(-3, 1); ctx.lineTo(-7, 8 + w * 9); ctx.lineTo(4, 1); ctx.fill();
    }
    ctx.fillStyle = '#5d6573'; ctx.beginPath(); ctx.moveTo(-7, 0); ctx.lineTo(-15, -3); ctx.lineTo(-15, 3); ctx.fill();
    ctx.fillStyle = '#8e96a3'; ctx.beginPath(); ctx.ellipse(0, 0, 9, 6, 0, 0, TAU); ctx.fill();
    const hy = peck * 5;
    ctx.fillStyle = '#5fae8f'; ctx.beginPath(); ctx.ellipse(5, -3 + hy * 0.4, 4, 4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#6f7784'; circle(7, -6 + hy, 3.6);
    ctx.fillStyle = '#ff9f1a'; circle(8.4, -6.8 + hy, 0.9);
    ctx.fillStyle = '#e7c9a0'; ctx.beginPath(); ctx.moveTo(10.3, -6.6 + hy); ctx.lineTo(13, -5.6 + hy); ctx.lineTo(10.3, -4.8 + hy); ctx.fill();
    ctx.restore();
  }

  function drawPigeons(o, x, y) {
    o.birds.forEach((b, i) => {
      let bx = x + b.dx, by = y + b.dy;
      if (o.fled) {
        const f = o.fly;
        bx += b.fx * f * 160; by += -f * f * 220 - f * 70;
        ctx.save(); ctx.globalAlpha = clamp(1 - f / 1.1, 0, 1);
        drawBird(bx, by, b.fx < 0 ? -1 : 1, true, V.sp.time * 30 + i, 0);
        ctx.restore();
      } else {
        shadow(bx, by + 6, 8, 3, 0.25);
        drawBird(bx, by, b.face, false, 0, Math.pow(Math.max(0, Math.sin(V.sp.time * 5 + b.ph)), 8));
      }
    });
  }

  function drawSuitcase(o, x, y) {
    if (!o.hit) shadow(x, y + 15, 17, 5, 0.3);
    ctx.save();
    ctx.translate(x + o.hx, y + o.hy); ctx.rotate(o.rot);
    ctx.strokeStyle = '#2b2f38'; ctx.lineWidth = 2.5; line(-6, -22, -6, -35); line(6, -22, 6, -35);
    ctx.fillStyle = '#2b2f38'; rrect(-8, -38, 16, 4, 2); ctx.fill();
    ctx.fillStyle = SUITC[o.color]; rrect(-15, -23, 30, 36, 6); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.22)'; ctx.fillRect(-8, -19, 2, 28); ctx.fillRect(-1, -19, 2, 28); ctx.fillRect(6, -19, 2, 28);
    ctx.fillStyle = '#1d2129'; circle(-11, 14, 3); circle(11, 14, 3);
    ctx.restore();
    if (!o.hit && o.mv === 0 && o.d - V.sp.s < 560 && Math.floor(V.sp.time * 5) % 2 === 0) {
      const dir = o.to > o.from ? 1 : -1;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.moveTo(x + dir * 30, y - 50); ctx.lineTo(x + dir * 18, y - 57); ctx.lineTo(x + dir * 18, y - 43); ctx.fill();
      ctx.fillRect(dir > 0 ? x + 4 : x - 18, y - 52, 14, 4);
    }
  }

  function drawGroup(o, x, y) {
    for (const pp of o.people) {
      const spread = o.part * (pp.dx < 0 ? -40 : pp.dx > 0 ? 40 : 0) * (1 + Math.abs(pp.dx) / 68);
      const px = x + pp.dx + spread + Math.sin(V.sp.time * 38 + pp.dx) * 3 * o.jostle + Math.sin(V.sp.time * 1.5 + pp.dx) * 1.5;
      const py = y + pp.dy;
      shadow(px, py + 11, 12, 4, 0.28);
      ctx.fillStyle = JACKETS[pp.c]; rrect(px - 11, py - 14, 22, 25, 9); ctx.fill();
      ctx.fillStyle = SKIN[pp.skin]; circle(px, py - 20, 7.5);
      ctx.fillStyle = pp.cap ? JACKETS[pp.c] : HAIR[pp.hair];
      ctx.beginPath(); ctx.arc(px, py - 21, 7.9, Math.PI * 1.05, Math.PI * 1.95); ctx.fill();
      ctx.fillStyle = '#222'; circle(px - 2.6, py - 19, 1.1); circle(px + 2.6, py - 19, 1.1);
      if (pp.phone) { ctx.fillStyle = '#20242c'; rrect(px + 6, py - 27, 7, 11, 2); ctx.fill(); ctx.fillStyle = '#8fd3ff'; ctx.fillRect(px + 7.2, py - 25.8, 4.6, 7.5); }
      if (pp.guide) {
        const ux = px + 9, uy = py - 50;
        ctx.strokeStyle = '#333'; ctx.lineWidth = 1.6; line(px + 9, py - 8, ux, uy);
        for (let k = 0; k < 6; k++) {
          ctx.fillStyle = k % 2 ? '#fff' : '#e63946';
          ctx.beginPath(); ctx.moveTo(ux, uy); ctx.arc(ux, uy, 16, Math.PI + (k * Math.PI) / 6, Math.PI + ((k + 1) * Math.PI) / 6); ctx.closePath(); ctx.fill();
        }
      }
    }
  }

  function drawPfand(it, y) {
    const x = LANES[it.lane], bob = Math.sin(V.sp.time * 4 + it.t) * 3;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x, y - 10, 0, x, y - 10, 26);
    g.addColorStop(0, 'rgba(150,255,120,0.3)'); g.addColorStop(1, 'rgba(150,255,120,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 26, y - 36, 52, 52);
    ctx.restore();
    shadow(x, y + 8, 8, 3, 0.3);
    ctx.save();
    ctx.translate(x, y - 10 + bob);
    ctx.fillStyle = 'rgba(80,190,90,0.92)';
    rrect(-6, -8, 12, 22, 4); ctx.fill();
    ctx.fillRect(-3, -15, 6, 8);
    ctx.fillStyle = '#d6f5d0'; ctx.fillRect(-3.5, -17, 7, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.45)'; ctx.fillRect(-4, -5, 2, 15);
    ctx.fillStyle = '#fff'; rrect(-5, 0, 10, 7, 1.5); ctx.fill();
    font('900', 6); text('25¢', 0, 4, '#2a7a2a', 'center', 'middle');
    ctx.restore();
  }

  function drawEntities() {
    const sp = V.sp, list = [];
    for (const o of sp.obstacles) { const y = sY(o.d); if (y > -140 && y < H + 140) list.push([y, o]); }
    for (const it of sp.pickups) { const y = sY(it.d); if (y > -60 && y < H + 60) list.push([y, { type: 'pfand', it }]); }
    list.push([PLAYER_Y + 0.5 - sp.player.board * 46, null]);
    list.sort((a, b) => a[0] - b[0]);
    for (const [y, o] of list) {
      if (!o) { drawPlayer(); continue; }
      switch (o.type) {
        case 'pillar': drawPillar(o, o.x, y); break;
        case 'pigeons': drawPigeons(o, o.x, y); break;
        case 'suitcase': drawSuitcase(o, o.x, y); break;
        case 'group': drawGroup(o, o.x + Math.sin(sp.time * 2 + o.t) * 3, y); break;
        case 'pfand': drawPfand(o.it, y); break;
      }
    }
  }

  function drawParticles() {
    for (const P of V.particles) {
      const k = 1 - P.t / P.life;
      if (P.type === 'dust') { ctx.fillStyle = `rgba(220,225,235,${0.5 * k})`; circle(P.x, P.y, P.size * (1 + P.t * 2)); }
      else if (P.type === 'feather') {
        ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.rot);
        ctx.fillStyle = `rgba(232,235,242,${k})`; ctx.beginPath(); ctx.ellipse(0, 0, P.size, P.size * 0.42, 0, 0, TAU); ctx.fill();
        ctx.restore();
      } else if (P.type === 'confetti') {
        ctx.save(); ctx.translate(P.x, P.y); ctx.rotate(P.rot); ctx.scale(Math.cos(P.t * 9 + P.rot), 1);
        ctx.globalAlpha = Math.min(1, k * 2); ctx.fillStyle = P.color; ctx.fillRect(-P.size / 2, -P.size / 4, P.size, P.size / 2);
        ctx.restore();
      } else if (P.type === 'spark') {
        ctx.strokeStyle = `rgba(255,210,122,${k})`; ctx.lineWidth = P.size; line(P.x, P.y, P.x - P.vx * 0.05, P.y - P.vy * 0.05);
      }
    }
  }

  // ---------- overhead signs ----------
  const PAR = 1.3, SIGN_SP = 1150, SIGN_OFF = 650;
  function drawOverhead() {
    const sp = V.sp;
    if (V.theme !== 'dorf' && V.theme !== 'sev') {
      const dMin = sp.s + (PLAYER_Y - H - 60) / PAR, dMax = sp.s + (PLAYER_Y + 80) / PAR;
      for (let k = Math.ceil((dMin - SIGN_OFF) / SIGN_SP); k <= Math.floor((dMax - SIGN_OFF) / SIGN_SP); k++) {
        const d = k * SIGN_SP + SIGN_OFF;
        if (d > sp.D - 950) continue;
        const sy = PLAYER_Y - (d - sp.s) * PAR;
        ctx.strokeStyle = '#4b5262'; ctx.lineWidth = 2; line(78, sy - 16, 78, sy - 80); line(282, sy - 16, 282, sy - 80);
        ctx.fillStyle = '#0b2a6b'; rrect(32, sy - 16, 296, 32, 6); ctx.fill();
        font('700', 13); text(SIGNS[hash(k) % SIGNS.length], 180, sy + 1, '#fff', 'center', 'middle');
      }
    }
    if (sp.fork) {
      const sy = PLAYER_Y - (sp.fork.d0 - 110 - sp.s) * PAR;
      if (sy > -60 && sy < H + 40) {
        ctx.strokeStyle = '#4b5262'; ctx.lineWidth = 2; line(70, sy - 18, 70, sy - 84); line(290, sy - 18, 290, sy - 84);
        for (const [k, x0] of [['L', 30], ['R', 184]]) {
          ctx.fillStyle = '#0b2a6b'; rrect(x0, sy - 18, 146, 36, 6); ctx.fill();
          font('800', 16);
          text(k === 'L' ? `↖ Gleis ${sp.fork.sides.L}` : `Gleis ${sp.fork.sides.R} ↗`, x0 + 73, sy + 1, '#fff', 'center', 'middle');
        }
      }
    }
  }

  // ---------- HUD (chunky game look: yellow bar, ink outlines) ----------
  function inkBox(x, y, w, h, r, fill, lw = 3, drop = 0) {
    if (drop) { ctx.fillStyle = INK; rrect(x, y + drop, w, h, r); ctx.fill(); }
    ctx.fillStyle = fill; rrect(x, y, w, h, r); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = lw; rrect(x, y, w, h, r); ctx.stroke();
  }

  function drawHUD() {
    const sp = V.sp, spec = sp.spec;
    ctx.fillStyle = YEL; ctx.fillRect(0, 0, W, HUD_H);
    ctx.fillStyle = INK; ctx.fillRect(0, HUD_H - 3, W, 3);
    const color = spec.bus ? SEV.color : spec.train.type === 'RE' ? '#5b6475' : (LINES[spec.train.type] || LINES.RE).color;
    font('400', 15, DISP);
    const badge = spec.train.name;
    const bw = ctx.measureText(badge).width + 14;
    inkBox(10, 8, bw, 24, 7, color, 2.5);
    text(flap(badge, V.flapT, 0), 17, 21, '#fff', 'left', 'middle');
    font('400', 19, DISP);
    text(ellipsize('→ ' + spec.train.dest, 286 - bw - 22), bw + 18, 21, INK, 'left', 'middle');
    inkBox(298, 6, 54, 52, 10, '#fff', 3, 3);
    if (spec.bus) {
      font('900', 9); text('HALT', 325, 18, INK, 'center', 'middle');
      font('400', 26, DISP); text('H', 325, 40, '#1f9d55', 'center', 'middle');
    } else {
      const broken = !V.chips.tafel.good;
      font('900', 9); text(broken ? 'GESTÖRT' : 'GLEIS', 325, 18, broken ? RED : INK, 'center', 'middle');
      const flick = broken && Math.random() < 0.08;
      font('400', 28, DISP);
      text(flick ? String((sp.gleis.shown % 14) + 1) : flap(String(sp.gleis.shown), V.gleisFlapT, 0.1), 325, 40, INK, 'center', 'middle');
    }
    const bx = 10, bw2 = 176, by = 42, bh = 14;
    const frac = clamp(sp.s / sp.D, 0, 1);
    const need = (sp.D - sp.s) / sp.v;
    const ratio = need > 0 ? sp.timeLeft / need : 9;
    inkBox(bx, by, bw2, bh, 7, '#fff6c9', 2.5);
    ctx.fillStyle = ratio > 1.15 ? GRN : ratio > 1 ? '#ffb300' : RED;
    rrect(bx + 2, by + 2, Math.max(10, (bw2 - 4) * frac), bh - 4, 5); ctx.fill();
    ctx.fillStyle = look.jacket[1]; circle(bx + bw2 * frac, by + bh / 2, 8);
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(bx + bw2 * frac, by + bh / 2, 8, 0, TAU); ctx.stroke();
    if (sp.phase === 'board' || (sp.phase === 'done' && sp.result?.made)) { font('400', 20, DISP); text('AN BORD!', 290, 48, '#1f9d55', 'right', 'middle'); }
    else if (sp.phase === 'missed' || sp.timeLeft <= 0) { font('400', 20, DISP); text(spec.bus ? 'BUS WEG' : 'ZUG WEG', 290, 48, RED, 'right', 'middle'); }
    else {
      const m = Math.max(0, Math.ceil(sp.timeLeft / SEC_PER_MIN));
      const low = sp.timeLeft < 4.5 && sp.phase === 'run';
      font('900', 12); text('Min', 290, 51, INK, 'right', 'middle');
      const minW = ctx.measureText('Min').width;
      font('400', 30, DISP);
      text(String(m), 290 - minW - 4, 48, low && Math.floor(sp.time * 6) % 2 ? RED : INK, 'right', 'middle');
    }
  }

  // What each source said, with its trust cue: green = trust, red = maybe wrong.
  function drawChips() {
    const sp = V.sp;
    if (sp.spec.bus) return;
    const c = V.chips, items = [{ icon: '🪧', ...c.tafel, cue: c.tafel.good ? 'ok' : 'gestört' }];
    if (c.app) items.push({ icon: '📱', ...c.app, cue: c.app.good ? 'live' : 'alt' });
    if (c.durchsage) items.push({ icon: '📢', ...c.durchsage, cue: c.durchsage.good ? 'klar' : 'rauscht' });
    let x = 8;
    const y = HUD_H + 8;
    for (const it of items) {
      font('400', 17, DISP);
      const numW = ctx.measureText(String(it.n)).width;
      font('900', 10);
      const cueW = ctx.measureText(it.cue).width;
      const w = 30 + numW + cueW + 14;
      inkBox(x, y, w, 26, 13, it.good ? '#d9ffe9' : '#ffe0dc', 2.5, 2);
      font('400', 14); text(it.icon, x + 6, y + 13.5, INK, 'left', 'middle');
      font('400', 17, DISP); text(String(it.n), x + 26, y + 14, INK, 'left', 'middle');
      font('900', 10); text(it.cue, x + w - 8, y + 14, it.good ? '#13854a' : '#c92a1f', 'right', 'middle');
      x += w + 6;
    }
  }

  function drawBanner() {
    const a = V.banner;
    if (!a) return;
    const inT = ease(clamp(a.t / 0.3, 0, 1)), outT = ease(clamp((a.t - (a.dur - 0.3)) / 0.3, 0, 1));
    const y = HUD_H + 40 - 70 * (1 - inT) - 110 * outT;
    inkBox(8, y, 344, 52, 12, '#fff', 3, 4);
    font('400', 22); text(a.garbled ? '📻' : '📢', 28, y + 27, INK, 'center', 'middle');
    let chipW = 0;
    if (a.chip) {
      font('900', 10);
      chipW = ctx.measureText(a.chip).width + 14;
      inkBox(340 - chipW, y + 15, chipW, 22, 11, RED, 2);
      text(a.chip, 340 - chipW / 2, y + 26.5, '#fff', 'center', 'middle');
    }
    font(a.garbled ? 'italic 800' : '800', 12.5);
    const lines = wrap(a.text, 340 - chipW - 8 - 46, 2);
    const y0 = lines.length === 1 ? y + 26.5 : y + 19;
    lines.forEach((l, i) => text(l, 46, y0 + i * 15, a.garbled ? '#6b7280' : INK, 'left', 'middle'));
  }

  function drawApp() {
    const a = V.app;
    if (!a) return;
    const inT = ease(clamp(a.t / 0.3, 0, 1)), outT = ease(clamp((a.t - (a.dur - 0.3)) / 0.3, 0, 1));
    const y = H + 6 - 74 * inT + 84 * outT;
    inkBox(10, y - 64, 240, 56, 14, '#fff', 3, 4);
    inkBox(18, y - 56, 30, 30, 8, '#3a86ff', 2);
    font('400', 16); text('📱', 33, y - 40, '#fff', 'center', 'middle');
    font('900', 10);
    text(a.good ? 'REISE-APP · LIVE' : 'REISE-APP · VOR 23 MIN', 56, y - 49, a.good ? '#13854a' : RED, 'left', 'middle');
    font('400', 17, DISP); text(`Gleis ${a.n}`, 56, y - 30, a.good ? INK : '#8a8f9c', 'left', 'middle');
    font('800', 10); text(a.good ? 'Echtzeit-Daten' : 'Daten evtl. veraltet', 56, y - 15, '#6b7280', 'left', 'middle');
  }

  function drawIntro() {
    const sp = V.sp, t = sp.t, spec = sp.spec;
    const a = t < 0.25 ? ease(t / 0.25) : t > INTRO - 0.3 ? 1 - ease(clamp((t - INTRO + 0.3) / 0.3, 0, 1)) : 1;
    ctx.save();
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.fillStyle = 'rgba(10,14,40,0.45)'; ctx.fillRect(0, HUD_H, W, H - HUD_H);
    ctx.translate(180, 300);
    ctx.scale(0.9 + 0.1 * a, 0.9 + 0.1 * a);
    inkBox(-146, -78, 292, 156, 18, '#fff', 4, 6);
    font('400', 24, DISP); text(ellipsize(`${spec.train.name} → ${spec.train.dest}`, 270), 0, -48, INK, 'center', 'middle');
    font('800', 13);
    text(spec.bus ? 'Haltestelle vor dem Bahnhof' : `Tafel: Gleis ${sp.gleis.tafel}${sp.gleis.good.tafel ? '' : ' (gestört!)'}`, 0, -22, '#5b6475', 'center', 'middle');
    inkBox(-62, -4, 124, 48, 14, YEL, 3, 4);
    font('400', 32, DISP); text(`${Math.round(spec.timeLimit / SEC_PER_MIN)} Min`, 0, 21, INK, 'center', 'middle');
    font('900', 12); text('◀ tippen · tippen ▶', 0, 62, '#5b6475', 'center', 'middle');
    ctx.restore();
  }

  function drawOutcome() {
    const sp = V.sp;
    if (sp.phase === 'board' && sp.t > 0.45) {
      const t = sp.t - 0.45, s = t < 0.25 ? ease(t / 0.25) * 1.12 : 1.12 - 0.12 * Math.min(1, (t - 0.25) / 0.15);
      ctx.save(); ctx.translate(180, 250); ctx.scale(s, s); ctx.rotate(-0.05);
      font('400', 36, DISP); outlined(sp.spec.bus ? 'BUS ERWISCHT!' : 'ERWISCHT!', 0, 0, YEL, 9);
      font('400', 18, DISP); outlined(`♻ ${sp.pfand} Pfand${sp.hits === 0 ? ' · sauber +3 €' : ''}`, 0, 38, '#9bf0c0', 6);
      ctx.restore();
    } else if (sp.phase === 'missed' && sp.t > 0.2) {
      const t = sp.t - 0.2, s = t < 0.2 ? ease(t / 0.2) * 1.15 : 1.15 - 0.15 * Math.min(1, (t - 0.2) / 0.15);
      ctx.save(); ctx.translate(180, 250); ctx.scale(s, s); ctx.rotate(0.05);
      font('400', 46, DISP); outlined(sp.spec.bus ? 'BUS WEG.' : 'ZUG WEG.', 0, 0, RED, 10);
      ctx.restore();
    }
  }

  // First-journey coach marks instead of explanation texts.
  function bubble(x, y, str) {
    font('400', 17, DISP);
    const w = ctx.measureText(str).width + 26;
    const bob = Math.sin(V.sp.time * 5) * 3;
    inkBox(x - w / 2, y - 18 + bob, w, 36, 18, '#fff', 3, 4);
    text(str, x, y + 1 + bob, INK, 'center', 'middle');
  }
  function drawTutorial() {
    const sp = V.sp;
    if (!sp.spec.tutorial || sp.phase !== 'run') return;
    if (sp.t < 2.6) bubble(180, PLAYER_Y - 120, '◀ Tippen zum Ausweichen ▶');
    else if (V.chips.app && V.tutChip < 3.5) bubble(180, HUD_H + 58, 'Grün = trau dich. Rot = Vorsicht!');
    else if (sp.fork && !sp.fork.chosen && sp.fork.d0 - sp.s < 900) bubble(180, 330, 'Wähl dein Gleis: links oder rechts!');
  }

  function drawTexts() {
    for (const T of V.texts) {
      const k = T.t / T.dur;
      const s = T.t < 0.12 ? ease(T.t / 0.12) * 1.25 : 1.25 - 0.25 * Math.min(1, (T.t - 0.12) / 0.12);
      ctx.save();
      ctx.globalAlpha = clamp(k > 0.65 ? 1 - (k - 0.65) / 0.35 : 1, 0, 1);
      ctx.translate(T.x, T.y - T.t * 28); ctx.scale(s, s);
      font('400', T.size, DISP); outlined(T.str, 0, 0, T.col, Math.max(5, T.size / 4));
      ctx.restore();
    }
  }

  function render(paused) {
    const sp = V.sp;
    if (!sp) return;
    ctx = own;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    const th = TH();
    ctx.save();
    if (V.shake > 0) ctx.translate((Math.random() - 0.5) * V.shake, (Math.random() - 0.5) * V.shake);
    drawFloor();
    drawLights();
    drawWalls();
    const doorY = sY(sp.D);
    if (doorY > -20) drawTrainArea(doorY);
    drawFork();
    drawEntities();
    drawParticles();
    drawOverhead();
    if (sp.player.boost > 0 && sp.phase === 'run') {
      ctx.strokeStyle = 'rgba(255,255,255,0.22)'; ctx.lineWidth = 2;
      for (let i = 0; i < 7; i++) { const x = 34 + Math.random() * 292, y = HUD_H + Math.random() * (H - HUD_H); line(x, y, x, y + 30 + Math.random() * 50); }
    }
    ctx.restore();
    if (th.tint) { ctx.fillStyle = th.tint; ctx.fillRect(0, 0, W, H); }
    const vg = ctx.createRadialGradient(180, 300, 170, 180, 300, 430);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, `rgba(0,0,0,${th.vign})`);
    ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    if (sp.slowmo > 0) {
      const g = ctx.createRadialGradient(180, 300, 150, 180, 300, 420);
      g.addColorStop(0, 'rgba(150,210,255,0)'); g.addColorStop(1, `rgba(150,210,255,${2 * sp.slowmo})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (sp.phase === 'run' && sp.timeLeft < 4.5) {
      const a = 0.22 + 0.16 * Math.sin(sp.time * 12);
      const g = ctx.createRadialGradient(180, 300, 200, 180, 300, 420);
      g.addColorStop(0, 'rgba(255,40,40,0)'); g.addColorStop(1, `rgba(255,40,40,${a})`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    }
    if (V.flash > 0) { ctx.fillStyle = `rgba(255,70,70,${V.flash * 0.35})`; ctx.fillRect(0, 0, W, H); }
    drawTexts();
    drawApp();
    drawChips();
    drawBanner();
    drawHUD();
    if (sp.phase === 'intro') drawIntro();
    drawTutorial();
    drawOutcome();
    if (sp.phase === 'wrong' && sp.t > 1.0) { ctx.fillStyle = `rgba(0,0,0,${clamp((sp.t - 1.0) / 0.3, 0, 1)})`; ctx.fillRect(0, 0, W, H); }
    if (paused) {
      ctx.fillStyle = 'rgba(10,14,40,0.7)'; ctx.fillRect(0, 0, W, H);
      font('400', 44, DISP); outlined('PAUSE', 180, 260, YEL, 9);
      font('400', 18, DISP); outlined('Tippen zum Weiterlaufen', 180, 304, '#fff', 6);
    }
  }

  return { start, step, render, resize };
}
