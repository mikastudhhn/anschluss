// Sharing and challenges work without a server: everything travels inside the text and the link.

export function scoreText(score) {
  if (score === 0) return 'auf die Minute';
  return score > 0 ? `${score} Min zu früh` : `${-score} Min zu spät`;
}

export function shareText({ day, from, to, occasion, line, score, stars, link }) {
  return `Anschluss! Tagesreise #${day}\n${from} → ${to} · ${occasion}\n${line}  ${scoreText(score)} ${'⭐'.repeat(stars)}\n${link}`;
}

const toB64 = str => btoa(String.fromCharCode(...new TextEncoder().encode(str)))
  .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = b64 => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)));

export const cleanName = name => String(name).replace(/[<>&"'`]/g, '').trim().slice(0, 16);

export function encodeChallenge({ day, score, name, line }) {
  return toB64(JSON.stringify({ d: day, s: score, n: name, l: line }));
}

export function decodeChallenge(token) {
  try {
    const o = JSON.parse(fromB64(token));
    if (!Number.isInteger(o.d) || o.d < 1 || !Number.isInteger(o.s) || typeof o.n !== 'string' || typeof o.l !== 'string') return null;
    return { day: o.d, score: o.s, name: cleanName(o.n), line: [...o.l].slice(0, 24).join('') };
  } catch {
    return null;
  }
}

export function challengeFromHash(hash) {
  const m = /^#c=([\w-]+)$/.exec(hash || '');
  return m ? decodeChallenge(m[1]) : null;
}
