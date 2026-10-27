// HTML templates for every non-sprint screen. Pure: state in, markup out. Actions use data-act attributes.
import { ITEMS, CHARACTERS, REGIONS, STUFEN, LADDER, OCCASIONS, EVENTS, LOUNGE, LINES, SEV, NODE_KINDS, TEXT } from '../logic/content.js';
import { departures, taxiOptions, needMinutes, canStroll, kioskOffers, loungeUsed, eventPending } from '../logic/run.js';
import { unlocked, nextUnlock } from '../logic/progress.js';
import { scoreText } from '../logic/share.js';
import { mapSvg } from './mapView.js';

export const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
export const clock = m => { m = ((Math.round(m) % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
const stars = n => '⭐'.repeat(n) + '<span class="dim">' + '☆'.repeat(3 - n) + '</span>';
const scoreClass = s => (s >= 0 ? 'good' : s >= -15 ? 'meh' : 'bad');

function ladderBar(progress) {
  const n = nextUnlock(progress);
  if (!n) return `<div class="ladder done">Alles freigeschaltet · ${progress.km.toLocaleString('de-DE')} km</div>`;
  return `<div class="ladder">
    <div class="ladder-top"><span>Nächstes: <b>${esc(n.entry.label)}</b></span><span>${progress.km.toLocaleString('de-DE')} / ${n.entry.km.toLocaleString('de-DE')} km</span></div>
    <div class="bar"><i style="width:${(n.fraction * 100).toFixed(1)}%"></i></div>
  </div>`;
}

export function menuScreen({ progress, day, challenge, soundOn }) {
  const done = progress.daily[day];
  const ch = challenge ? `<div class="card challenge">
      <div><b>${esc(challenge.name || 'Jemand')}</b> fordert dich heraus</div>
      <div class="sub">Tagesreise #${challenge.day} · ${esc(challenge.line)} · ${scoreText(challenge.score)}</div>
      <button class="btn primary" data-act="challenge">Herausforderung annehmen</button>
    </div>` : '';
  const daily = done
    ? `<div class="card daily">
        <div class="row"><b>Tagesreise #${day}</b><span class="tag ok">gespielt</span></div>
        <div class="big ${scoreClass(done.score)}">${scoreText(done.score)} ${stars(done.stars)}</div>
        <div class="sub">${esc(done.line)}</div>
        <div class="row gap"><button class="btn primary" data-act="share-daily">Teilen</button><button class="btn" data-act="daily">Nochmal (ungewertet)</button></div>
        <div class="sub">Morgen gibt es eine neue Reise.</div>
      </div>`
    : `<button class="card daily cta" data-act="daily">
        <div class="row"><b>Tagesreise #${day}</b><span class="tag new">neu</span></div>
        <div class="sub">Gleiche Reise für alle. Nur der erste Versuch zählt.</div>
      </button>`;
  return `<section class="screen menu">
    <header class="top"><span></span><button class="icon-btn" data-act="sound" aria-label="Ton">${soundOn ? '🔊' : '🔇'}</button></header>
    <div class="logo"><h1>Anschluss!</h1><p>Komm pünktlich an. Irgendwie.</p></div>
    ${ch}${daily}
    <button class="card cta" data-act="setup"><div class="row"><b>Freie Reise</b><span>›</span></div><div class="sub">Figur, Region und Störungsstufe wählen.</div></button>
    <button class="card cta" data-act="progress"><div class="row"><b>Fortschritt</b><span>›</span></div>${ladderBar(progress)}</button>
    <footer class="fine">Eine Fahrt mit der ${TEXT.railName}. Ähnlichkeiten mit echten Bahnen sind rein zufällig.</footer>
  </section>`;
}

export function setupScreen({ progress, setup }) {
  const u = unlocked(progress);
  const kmFor = (kind, id) => LADDER.find(e => e.kind === kind && e.id === id)?.km;
  const chars = Object.entries(CHARACTERS).map(([id, c]) => {
    const open = u.characters.includes(id);
    return `<button class="choice ${setup.characterId === id ? 'on' : ''}" ${open ? `data-act="pick-char" data-id="${id}"` : 'disabled'}>
      <span class="ico">${open ? c.icon : '🔒'}</span><span><b>${c.name}</b><small>${open ? c.desc : `ab ${kmFor('character', id)} km`}</small></span>
    </button>`;
  }).join('');
  const regions = Object.entries(REGIONS).map(([id, r]) => {
    const open = u.regions.includes(id);
    return `<button class="choice ${setup.regionId === id ? 'on' : ''}" ${open ? `data-act="pick-region" data-id="${id}"` : 'disabled'}>
      <span class="ico">${open ? '🗺️' : '🔒'}</span><span><b>${r.name}</b><small>${open ? `${r.layers + 1} Etappen` : `ab ${kmFor('region', id)} km`}</small></span>
    </button>`;
  }).join('');
  const stufen = [0, 1, 2, 3, 4, 5].map(s => `<button class="seg ${setup.stufe === s ? 'on' : ''}" ${s <= progress.stufeMax ? `data-act="pick-stufe" data-id="${s}"` : 'disabled'}>${s <= progress.stufeMax ? s : '🔒'}</button>`).join('');
  const stufeDesc = setup.stufe === 0 ? 'Normaler Bahnbetrieb.' : STUFEN.slice(1, setup.stufe + 1).map(s => s.desc).join(' ');
  return `<section class="screen setup">
    <header class="top"><button class="icon-btn" data-act="menu" aria-label="Zurück">‹</button><h2>Freie Reise</h2><span></span></header>
    <h3>Figur</h3><div class="choices">${chars}</div>
    <h3>Region</h3><div class="choices">${regions}</div>
    <h3>Störungsstufe</h3><div class="segs">${stufen}</div>
    <p class="sub">${esc(stufeDesc)}${progress.stufeMax < 5 ? ' Pünktlich ankommen schaltet die nächste Stufe frei.' : ''}</p>
    <button class="btn primary wide" data-act="start-free">Los geht’s</button>
  </section>`;
}

export function progressScreen({ progress }) {
  const rows = LADDER.map(e => `<li class="${progress.km >= e.km ? 'got' : ''}"><span>${progress.km >= e.km ? '✅' : '🔒'}</span><span>${esc(e.label)}</span><small>${e.km.toLocaleString('de-DE')} km</small></li>`).join('');
  const st = STUFEN.slice(1).map((s, i) => `<li class="${progress.stufeMax >= i + 1 ? 'got' : ''}"><span>${progress.stufeMax >= i + 1 ? '✅' : '🔒'}</span><span><b>${s.name}</b> ${esc(s.desc)}</span></li>`).join('');
  return `<section class="screen progress">
    <header class="top"><button class="icon-btn" data-act="menu" aria-label="Zurück">‹</button><h2>Fortschritt</h2><span></span></header>
    <div class="stats">
      <div><b>${progress.km.toLocaleString('de-DE')}</b><small>km gereist</small></div>
      <div><b>${progress.runs}</b><small>Reisen</small></div>
      <div><b>${progress.onTime}</b><small>pünktlich</small></div>
      <div><b>${progress.bestScore === null ? '–' : (progress.bestScore > 0 ? '+' : '') + progress.bestScore}</b><small>beste Min</small></div>
    </div>
    ${ladderBar(progress)}
    <h3>Vielfahrer-Leiter</h3><ul class="list">${rows}</ul>
    <h3>Störungsstufen</h3><ul class="list">${st}</ul>
  </section>`;
}

function header(run) {
  const items = run.items.map(id => `<span title="${esc(ITEMS[id].name)}">${ITEMS[id].icon}</span>`).join('');
  const occ = OCCASIONS[run.net.occasion];
  const left = run.termin - run.clock;
  return `<header class="station-head">
    <div class="row"><b class="city">${NODE_KINDS[run.net.nodes[run.at].kind].icon} ${esc(run.net.nodes[run.at].city)}</b><span class="clock">${clock(run.clock)}</span><span class="money">${run.money} €</span></div>
    <div class="row sub"><span>${esc(occ.name)}: <b>${clock(run.termin)}</b> in ${esc(run.net.nodes[run.net.goalId].city)} <span class="${left < 60 ? 'warn' : ''}">${left >= 0 ? `(noch ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} h)` : `(${-left} Min drüber)`}</span></span><span class="items">${items}</span></div>
  </header>`;
}

export function journeyScreen(run) {
  const occ = OCCASIONS[run.net.occasion];
  const goal = run.net.nodes[run.net.goalId].city, start = run.net.nodes[run.net.startId].city;
  const tag = run.mode === 'daily' ? `Tagesreise #${run.day}` : run.mode === 'challenge' ? `Herausforderung · Tagesreise #${run.day}` : `${CHARACTERS[run.characterId].icon} ${CHARACTERS[run.characterId].name}${run.stufe ? ` · Stufe ${run.stufe}` : ''}`;
  return `<section class="screen journey">
    <header class="top"><button class="icon-btn" data-act="menu" aria-label="Abbrechen">‹</button><span class="tag">${esc(tag)}</span><span></span></header>
    <h2 class="route">${esc(start)} → ${esc(goal)}</h2>
    <p class="occasion">${esc(occ.name)} um <b>${clock(run.termin)}</b>. Jetzt ist es ${clock(run.clock)}.</p>
    <div class="mapbox">${mapSvg(run)}</div>
    <ul class="legend"><li>🛒 Kiosk</li><li>🛋️ Lounge</li><li>❓ Ereignis</li><li><i class="l-icb"></i> ICB + RE</li><li><i class="l-re"></i> nur RE</li></ul>
    <p class="sub center">Plane deine Route. Schnelle Züge sind teuer und wackelig, der RE ist billig und meist pünktlich.</p>
    <button class="btn primary wide" data-act="begin">Zum Bahnhof</button>
  </section>`;
}

function feasibility(run, d) {
  const need = needMinutes(run, d);
  if (d.window >= 2 * need) return ['relax', 'entspannt'];
  if (d.window >= need) return ['ok', 'machbar'];
  if (d.window >= need - 1) return ['tight', 'knapp'];
  return ['hard', 'sehr knapp'];
}

function departureRows(run) {
  return departures(run).map(d => {
    const [cls, label] = feasibility(run, d);
    const color = d.cancelled ? SEV.color : LINES[d.type].color;
    const delay = d.depDelay > 0 ? `<small class="late">+${d.depDelay}</small>` : '';
    return `<button class="dep ${d.cancelled ? 'cancel' : ''}" data-act="dep" data-key="${d.key}">
      <span class="dep-time"><b>${clock(d.plannedDep)}</b>${delay}</span>
      <span class="dep-main"><span class="badge" style="background:${color}">${esc(d.name)}</span> → ${esc(d.city)}<small>an ${clock(d.dep + d.ride)} · ${esc(d.rel)}</small></span>
      <span class="dep-side"><span class="win ${cls}">${d.window} Min · ${label}</span><span class="price ${d.payable ? '' : 'broke'}">${d.price ? d.payable ? d.price + ' €' : 'ohne Ticket?' : 'frei'}</span></span>
    </button>`;
  }).join('');
}

function taxiRows(run) {
  return taxiOptions(run).map(t => `<button class="taxi" data-act="taxi" data-to="${t.to}" ${t.payable ? '' : 'disabled'}>
    🚕 Taxi nach ${esc(t.city)} · sofort, an ${clock(run.clock + t.ride)} · <b>${t.price} €</b></button>`).join('');
}

function nodeCard(run) {
  const node = run.net.nodes[run.at];
  if (node.kind === 'kiosk') {
    const offers = kioskOffers(run).map(o => `<div class="offer">
      <span class="ico">${o.icon}</span><span><b>${o.name}</b><small>${o.desc}</small></span>
      <button class="btn small" data-act="buy" data-id="${o.id}" ${run.money >= o.price ? '' : 'disabled'}>${o.price} €</button></div>`).join('');
    return `<div class="card nodecard"><h3>🛒 Kiosk</h3>${offers || '<p class="sub">Ausverkauft. Du hast schon alles.</p>'}</div>`;
  }
  if (node.kind === 'lounge') {
    const pay = Math.round(LOUNGE.pay * (run.perks.includes('lounge') ? 1.5 : 1));
    return `<div class="card nodecard"><h3>🛋️ Bummel-Lounge</h3>
      <div class="offer"><span class="ico">💻</span><span><b>Am Laptop jobben</b><small>+${pay} € für ${LOUNGE.minutes} Minuten deiner Zeit.</small></span>
      <button class="btn small" data-act="lounge" ${loungeUsed(run) ? 'disabled' : ''}>${loungeUsed(run) ? 'erledigt' : 'Jobben'}</button></div></div>`;
  }
  return '';
}

function eventSheet(run, ns) {
  const ev = EVENTS[run.net.nodes[run.at].event];
  if (ns.eventResult) {
    return `<div class="sheet"><div class="sheet-card"><h3>❓ ${esc(ev.title)}</h3><p>${esc(ns.eventResult)}</p>
      <button class="btn primary wide" data-act="event-ok">Weiter</button></div></div>`;
  }
  return `<div class="sheet"><div class="sheet-card"><h3>❓ ${esc(ev.title)}</h3><p>${esc(ev.text)}</p>
    ${ev.choices.map((c, i) => `<button class="btn ${i === 0 ? 'primary' : ''} wide" data-act="event" data-id="${i}">${esc(c)}</button>`).join('')}</div></div>`;
}

function departSheet(run, d) {
  const stroll = canStroll(run, d);
  const warn = d.payable ? '' : `<p class="warn">Kein Geld für die Fahrkarte (${d.price} €). Ohne Ticket: 30 % Risiko auf Kontrolle, dann +30 Min.</p>`;
  return `<div class="sheet"><div class="sheet-card">
    <h3>${esc(d.name)} → ${esc(d.city)}</h3>
    <p>Ab ${clock(d.dep)}, du hast <b>${d.window} Minuten</b>.${stroll ? ' Reichlich Zeit.' : ''}</p>${warn}
    <button class="btn primary wide" data-act="sprint" data-key="${d.key}">🏃 ${stroll ? 'Sprinten und Pfand sammeln' : 'Los, sprinten!'}</button>
    ${stroll ? `<button class="btn wide" data-act="stroll" data-key="${d.key}">🚶 Gemütlich gehen</button>` : ''}
    <button class="btn ghost wide" data-act="close-sheet">Anderen Zug wählen</button>
  </div></div>`;
}

export function stationScreen(run, ns) {
  const sheet = ns.sheet ? departSheet(run, ns.sheet) : ns.eventResult || eventPending(run) ? eventSheet(run, ns) : '';
  return `<section class="screen station">
    ${header(run)}
    <div class="mapbox small">${mapSvg(run)}</div>
    ${ns.notice ? `<div class="notice ${ns.notice.kind || ''}">${ns.notice.html}</div>` : ''}
    ${nodeCard(run)}
    <h3 class="deps-title">Abfahrten</h3>
    <div class="deps">${departureRows(run)}</div>
    <div class="taxis">${taxiRows(run)}</div>
    ${sheet}
  </section>`;
}

export function rideScreen(run, d) {
  return `<section class="screen ride">
    ${header(run)}
    <div class="mapbox">${mapSvg(run, { vehicle: true })}</div>
    <p class="center ride-caption">${d.emoji} unterwegs nach <b>${esc(d.city)}</b> …</p>
  </section>`;
}

export function resultScreen({ run, res, rec, challenge, progress, share }) {
  const occ = OCCASIONS[run.net.occasion];
  const goal = run.net.nodes[run.net.goalId].city;
  const vs = challenge ? (() => {
    const diff = res.score - challenge.score;
    const verdict = diff > 0 ? 'Du gewinnst!' : diff < 0 ? `${esc(challenge.name || 'Die anderen')} gewinnt.` : 'Unentschieden.';
    return `<div class="card vs"><div class="row"><span>${esc(challenge.name || 'Gegner')}</span><b>${scoreText(challenge.score)}</b></div>
      <div class="row"><span>Du</span><b>${scoreText(res.score)}</b></div><div class="big">${verdict}</div></div>`;
  })() : '';
  const shareBox = run.mode === 'daily' || run.mode === 'challenge' ? `<div class="card share">
      ${rec.dailyCounted || run.mode === 'challenge' ? '' : '<p class="sub">Nur der erste Versuch zählt. Geteilt wird dein gewertetes Ergebnis.</p>'}
      <label class="name">Dein Name für Herausforderungen <input id="name" maxlength="16" value="${esc(progress.name)}" placeholder="z. B. Mika"></label>
      <div class="row gap"><button class="btn primary" data-act="share">Teilen</button><button class="btn" data-act="copy-link">Link kopieren</button></div>
      ${share ? `<p class="sub ok">${esc(share)}</p>` : ''}
    </div>` : '';
  const unlocks = [
    ...rec.unlocks.map(e => `<div class="unlock">🎉 Neu freigeschaltet: <b>${esc(e.label)}</b></div>`),
    rec.stufeUnlocked ? `<div class="unlock">🔥 Störungsstufe ${rec.stufeUnlocked} freigeschaltet!</div>` : '',
  ].join('');
  return `<section class="screen result">
    <h2>🏁 Angekommen in ${esc(goal)}</h2>
    <div class="score ${scoreClass(res.score)}">${scoreText(res.score)}</div>
    <div class="stars">${stars(res.stars)}</div>
    <p class="occasion">${esc(res.score >= 0 ? occ.ok : occ.late)}</p>
    <p class="line">${esc(res.line)}</p>
    <p class="sub center">${run.hits} Treffer · ${res.money} € übrig · Termin war ${clock(run.termin)}</p>
    ${vs}${shareBox}
    <div class="card"><div class="row"><b>+${res.km} km</b><span>Reisekilometer</span></div>${ladderBar(progress)}${unlocks}</div>
    <div class="row gap"><button class="btn primary" data-act="again">Neue Reise</button><button class="btn" data-act="menu">Menü</button></div>
  </section>`;
}
