// HTML templates for every non-sprint screen. Pure: state in, markup out. Actions use data-act attributes.
import { ITEMS, CHARACTERS, REGIONS, STUFEN, LADDER, OCCASIONS, EVENTS, LOUNGE, SEV, TEXT } from '../logic/content.js';
import { departures, taxiOptions, needMinutes, kioskOffers, loungeUsed, eventPending, itemPrice } from '../logic/run.js';
import { unlocked, nextUnlock, level } from '../logic/progress.js';
import { mapSvg } from './mapView.js';

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const clock = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const signed = n => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '±0');
const minutesWord = s => (s === 0 ? 'auf die Minute' : s > 0 ? 'Minuten zu früh' : 'Minuten zu spät');
const outcome = s => (s >= 0 ? 'good' : s >= -15 ? 'meh' : 'bad');
const shortLabel = label => label.replace(/^[^:]+: /, '');
const km = n => n.toLocaleString('de-DE');
const sheet = inner => `<div class="sheet" data-act="close-sheet"><div class="sheet-card" data-stop>${inner}</div></div>`;
const stationSign = (text, extra = '') => `<div class="station-sign ${extra}"><span>${text}</span></div>`;

function levelChip(progress) {
  const n = nextUnlock(progress);
  const label = n ? `${esc(shortLabel(n.entry.label))} · noch ${km(n.entry.km - progress.km)} km` : 'Alles freigeschaltet';
  return `<button class="lvl" data-act="figuren" aria-label="Level ${level(progress)}">
    <b>${level(progress)}</b><span class="lvl-bar"><i style="width:${n ? (n.fraction * 100).toFixed(1) : 100}%"></i></span><small>${label}</small></button>`;
}

// ---------- home ----------
export function homeScreen({ progress, day, dailyRun, challenge, soundOn, streak, sheetHtml }) {
  const done = progress.daily[day];
  const net = dailyRun.net;
  let sign, main, extra = '';
  if (challenge) {
    sign = stationSign(`⚔️ ${esc(challenge.name || 'Jemand')} · ${signed(challenge.score)} Min`, 'duel');
    main = `<button class="cta" data-act="challenge"><span>Duell annehmen</span><small>Tagesreise #${challenge.day}</small></button>`;
  } else if (done) {
    sign = stationSign(`${signed(done.score)} Min ${'⭐'.repeat(done.stars)}`);
    main = `<button class="cta" data-act="share-daily"><span>Teilen</span><small>${esc(done.line)}</small></button>`;
    extra = '<button class="link" data-act="daily">nochmal üben</button>';
  } else {
    sign = stationSign(`${esc(net.nodes[net.startId].city)} → ${esc(net.nodes[net.goalId].city)}`);
    main = `<button class="cta" data-act="daily"><span>Tagesreise #${day}</span><small>${esc(OCCASIONS[net.occasion].name)} · gleiche Reise für alle</small></button>`;
  }
  return `<section class="screen home">
    <div class="topbar">${levelChip(progress)}<button class="round" data-act="sound" aria-label="Ton">${soundOn ? '🔊' : '🔇'}</button></div>
    <h1 class="logo">Anschluss!</h1>
    <div class="hero">
      ${streak ? `<div class="sticker streak">🔥 ${streak}</div>` : ''}
      <canvas id="hero" width="300" height="300" aria-hidden="true"></canvas>
      <div class="platform"></div>
      ${sign}
    </div>
    <div class="dock">
      ${main}${extra}
      <div class="rounds">
        <button data-act="free"><i>🎲</i>Frei</button>
        <button data-act="duel"><i>⚔️</i>Duell</button>
        <button data-act="figuren"><i>${CHARACTERS[progress.character].icon}</i>Figuren</button>
      </div>
    </div>
    ${sheetHtml || ''}
  </section>`;
}

