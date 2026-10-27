// HTML templates for every non-sprint screen. Pure: state in, markup out. Actions use data-act attributes.
import { ITEMS, CHARACTERS, REGIONS, STUFEN, LADDER, OCCASIONS, EVENTS, LOUNGE, LINES, SEV, TEXT } from '../logic/content.js';
import { departures, taxiOptions, needMinutes, kioskOffers, loungeUsed, eventPending } from '../logic/run.js';
import { unlocked, nextUnlock, level } from '../logic/progress.js';
import { mapSvg } from './mapView.js';

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const clock = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const signed = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');
const minutesWord = s => (s === 0 ? 'auf die Minute' : s > 0 ? 'Minuten zu früh' : 'Minuten zu spät');
const outcome = s => (s >= 0 ? 'good' : s >= -15 ? 'meh' : 'bad');
const shortLabel = label => label.replace(/^[^:]+: /, '');
const sheet = inner => `<div class="sheet" data-act="close-sheet"><div class="sheet-card" data-stop>${inner}</div></div>`;

function levelBar(progress) {
  const n = nextUnlock(progress);
  const label = n ? `${esc(shortLabel(n.entry.label))} in ${(n.entry.km - progress.km).toLocaleString('de-DE')} km` : 'Alles freigeschaltet';
  return `<button class="lvl" data-act="figuren"><span class="fill" style="width:${n ? (n.fraction * 100).toFixed(1) : 100}%"></span><b>${level(progress)}</b><span>${label}</span></button>`;
}

// ---------- home ----------
export function homeScreen({ progress, day, dailyRun, challenge, soundOn, streak, sheetHtml }) {
  const done = progress.daily[day];
  const net = dailyRun.net;
  let sign, main;
  if (challenge) {
    sign = `<div class="sign duel"><span class="disp">⚔️ ${esc(challenge.name || 'Jemand')}</span><small>Tagesreise #${challenge.day}: ${signed(challenge.score)} Min · ${esc(challenge.line)}</small></div>`;
    main = `<button class="btn y" data-act="challenge">DUELL ANNEHMEN<small>schlag ${signed(challenge.score)} Min</small></button>`;
  } else if (done) {
    sign = `<div class="sign"><span class="disp">${signed(done.score)} Min ${'⭐'.repeat(done.stars)}</span><small>${esc(done.line)}</small></div>`;
    main = `<button class="btn y" data-act="share-daily">TEILEN<small>Tagesreise #${day} · morgen gibt’s eine neue</small></button>
      <button class="practice" data-act="daily">nochmal üben (zählt nicht)</button>`;
  } else {
    sign = `<div class="sign"><span class="disp">${esc(net.nodes[net.startId].city)} → ${esc(net.nodes[net.goalId].city)}</span><small>${esc(OCCASIONS[net.occasion].name)}</small></div>`;
    main = `<button class="btn y" data-act="daily">TAGESREISE #${day}<small>gleiche Reise für alle</small></button>`;
  }
  return `<section class="screen home">
    <div class="topbar">${levelBar(progress)}<button class="round" data-act="sound" aria-label="Ton">${soundOn ? '🔊' : '🔇'}</button></div>
    <h1 class="logo">Anschluss!<small>Komm pünktlich an.</small></h1>
    <div class="hero">
      ${streak ? `<div class="streak">🔥 ${streak} ${streak === 1 ? 'Tag' : 'Tage'}</div>` : ''}
      <canvas id="hero" width="300" height="300" aria-hidden="true"></canvas>
      ${sign}
    </div>
    ${main}
    <div class="squares">
      <button class="sq" data-act="free"><span>🎲</span>Freie Reise</button>
      <button class="sq" data-act="duel"><span>⚔️</span>Duell</button>
      <button class="sq" data-act="figuren"><span>${CHARACTERS[progress.character].icon}</span>Figuren</button>
    </div>
    ${sheetHtml || ''}
  </section>`;
}

