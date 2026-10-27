// The journey network as SVG: whole route visible from the start, so players can plan ahead.
import { CITIES, OUTLINE, NODE_KINDS } from '../logic/content.js';

const VW = 360, VH = 300, PAD = 0.45;
const proj = ([lon, lat]) => [lon * 0.63, -lat];

// Fits the network into the view; returns a projection for [lon, lat] points.
export function mapProjection(net) {
  const pts = Object.values(net.nodes).map(n => proj(CITIES[n.city]));
  const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
  const x0 = Math.min(...xs) - PAD, x1 = Math.max(...xs) + PAD, y0 = Math.min(...ys) - PAD * 0.8, y1 = Math.max(...ys) + PAD * 0.8;
  const s = Math.min(VW / (x1 - x0), VH / (y1 - y0));
  const ox = (VW - (x1 - x0) * s) / 2, oy = (VH - (y1 - y0) * s) / 2;
  return lonLat => { const [x, y] = proj(lonLat); return [ox + (x - x0) * s, oy + (y - y0) * s]; };
}

export function mapSvg(run, { vehicle = false } = {}) {
  const net = run.net, P = mapProjection(net);
  const pos = id => P(CITIES[net.nodes[id].city]);
  const travelled = new Set(run.path.slice(1).map((id, i) => `${run.path[i]}>${id}`));
  const curLayer = net.nodes[run.at].layer;
  const outlinePts = OUTLINE.map(c => P(c).map(v => v.toFixed(1)).join(',')).join(' ');

  const edges = net.edges.map(e => {
    const [x1, y1] = pos(e.from), [x2, y2] = pos(e.to);
    const done = travelled.has(`${e.from}>${e.to}`);
    const fromLayer = net.nodes[e.from].layer;
    const next = e.from === run.at;
    const dead = !done && fromLayer < curLayer;
    const icb = e.lines.some(l => l.type === 'ICB');
    const cls = done ? 'e-done' : next ? 'e-next' : dead ? 'e-dead' : icb ? 'e-icb' : 'e-re';
    return `<line class="edge ${cls}" x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"/>`;
  }).join('');

  const nodes = Object.values(net.nodes).map(n => {
    const [x, y] = pos(n.id);
    const visited = run.path.includes(n.id);
    const here = n.id === run.at;
    const reachable = net.edges.some(e => e.from === run.at && e.to === n.id);
    const cls = here ? 'n-here' : visited ? 'n-visited' : reachable ? 'n-next' : n.layer < curLayer ? 'n-dead' : 'n-future';
    const below = y < VH - 26;
    return `<g class="node ${cls}" transform="translate(${x.toFixed(1)},${y.toFixed(1)})">
      ${here ? '<circle class="pulse" r="13"/>' : ''}
      <circle r="11"/>
      <text class="icon" y="1">${NODE_KINDS[n.kind].icon}</text>
      <text class="label" y="${below ? 22 : -16}">${n.city}</text>
    </g>`;
  }).join('');

  const veh = vehicle ? '<text id="veh" class="vehicle" x="0" y="0"></text>' : '';
  return `<svg class="map" viewBox="0 0 ${VW} ${VH}" role="img" aria-label="Streckennetz">
    <polygon class="land" points="${outlinePts}"/>
    ${edges}${nodes}${veh}
  </svg>`;
}

export function nodePoint(net, id) {
  return mapProjection(net)(CITIES[net.nodes[id].city]);
}