export function freeSheet({ progress, setup }) {
  const u = unlocked(progress);
  const regions = Object.keys(REGIONS).map(id => `<button class="${setup.regionId === id ? 'on' : ''}" ${u.regions.includes(id) ? `data-act="pick-region" data-id="${id}"` : 'disabled'}>${u.regions.includes(id) ? (id === 'nord' ? 'Norden' : 'Deutschland') : '🔒'}</button>`).join('');
  const stufen = [0, 1, 2, 3, 4, 5].map(s => `<button class="${setup.stufe === s ? 'on' : ''}" ${s <= progress.stufeMax ? `data-act="pick-stufe" data-id="${s}"` : 'disabled'}>${s <= progress.stufeMax ? s : '🔒'}</button>`).join('');
  const ch = CHARACTERS[progress.character];
  return sheet(`<h2 class="sheet-title">Freie Reise</h2>
    <div class="field"><span>Region</span><div class="pills">${regions}</div></div>
    <div class="field"><span>Störung</span><div class="pills">${stufen}</div></div>
    <p class="hint">${setup.stufe ? esc(STUFEN.slice(1, setup.stufe + 1).map(s => s.desc).join(' ')) : 'Normaler Bahnbetrieb. So normal es eben geht.'}</p>
    <button class="cta" data-act="start-free"><span>Los</span><small>${ch.icon} ${esc(ch.name)}</small></button>`);
}

export function duelSheet({ progress, day }) {
  if (!progress.daily[day]) {
    return sheet(`<div class="big-ico">⚔️</div><h2 class="sheet-title">Duell</h2>
      <p class="hint">Spiel erst die Tagesreise. Dann schickst du deinen Link rum, und die anderen müssen dich schlagen.</p>
      <button class="cta" data-act="daily"><span>Tagesreise #${day}</span></button>`);
  }
  return nameSheet(progress, 'Duell schicken');
}

export function nameSheet(progress, label, message) {
  return sheet(`<h2 class="sheet-title">Wie heißt du?</h2>
    <input id="name" class="name-input" maxlength="16" value="${esc(progress.name)}" placeholder="Dein Name" autocomplete="nickname">
    <button class="cta" data-act="send"><span>${esc(label)}</span></button>
    ${message ? `<p class="hint">${esc(message)}</p>` : ''}`);
}

// ---------- figuren ----------
export function figurenScreen({ progress }) {
  const u = unlocked(progress);
  const kmFor = id => LADDER.find(e => e.kind === 'character' && e.id === id).km;
  const figs = Object.entries(CHARACTERS).map(([id, c]) => {
    const open = u.characters.includes(id);
    return `<button class="fig ${progress.character === id ? 'on' : ''}" ${open ? `data-act="pick-char" data-id="${id}"` : 'disabled'}>
      <span class="face">${open ? c.icon : '🔒'}</span><b>${c.name}</b><small>${open ? c.desc : `ab ${km(kmFor(id))} km`}</small></button>`;
  }).join('');
  const ladder = LADDER.map(e => `<li class="${progress.km >= e.km ? 'got' : ''}"><span>${progress.km >= e.km ? '✓' : km(e.km)}</span>${esc(e.label)}</li>`).join('');
  const stufen = STUFEN.slice(1).map((s, i) => `<li class="${progress.stufeMax > i ? 'got' : ''}"><span>${i + 1}</span>${esc(s.desc)}</li>`).join('');
  return `<section class="screen figuren">
    <div class="head"><button class="back" data-act="home" aria-label="Zurück">‹</button>${stationSign('Figuren')}</div>
    <div class="figs">${figs}</div>
    <div class="stats"><b>${level(progress)}</b> Level · <b>${km(progress.km)}</b> km · <b>${progress.runs}</b> Reisen · <b>${progress.onTime}</b> pünktlich</div>
    <h3>Vielfahrer</h3><ul class="ladder">${ladder}</ul>
    <h3>Störungsstufen</h3><ul class="ladder">${stufen}</ul>
    <p class="fine">Ein Spiel über die ${TEXT.railName}. Ähnlichkeiten mit echten Bahnen sind rein zufällig.</p>
  </section>`;
}

// ---------- journey ----------
export function planScreen(run) {
  const occ = OCCASIONS[run.net.occasion], net = run.net;
  return `<section class="screen plan">
    <div class="head"><button class="back" data-act="home" aria-label="Abbrechen">‹</button>${stationSign(`${esc(net.nodes[net.startId].city)} → ${esc(net.nodes[net.goalId].city)}`)}</div>
    <div class="termin"><span>${esc(occ.name)}</span><b>${clock(run.termin)}</b></div>
    <div class="mapbox grow">${mapSvg(run)}<div class="keys">🛒 Kiosk · 🛋️ Lounge · ❓ Überraschung</div></div>
    <button class="cta" data-act="begin"><span>Los geht’s</span><small>Abfahrt ab ${clock(run.clock)} · ${run.money} €</small></button>
  </section>`;
}