export function freeSheet({ progress, setup }) {
  const u = unlocked(progress);
  const regions = Object.keys(REGIONS).map(id => `<button class="${setup.regionId === id ? 'on' : ''}" ${u.regions.includes(id) ? `data-act="pick-region" data-id="${id}"` : 'disabled'}>${u.regions.includes(id) ? (id === 'nord' ? 'Norden' : 'Deutschland') : '🔒'}</button>`).join('');
  const stufen = [0, 1, 2, 3, 4, 5].map(s => `<button class="${setup.stufe === s ? 'on' : ''}" ${s <= progress.stufeMax ? `data-act="pick-stufe" data-id="${s}"` : 'disabled'}>${s <= progress.stufeMax ? s : '🔒'}</button>`).join('');
  const ch = CHARACTERS[progress.character];
  return sheet(`<h2 class="title">Freie Reise</h2>
    <div class="label">Region</div><div class="pills">${regions}</div>
    <div class="label">Störungsstufe</div><div class="pills">${stufen}</div>
    <p>${setup.stufe ? esc(STUFEN.slice(1, setup.stufe + 1).map(s => s.desc).join(' ')) : 'Normaler Bahnbetrieb. So normal es eben geht.'}</p>
    <button class="btn y" data-act="start-free">LOS<small>${ch.icon} als ${esc(ch.name)}</small></button>`);
}

export function duelSheet({ progress, day }) {
  const done = progress.daily[day];
  if (!done) {
    return sheet(`<div class="big-ico">⚔️</div><h2 class="title">Duell</h2>
      <p>Spiel erst die Tagesreise. Dann schickst du Freunden deinen Link, und sie müssen dich schlagen.</p>
      <button class="btn y" data-act="daily">TAGESREISE #${day}</button>`);
  }
  return nameSheet(progress, `DUELL SCHICKEN<small>${signed(done.score)} Min ${'⭐'.repeat(done.stars)}</small>`);
}

export function nameSheet(progress, label, message) {
  return sheet(`<div class="big-ico">⚔️</div><h2 class="title">Wie heißt du?</h2>
    <input id="name" class="name-input" maxlength="16" value="${esc(progress.name)}" placeholder="Dein Name" autocomplete="nickname">
    <button class="btn y" data-act="send">${label}</button>
    ${message ? `<p>${esc(message)}</p>` : ''}`);
}

// ---------- figuren ----------
export function figurenScreen({ progress }) {
  const u = unlocked(progress);
  const kmFor = id => LADDER.find(e => e.kind === 'character' && e.id === id).km;
  const figs = Object.entries(CHARACTERS).map(([id, c]) => {
    const open = u.characters.includes(id);
    return `<button class="card fig ${progress.character === id ? 'on' : ''}" ${open ? `data-act="pick-char" data-id="${id}"` : 'disabled'}>
      <span class="face">${open ? c.icon : '🔒'}</span>
      <span><span class="disp">${c.name}</span><small>${open ? c.desc : `ab ${kmFor(id).toLocaleString('de-DE')} km`}</small></span>
    </button>`;
  }).join('');
  const ladder = LADDER.map(e => `<li class="${progress.km >= e.km ? 'got' : ''}">${progress.km >= e.km ? '✅' : '🔒'} ${esc(e.label)}<small>${e.km.toLocaleString('de-DE')} km</small></li>`).join('');
  const stufen = STUFEN.slice(1).map((s, i) => `<li class="${progress.stufeMax > i ? 'got' : ''}">${progress.stufeMax > i ? '🔥' : '🔒'} ${esc(s.desc)}<small>${i + 1}</small></li>`).join('');
  return `<section class="screen figuren">
    <button class="back" data-act="home" aria-label="Zurück">‹</button>
    <h2 class="title">Figuren</h2>
    <div class="figs">${figs}</div>
    <div class="stats">
      <div><b>${level(progress)}</b><small>Level</small></div>
      <div><b>${progress.km.toLocaleString('de-DE')}</b><small>km</small></div>
      <div><b>${progress.runs}</b><small>Reisen</small></div>
      <div><b>${progress.onTime}</b><small>pünktlich</small></div>
    </div>
    <h3 class="sec">Vielfahrer</h3><ul class="ladder">${ladder}</ul>
    <h3 class="sec">Störungsstufen</h3><ul class="ladder">${stufen}</ul>
    <p class="label" style="text-align:center">Ein Spiel über die ${TEXT.railName}. Ähnlichkeiten mit echten Bahnen sind rein zufällig.</p>
  </section>`;
}

