// All game content and tuning numbers live here so balancing and later translation touch one file.

export const SEC_PER_MIN = 2.5; // sprint seconds per in-game minute
export const MIN_WINDOW = 2; // a departure closer than this is not offered

// [lon, lat, size] — size drives how long the sprint through the station is
export const CITIES = {
  Flensburg: [9.43, 54.79, 'klein'], Kiel: [10.13, 54.32, 'mittel'], Neumünster: [9.98, 54.07, 'klein'],
  Lübeck: [10.69, 53.87, 'mittel'], Rostock: [12.1, 54.09, 'mittel'], Schwerin: [11.41, 53.63, 'klein'],
  Cuxhaven: [8.7, 53.86, 'klein'], Hamburg: [10.0, 53.55, 'gross'], Emden: [7.21, 53.37, 'klein'],
  Oldenburg: [8.21, 53.14, 'mittel'], Bremen: [8.8, 53.08, 'gross'], Lüneburg: [10.41, 53.25, 'klein'],
  Uelzen: [10.56, 52.97, 'klein'], Wittenberge: [11.75, 53.0, 'klein'], Stendal: [11.86, 52.6, 'klein'],
  Berlin: [13.4, 52.52, 'gross'], Hannover: [9.73, 52.37, 'gross'], Wolfsburg: [10.79, 52.42, 'mittel'],
  Braunschweig: [10.53, 52.27, 'mittel'], Magdeburg: [11.63, 52.13, 'mittel'], Osnabrück: [8.05, 52.28, 'mittel'],
  Bielefeld: [8.53, 52.02, 'mittel'], Münster: [7.63, 51.96, 'mittel'], Hamm: [7.82, 51.68, 'mittel'],
  Dortmund: [7.47, 51.51, 'gross'], Göttingen: [9.93, 51.54, 'mittel'], Leipzig: [12.37, 51.34, 'gross'],
  Kassel: [9.48, 51.31, 'mittel'], Dresden: [13.74, 51.05, 'gross'], Bebra: [9.79, 50.97, 'klein'],
  Köln: [6.96, 50.94, 'gross'], Erfurt: [11.03, 50.98, 'mittel'], Gießen: [8.68, 50.58, 'klein'],
  Fulda: [9.68, 50.55, 'klein'], Frankfurt: [8.68, 50.11, 'gross'], Würzburg: [9.93, 49.79, 'mittel'],
  Mannheim: [8.47, 49.49, 'mittel'], Nürnberg: [11.08, 49.45, 'gross'], Karlsruhe: [8.4, 49.0, 'mittel'],
  Treuchtlingen: [10.91, 48.95, 'klein'], Regensburg: [12.1, 49.01, 'mittel'], Stuttgart: [9.18, 48.78, 'gross'],
  Ulm: [9.99, 48.4, 'mittel'], Augsburg: [10.9, 48.37, 'mittel'], München: [11.58, 48.14, 'gross'],
  Passau: [13.45, 48.57, 'klein'], Freiburg: [7.85, 47.99, 'mittel'],
};

export const REGIONS = {
  nord: { name: 'Norddeutschland', layers: 4, minTrip: 2.4, minLat: 51.25, buffer: [0, 5] },
  de: { name: 'Ganz Deutschland', layers: 5, minTrip: 4.2, minLat: -90, buffer: [0, 6] },
};

export const OUTLINE = [[8.7, 54.9], [9.9, 54.8], [10.9, 54.35], [11.0, 54.0], [12.3, 54.45], [13.4, 54.65], [14.2, 53.9],
  [14.4, 53.3], [14.7, 52.6], [14.6, 51.8], [15.0, 51.1], [14.3, 50.9], [12.9, 50.4], [12.1, 50.25], [12.5, 49.7],
  [13.0, 49.3], [13.8, 48.75], [13.0, 47.6], [12.2, 47.65], [10.9, 47.4], [9.6, 47.55], [8.6, 47.65], [7.6, 47.6],
  [7.6, 48.3], [8.2, 48.98], [6.4, 49.45], [6.1, 50.1], [6.0, 50.75], [5.9, 51.05], [6.2, 51.85], [6.9, 52.2],
  [7.05, 52.65], [7.2, 53.25], [8.0, 53.7], [8.7, 53.9], [8.9, 54.4]];