function track(run) {
  const total = run.net.layers.length, at = run.net.nodes[run.at].layer;
  const stops = Array.from({ length: total }, (_, i) => `<i class="${i < at ? 'done' : i === at ? 'on' : i === total - 1 ? 'goal' : ''}" style="left:${(i / (total - 1)) * 100}%"></i>`).join('');
  return `<button class="track" data-act="map" aria-label="Netzkarte"><span class="rails"><span class="ridden" style="width:${(at / (total - 1)) * 100}%"></span>${stops}</span><span class="map-ico">🗺️</span></button>`;
}

function departureRow(run, d) {
  const need = needMinutes(run, d);
  const state = d.window >= 1.6 * need ? 'easy' : d.window >= need ? 'tight' : 'hard';
  const type = d.cancelled ? 'BUS' : d.type;
  const time = d.depDelay > 0 ? `<s>${clock(d.plannedDep)}</s>${clock(d.dep)}` : clock(d.dep);
  const price = !d.price ? 'frei' : d.payable ? `${d.price} €` : '🎲';
  return `<button class="row" data-act="dep" data-key="${d.key}">
    <span class="time">${time}</span>
    <span class="dest"><b class="type t-${type}"${d.cancelled ? ` style="background:${SEV.color}"` : ''}>${type}</b>${esc(d.city)}<small>an ${clock(d.dep + d.ride)} · ${esc(d.rel)}</small></span>
    <span class="go ${state}">${state === 'easy' ? '🚶' : '🏃'} ${d.window}′</span>
    <span class="fare ${d.payable ? '' : 'broke'}">${price}</span>
  </button>`;
}

function shelf(run) {
  const node = run.net.nodes[run.at];
  if (node.kind === 'kiosk') {
    const items = kioskOffers(run).map(o => `<button class="item" data-act="item" data-id="${o.id}"><i>${o.icon}</i><span>${o.price} €</span></button>`).join('');
    return items ? `<div class="shelf"><span class="shelf-label">Kiosk</span>${items}</div>` : '';
  }
  if (node.kind === 'lounge') {
    const used = loungeUsed(run);
    const pay = Math.round(LOUNGE.pay * (run.perks.includes('lounge') ? 1.5 : 1));
    return `<button class="lounge" data-act="lounge" ${used ? 'disabled' : ''}>💻 ${used ? 'Schon gejobbt' : `Lounge: +${pay} € jobben (${LOUNGE.minutes} Min)`}</button>`;
  }
  return '';
}

function itemSheet(run, id) {
  const it = ITEMS[id], price = itemPrice(run, id);
  return sheet(`<div class="big-ico">${it.icon}</div><h2 class="sheet-title">${esc(it.name)}</h2><p class="hint">${esc(it.desc)}</p>
    <button class="cta" data-act="buy" data-id="${id}" ${run.money >= price ? '' : 'disabled'}><span>Kaufen · ${price} €</span>${run.money >= price ? '' : '<small>zu wenig Geld</small>'}</button>`);
}

function eventSheet(run, ns) {
  const ev = EVENTS[run.net.nodes[run.at].event];
  if (ns.eventResult) {
    return sheet(`<div class="big-ico">${ev.icon}</div><h2 class="sheet-title">${esc(ev.title)}</h2><p class="hint">${esc(ns.eventResult)}</p>
      <button class="cta green" data-act="event-ok"><span>Weiter</span></button>`);
  }
  return sheet(`<div class="big-ico">${ev.icon}</div><h2 class="sheet-title">${esc(ev.title)}</h2><p class="hint">${esc(ev.text)}</p>
    ${ev.choices.map((c, i) => `<button class="${i ? 'choice' : 'cta'}" data-act="event" data-id="${i}"><span>${esc(c)}</span></button>`).join('')}`);
}