// ---------- journey ----------
export function planScreen(run) {
  const occ = OCCASIONS[run.net.occasion], net = run.net;
  return `<section class="screen plan">
    <button class="back" data-act="home" aria-label="Abbrechen">‹</button>
    <h2 class="route">${esc(net.nodes[net.startId].city)} → ${esc(net.nodes[net.goalId].city)}</h2>
    <div class="meta"><span class="chip"><i>🎯</i>${clock(run.termin)} · ${esc(occ.name)}</span><span class="chip"><i>€</i>${run.money}</span></div>
    <div class="mapbox">${mapSvg(run)}</div>
    <div class="keys"><span>🛒 Kiosk</span><span>🛋️ Lounge</span><span>❓ Überraschung</span></div>
    <div class="spacer"></div>
    <button class="btn y" data-act="begin">LOS<small>jetzt ${clock(run.clock)}</small></button>
  </section>`;
}

function strip(run) {
  const total = run.net.layers.length, at = run.net.nodes[run.at].layer;
  const parts = [];
  for (let i = 0; i < total; i++) {
    if (i) parts.push(`<span class="l ${i <= at ? 'done' : ''}"></span>`);
    parts.push(`<span class="d ${i < at ? 'done' : i === at ? 'on' : i === total - 1 ? 'goal' : ''}"></span>`);
  }
  return `<button class="strip" data-act="map" aria-label="Netzkarte">${parts.join('')}<span class="map-hint">🗺️</span></button>`;
}

function feasibility(run, d) {
  const need = needMinutes(run, d);
  const fill = Math.min(1, need / d.window);
  if (d.window >= 1.6 * need) return { fill, color: 'var(--grn)', icon: '🚶' };
  if (d.window >= need) return { fill, color: 'var(--yel)', icon: '🏃' };
  return { fill, color: 'var(--red)', icon: '🏃' };
}

function depCard(run, d) {
  const f = feasibility(run, d);
  const color = d.cancelled ? SEV.color : d.type === 'RE' ? 'var(--grey)' : LINES[d.type].color;
  const time = d.depDelay > 0 ? `<s>${clock(d.plannedDep)}</s> ${clock(d.dep)}` : clock(d.dep);
  const price = !d.price ? '<span class="price free">frei</span>' : d.payable ? `<span class="price">${d.price}€</span>` : '<span class="price broke">🎲 ohne<br>Ticket</span>';
  return `<button class="dep" data-act="dep" data-key="${d.key}">
    <span class="t" style="background:${color}"><span class="disp">${d.cancelled ? 'BUS' : d.type}</span><small>${time}</small></span>
    <span class="m"><span class="disp">→ ${esc(d.city)}</span><span class="s">an ${clock(d.dep + d.ride)} · ${esc(d.rel)}</span>
      <span class="meter">${f.icon}<span class="bar"><i style="width:${(f.fill * 100).toFixed(0)}%;background:${f.color}"></i></span>${d.window} Min</span></span>
    ${price}
  </button>`;
}

function nodeCard(run) {
  const node = run.net.nodes[run.at];
  if (node.kind === 'kiosk') {
    const tiles = kioskOffers(run).map(o => `<button class="tile" data-act="buy" data-id="${o.id}" ${run.money >= o.price ? '' : 'disabled'}>
      <span class="ico">${o.icon}</span>${esc(o.name)}<small>${esc(o.desc)}</small><span class="price">${o.price}€</span></button>`).join('');
    return tiles ? `<div class="card shop"><h3>🛒 Kiosk</h3><div class="tiles">${tiles}</div></div>` : '';
  }
  if (node.kind === 'lounge') {
    const pay = Math.round(LOUNGE.pay * (run.perks.includes('lounge') ? 1.5 : 1));
    const used = loungeUsed(run);
    return `<button class="lounge" data-act="lounge" ${used ? 'disabled' : ''}><span class="ico">💻</span><span>${used ? 'Lounge: schon gejobbt' : `Lounge: <b>+${pay} €</b> jobben, kostet ${LOUNGE.minutes} Min`}</span></button>`;
  }
  return '';
}

function eventSheet(run, ns) {
  const ev = EVENTS[run.net.nodes[run.at].event];
  if (ns.eventResult) {
    return sheet(`<div class="big-ico">${ev.icon}</div><h2 class="title">${esc(ev.title)}</h2><p>${esc(ns.eventResult)}</p>
      <button class="btn" data-act="event-ok">WEITER</button>`);
  }
  return sheet(`<div class="big-ico">${ev.icon}</div><h2 class="title">${esc(ev.title)}</h2><p>${esc(ev.text)}</p>
    ${ev.choices.map((c, i) => `<button class="btn ${i ? 'w' : 'y'}" data-act="event" data-id="${i}">${esc(c)}</button>`).join('')}`);
}

