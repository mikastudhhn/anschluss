import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeRng, hashOf, dayNumber } from '../src/logic/rng.js';

test('same seed gives the same sequence', () => {
  const a = makeRng(42), b = makeRng(42);
  for (let i = 0; i < 20; i++) assert.equal(a.next(), b.next());
});

test('different seeds give different sequences', () => {
  assert.notEqual(makeRng(1).next(), makeRng(2).next());
});

test('int stays inside inclusive bounds and hits both ends', () => {
  const r = makeRng(7), seen = new Set();
  for (let i = 0; i < 500; i++) {
    const v = r.int(1, 3);
    assert.ok(v >= 1 && v <= 3);
    seen.add(v);
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3]);
});

test('weighted never picks a zero-weight entry', () => {
  const r = makeRng(3);
  for (let i = 0; i < 300; i++) assert.notEqual(r.weighted([['a', 1], ['b', 0], ['c', 2]]), 'b');
});

test('hashOf is stable and order sensitive', () => {
  assert.equal(hashOf(1, 'x', 3), hashOf(1, 'x', 3));
  assert.notEqual(hashOf(1, 'x', 3), hashOf(3, 'x', 1));
});

test('dayNumber counts local days from launch, starting at 1', () => {
  assert.equal(dayNumber(new Date(2026, 9, 27, 0, 5)), 1);
  assert.equal(dayNumber(new Date(2026, 9, 27, 23, 55)), 1);
  assert.equal(dayNumber(new Date(2026, 9, 28, 0, 1)), 2);
  assert.equal(dayNumber(new Date(2026, 10, 27, 12)), 32);
});