export function stationScreen(run, ns) {
  const left = run.termin - run.clock;
  const items = run.items.map(id => `<i title="${esc(ITEMS[id].name)}">${ITEMS[id].icon}</i>`).join('');
  const taxis = taxiOptions(run).map(t => `<button class="taxi" data-act="taxi" data-to="${t.to}" ${t.payable ? '' : 'disabled'}>🚕 ${esc(t.city)} ${t.price} €</button>`).join('');
  const overlay = ns.map ? sheet(`<h2 class="sheet-title">Dein Netz</h2><div class="mapbox">${mapSvg(run)}</div><button class="cta" data-act="close-sheet"><span>OK</span></button>`)
    : ns.item ? itemSheet(run, ns.item)
      : ns.eventResult || eventPending(run) ? eventSheet(run, ns) : '';
  return `<section class="screen station">
    <div class="band">
      <span class="clock">${clock(run.clock)}</span>
      <span class="coins">${run.money} €</span>
      <span class="due ${left < 0 ? 'late' : left < 45 ? 'close' : ''}"><small>Termin</small>${clock(run.termin)}</span>
      ${track(run)}
    </div>
    <div class="here">${stationSign(esc(run.net.nodes[run.at].city))}${items ? `<span class="pocket">${items}</span>` : ''}
      ${ns.notice ? `<div class="sticker note ${ns.notice.kind || ''}">${ns.notice.html}</div>` : ''}</div>
    ${shelf(run)}
    <div class="board"><div class="board-head">Abfahrt</div>${departures(run).map(d => departureRow(run, d)).join('')}</div>
    <div class="taxis">${taxis}</div>
    ${overlay}
  </section>`;
}

export function rideScreen(run, d) {
  return `<section class="screen ride">
    <div class="mapbox">${mapSvg(run, { vehicle: true })}</div>
    <p class="caption">${d.emoji} ${esc(d.city)}</p>
  </section>`;
}

// ---------- result ----------
export function resultScreen({ run, res, rec, challenge, progress, sheetHtml }) {
  const occ = OCCASIONS[run.net.occasion], net = run.net;
  const kind = outcome(res.score);
  const stamp = { good: 'Pünktlich!', meh: 'Knapp!', bad: 'Zu spät!' }[kind];
  const stars = [0, 1, 2].map(i => `<i class="${i < res.stars ? '' : 'off'}">★</i>`).join('');
  const vs = challenge ? (() => {
    const diff = res.score - challenge.score;
    const verdict = diff > 0 ? 'gewonnen 🏆' : diff < 0 ? 'verloren' : 'unentschieden';
    return `<div class="duel-line">⚔️ ${esc(challenge.name || 'Gegner')} ${signed(challenge.score)} · du ${signed(res.score)} → <b>${verdict}</b></div>`;
  })() : '';
  const n = nextUnlock(progress);
  const unlocks = [...rec.unlocks.map(e => `🎉 ${esc(e.label)}`), rec.stufeUnlocked ? `🔥 Störungsstufe ${rec.stufeUnlocked} frei` : '']
    .filter(Boolean).map(t => `<div class="sticker unlock">${t}</div>`).join('');
  const social = run.mode === 'daily' || run.mode === 'challenge';
  return `<section class="screen result ${kind}">
    <div class="ticket">
      <div class="ticket-head"><span>${esc(net.nodes[net.startId].city)} → ${esc(net.nodes[net.goalId].city)}</span><small>${run.mode === 'free' ? 'Freie Reise' : `Tagesreise #${run.day}`}</small></div>
      <div class="stamp">${stamp}</div>
      <div class="score">${signed(res.score)}</div>
      <div class="score-word">${minutesWord(res.score)}</div>
      <div class="stars">${stars}</div>
      <div class="legs">${esc(res.line)}</div>
      <p class="quote">„${esc(res.score >= 0 ? occ.ok : occ.late)}“</p>
      ${vs}
    </div>
    <div class="progress">+${km(res.km)} km<span class="lvl-bar"><i style="width:${n ? (n.fraction * 100).toFixed(1) : 100}%"></i></span>${n ? `<small>${esc(shortLabel(n.entry.label))}</small>` : ''}</div>
    ${unlocks}
    <div class="dock">
      ${social ? '<button class="cta" data-act="share"><span>Teilen</span></button><button class="link light" data-act="home">weiter</button>'
        : '<button class="cta" data-act="free"><span>Nochmal</span></button><button class="link light" data-act="home">zum Start</button>'}
    </div>
    ${sheetHtml || ''}
  </section>`;
}
