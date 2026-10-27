// Packs the game into one self-contained HTML file (dist/anschluss.html), e.g. for portals or sharing as a file.
// Modules stay real ES modules: they are embedded as text and loaded through blob URLs at runtime.
// Usage: node scripts/bundle.js [--embed]   (--embed: fixed height and transparent page for an iframe/chat embed)
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, posix } from 'node:path';

const root = new URL('..', import.meta.url).pathname;
const embed = process.argv.includes('--embed');
const read = p => readFileSync(join(root, p), 'utf8');

// Indentation, blank lines and comment-only lines are dropped; that is safe for this codebase's style.
const compact = src => src.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('//')).join('\n');

const mods = {};
(function collect(path) {
  if (mods[path]) return;
  mods[path] = compact(read(path));
  for (const m of mods[path].matchAll(/from\s+'(\.[^']+)'/g)) collect(posix.normalize(posix.join(posix.dirname(path), m[1])));
})('src/main.js');

let css = read('style.css');
if (embed) {
  css = css
    .replace(/html, body \{[^}]*\}/, 'html, body { margin: 0; color: var(--text); font-family: var(--font); }')
    .replace('height: 100dvh;', 'height: 640px;')
    .replace('max-height: 30vh;', 'max-height: 190px;')
    .replace('background: linear-gradient(180deg, var(--bg), var(--bg2));', '')
    + '\n#ui, #stage { border-radius: 14px; }\n#ui { background: linear-gradient(180deg, var(--bg), var(--bg2)); }\n';
}

const loader = `
const mods = JSON.parse(document.getElementById('mods').textContent);
const urls = {};
const resolve = (from, rel) => {
  const out = from.split('/').slice(0, -1);
  for (const s of rel.split('/')) { if (s === '..') out.pop(); else if (s !== '.') out.push(s); }
  return out.join('/');
};
const url = path => urls[path] ||= URL.createObjectURL(new Blob(
  [mods[path].replace(/from\\s+'(\\.[^']+)'/g, (_, rel) => "from '" + url(resolve(path, rel)) + "'")],
  { type: 'text/javascript' }));
import(url('src/main.js'));
`;

const body = read('index.html').match(/<body>([\s\S]*)<\/body>/)[1]
  .replace(/<script type="module" src="src\/main.js"><\/script>/, '');
const html = `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>Anschluss!</title>
<style>${css}</style>
</head>
<body>${body}
<script id="mods" type="application/json">${JSON.stringify(mods).replace(/</g, '\\u003c')}</script>
<script type="module">${loader}</script>
</body>
</html>
`;
mkdirSync(join(root, 'dist'), { recursive: true });
const out = join(root, 'dist', embed ? 'anschluss-embed.html' : 'anschluss.html');
writeFileSync(out, html);
console.log(`${out} (${(html.length / 1024).toFixed(0)} KB, ${Object.keys(mods).length} modules)`);