export function stationScreen(run, ns) {
  const left = run.termin - run.clock;
  const items = run.items.map(id => `<span title="${esc(ITEMS[id].name)}">${ITEMS[id].icon}</span>`).join('');
  const taxis = taxiOptions(run).map(t => `<button class="taxi" data-act="taxi" data-to="${t.to}" ${t.payable ? '' : 'disabled'}>🚕 Taxi → ${esc(t.city)}, sofort · an ${clock(run.clock + t.ride)}<b>${t.price}€</b></button>`).join('');
  const overlay = ns.map ? sheet(`<h2 class="title">Dein Netz</h2><div class="mapbox">${mapSvg(run)}</div><button class="btn y" data-act="close-sheet">OK</button>`)
    : ns.eventResult || eventPending(run) ? eventSheet(run, ns) : '';
  return `<section class="screen station">
    <div class="band"><div class="hud"><span class="clock">${clock(run.clock)}</span><span class="chip"><i>€</i>${run.money}</span>
      <span class="goal">🎯 ${left >= 0 ? `noch ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` : `${-left} Min drüber`}<b class="${left < 0 ? 'late' : ''}">${clock(run.termin)}</b></span></div>
    ${strip(run)}</div>
    <div class="where"><h2 class="city">${esc(run.net.nodes[run.at].city)}</h2><span class="items">${items}</span></div>
    ${ns.notice ? `<div class="toast ${ns.notice.kind || ''}">${ns.notice.html}</div>` : ''}
    ${nodeCard(run)}
    <h3 class="pick">Welchen Zug nimmst du?</h3>
    ${departures(run).map(d => depCard(run, d)).join('')}
    ${taxis}
    ${overlay}
  </section>`;
}

export function rideScreen(run, d) {
  return `<section class="screen ride">
    <div class="mapbox">${mapSvg(run, { vehicle: true })}</div>
    <p class="caption">${d.emoji} → ${esc(d.city)}</p>
  </section>`;
}

// ---------- result ----------
export function resultScreen({ run, res, rec, challenge, progress, sheetHtml }) {
  const occ = OCCASIONS[run.net.occasion];
  const kind = outcome(res.score);
  const stamp = { good: 'PÜNKTLICH!', meh: 'KNAPP!', bad: 'ZU SPÄT!' }[kind];
  const stars = [0, 1, 2].map(i => `<span class="${i < res.stars ? '' : 'off'}">⭐</span>`).join('');
  const vs = challenge ? (() => {
    const diff = res.score - challenge.score;
    const verdict = diff > 0 ? 'Duell gewonnen! 🏆' : diff < 0 ? `${esc(challenge.name || 'Gegner')} gewinnt.` : 'Unentschieden.';
    return `<div class="card vs"><div class="row"><span>${esc(challenge.name || 'Gegner')}</span><b>${signed(challenge.score)} Min</b></div>
      <div class="row"><span>Du</span><b>${signed(res.score)} Min</b></div><div class="verdict">${verdict}</div></div>`;
  })() : '';
  const n = nextUnlock(progress);
  const unlocks = [...rec.unlocks.map(e => `🎉 ${esc(e.label)}`), rec.stufeUnlocked ? `🔥 Störungsstufe ${rec.stufeUnlocked} frei!` : '']
    .filter(Boolean).map(t => `<div class="unlock">${t}</div>`).join('');
  const social = run.mode === 'daily' || run.mode === 'challenge';
  return `<section class="screen result ${kind}">
    <div class="stamp">${stamp}</div>
    <div class="score">${signed(res.score)}<small>${minutesWord(res.score)}</small></div>
    <div class="stars">${stars}</div>
    <p class="quote">„${esc(res.score >= 0 ? occ.ok : occ.late)}“</p>
    <div class="card line">${esc(res.line)}</div>
    ${vs}
    <div class="km">+${res.km.toLocaleString('de-DE')} km${n ? ` · ${esc(shortLabel(n.entry.label))} bei ${n.entry.km.toLocaleString('de-DE')} km` : ''}
      <div class="bar"><i style="width:${n ? (n.fraction * 100).toFixed(1) : 100}%"></i></div></div>
    ${unlocks}
    <div class="spacer"></div>
    ${social ? '<button class="btn y" data-act="share">TEILEN</button><button class="btn" data-act="home">WEITER</button>'
      : '<button class="btn y" data-act="free">NOCHMAL</button><button class="btn w" data-act="home">MENÜ</button>'}
    ${sheetHtml || ''}
  </section>`;
}
