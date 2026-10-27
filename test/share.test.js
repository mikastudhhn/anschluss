import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreText, shareText, encodeChallenge, decodeChallenge, challengeFromHash } from '../src/logic/share.js';

test('scoreText reads like a station announcement', () => {
  assert.equal(scoreText(7), '7 Min zu früh');
  assert.equal(scoreText(-3), '3 Min zu spät');
  assert.equal(scoreText(0), 'auf die Minute');
});

test('shareText has number, route, emoji line, score, stars and link', () => {
  const t = shareText({ day: 12, from: 'Hamburg', to: 'München', occasion: 'Omas 80. Geburtstag', line: '🚄🚄🚌🏃🚄', score: 7, stars: 3, link: 'https://x.y/#c=abc' });
  assert.equal(t, 'Anschluss! Tagesreise #12\nHamburg → München · Omas 80. Geburtstag\n🚄🚄🚌🏃🚄  7 Min zu früh ⭐⭐⭐\nhttps://x.y/#c=abc');
});

test('challenge round-trips with umlauts and emoji', () => {
  const c = { day: 12, score: -4, name: 'Jörg', line: '🚄🏃🚆' };
  assert.deepEqual(decodeChallenge(encodeChallenge(c)), c);
  assert.deepEqual(challengeFromHash('#c=' + encodeChallenge(c)), c);
});

test('broken or hostile challenges are rejected or cleaned', () => {
  assert.equal(decodeChallenge('%%%'), null);
  assert.equal(decodeChallenge(encodeChallenge({ day: 'x', score: 1, name: 'a', line: '' })), null);
  assert.equal(challengeFromHash('#foo'), null);
  const long = decodeChallenge(encodeChallenge({ day: 1, score: 1, name: '<b>' + 'x'.repeat(40), line: '🚆' }));
  assert.ok(long.name.length <= 16);
  assert.ok(!long.name.includes('<'));
});