// Delay tables: [[minutes or [min, max], weight], ...]
export const LINES = {
  ICB: {
    name: 'ICB', long: 'InterCity-Bummel', color: '#d63a2f', emoji: '🚄', takt: 60, numbers: [500, 999],
    ride: km => 12 + km * 0.45, price: km => 4 + km * 0.06, cancel: 0.06, rel: 'wackelig',
    windowExtra: [-1.5, 4], depDelay: [[0, 55], [[2, 6], 30], [[7, 15], 15]],
    rideDelay: [[0, 40], [[2, 5], 30], [[6, 12], 18], [[13, 25], 8], [[30, 50], 4]],
  },
  RE: {
    name: 'RE', long: 'Regional-Express', color: '#6b7280', emoji: '🚆', takt: 30, numbers: [1, 60],
    ride: km => 10 + km * 0.6, price: km => 2 + km * 0.03, cancel: 0.04, rel: 'meist pünktlich',
    windowExtra: [1, 7], depDelay: [[0, 75], [[1, 4], 25]], rideDelay: [[0, 65], [[1, 4], 28], [[5, 9], 7]],
  },
};
export const SEV = { name: 'SEV', long: 'Ersatzbus', color: '#f08c00', emoji: '🚌', rideMul: 1.7, sprintMul: 0.7 };
export const TAXI = { emoji: '🚕', ride: km => 10 + km * 0.6, price: km => 12 + km * 0.35 };
export const RIDESHARE = { emoji: '🚗' };
export const MISSED_EMOJI = '🏃';
export const FARE_DODGE = { risk: 0.3, penalty: 30 };

export const SPRINT_DIST = { klein: 3000, mittel: 3900, gross: 4800 };
export const SPRINT_SPEED = 260;

export const START_MONEY = 30;

// Each item has a catch or costs money; effects are read by run.js and sprint.js.
export const ITEMS = {
  laufschuhe: { name: 'Laufschuhe', icon: '👟', price: 12, desc: '+10 % Tempo im Sprint.' },
  thermobecher: { name: 'Thermobecher', icon: '☕', price: 8, desc: 'Kaffee-Schub zu Beginn jedes Sprints.' },
  ellenbogen: { name: 'Ellenbogen', icon: '💪', price: 9, desc: 'Reisegruppen werfen dich nicht aus dem Tritt.' },
  taubenfutter: { name: 'Taubenfutter', icon: '🌾', price: 6, desc: 'Tauben fliegen immer weg.' },
  powerbank: { name: 'Powerbank', icon: '🔋', price: 10, desc: 'Die App liegt immer richtig.' },
  noisecancel: { name: 'Noise-Cancelling', icon: '🎧', price: 11, desc: 'Kein Stolpern bei Treffern, dafür hörst du keine Durchsagen.' },
  bahncard: { name: 'BahnCard', icon: '💳', price: 14, desc: 'Einmal pro Reise wartet der Zug 1 Minute auf dich.' },
  rollkoffer: { name: 'Rollkoffer', icon: '🧳', price: 7, desc: '−10 % Tempo, dafür +50 % Geld im Sprint.' },
  fahrgastrechte: { name: 'Fahrgastrechte-Formular', icon: '📝', price: 5, desc: 'Ab 30 Min Verspätung gibt es die halbe Fahrkarte zurück.' },
  deutschlandticket: { name: 'Deutschlandticket', icon: '🎫', price: 13, desc: 'RE-Fahrten kosten nichts.' },
};

export const CHARACTERS = {
  pendler: { name: 'Pendler', icon: '🧑‍💼', desc: 'Kennt jeden Bahnhof: Wege 10 % kürzer.', distMul: 0.9 },
  studentin: { name: 'Studentin', icon: '🎒', desc: 'Startet mit Deutschlandticket, aber nur 15 € Startgeld.', startItems: ['deutschlandticket'], startMoney: 15 },
  rentner: { name: 'Rentner mit Rollator', icon: '🧓', desc: '15 % langsamer, aber Reisegruppen machen Platz und Fahrkarten kosten die Hälfte.', speedMul: 0.85, groupsYield: true, ticketMul: 0.5 },
};

// Cumulative: Stufe 3 includes the effects of 1 and 2.
export const STUFEN = [
  null,
  { name: 'Stufe 1', desc: 'Alle Info-Quellen liegen öfter falsch.' },
  { name: 'Stufe 2', desc: '10 € weniger Startgeld.' },
  { name: 'Stufe 3', desc: 'Volle Bahnhöfe: mehr Hindernisse.' },
  { name: 'Stufe 4', desc: 'Der Termin ist 8 Minuten früher.' },
  { name: 'Stufe 5', desc: 'Doppelt so viele Zugausfälle.' },
];
export const MAX_STUFE = 5;

// Fixed unlock ladder, paid for with travelled kilometres (failed journeys count too).
export const LADDER = [
  { km: 400, kind: 'character', id: 'studentin', label: 'Figur: Studentin' },
  { km: 1000, kind: 'region', id: 'de', label: 'Region: Ganz Deutschland' },
  { km: 1800, kind: 'perk', id: 'startgeld', label: 'Vielfahrer: +5 € Startgeld' },
  { km: 2800, kind: 'character', id: 'rentner', label: 'Figur: Rentner mit Rollator' },
  { km: 4000, kind: 'perk', id: 'kiosk4', label: 'Kiosk bietet 4 statt 3 Sachen' },
  { km: 5500, kind: 'perk', id: 'stammkunde', label: 'Stammkunde: erster Kiosk-Kauf −50 %' },
  { km: 7500, kind: 'perk', id: 'lounge', label: 'Lounge-Zugang: Laptop-Job zahlt +50 %' },
  { km: 10000, kind: 'perk', id: 'goldcard', label: 'Goldene BahnCard: wirkt zweimal' },
];

export const NODE_KINDS = {
  start: { icon: '🏠', name: 'Start' },
  bahnhof: { icon: '🚉', name: 'Bahnhof' },
  kiosk: { icon: '🛒', name: 'Kiosk' },
  lounge: { icon: '🛋️', name: 'Lounge' },
  event: { icon: '❓', name: 'Ereignis' },
  ziel: { icon: '🏁', name: 'Ziel' },
};

export const OCCASIONS = [
  { name: 'Vorstellungsgespräch', ok: 'Pünktlich. Das Hemd sitzt halbwegs.', late: 'Die Stelle ist leider schon vergeben.' },
  { name: 'Omas 80. Geburtstag', ok: 'Oma: „Kind, du bist ja ganz verschwitzt!“', late: 'Der Kuchen ist alle. Oma ist enttäuscht.' },
  { name: 'Erstes Date', ok: 'Dein Date wartet schon. Mit zwei Kaffee.', late: '„Sorry, ich bin dann mal weg.“' },
  { name: 'Konzert', ok: 'Rechtzeitig zum ersten Song.', late: 'Die Zugabe hörst du vom Parkplatz.' },
  { name: 'Hochzeit deiner Schwester', ok: 'Gerade rechtzeitig zum Ja-Wort.', late: 'Du bist auf keinem Gruppenfoto.' },
  { name: 'Klausur', ok: 'Platz gefunden. Stift vergessen.', late: 'Der Raum ist schon zu.' },
  { name: 'Heimspiel', ok: 'Anpfiff. Du stehst in der Kurve.', late: 'Das Tor hast du in der App gesehen.' },
];

export const EVENTS = {
  mitfahr: {
    icon: '🚗',
    title: 'Mitfahrgelegenheit',
    text: 'Ein Typ mit Kombi bietet dir an, dich mitzunehmen. Kostenlos. Wie lange es dauert, weiß er selbst nicht.',
    choices: ['Einsteigen', 'Lieber Bahn'],
  },
  fundsache: {
    icon: '👛',
    title: 'Fundsache',
    text: 'Auf der Bank liegt ein Portemonnaie mit 15 €.',
    choices: ['Behalten (+15 €)', 'Abgeben (Finderlohn: eine Überraschung)'],
  },
  stellwerk: {
    icon: '🚦',
    title: 'Stellwerksstörung',
    text: 'Alle Züge ab hier fahren frühestens in 20 Minuten. Draußen teilen sich Leute ein Taxi.',
    choices: ['Warten', 'Taxi teilen (12 €)'],
  },
  musiker: {
    icon: '🎸',
    title: 'Straßenmusik',
    text: 'Jemand spielt den Bummelbahn-Blues. Der Ohrwurm macht dich beim nächsten Sprint schneller.',
    choices: ['3 € geben', 'Weitergehen'],
  },
  automat: {
    icon: '🎰',
    title: 'Kaputter Automat',
    text: 'Der Fahrkartenautomat spuckt Münzen aus. Die Security schaut gerade weg. Vielleicht.',
    choices: ['Einsammeln (+8 €, Risiko)', 'Ehrlich bleiben'],
  },
};

export const LOUNGE = { pay: 12, minutes: 20 };

export const TEXT = {
  railName: 'Deutsche Bummelbahn',
};
