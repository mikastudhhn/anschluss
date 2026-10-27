import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGesture } from '../src/ui/gesture.js';

const setup = () => {
  const steps = [];
  return { steps, g: createGesture(() => 360, dir => steps.push(dir)) };
};

test('a swipe changes one lane as soon as the finger has moved far enough', () => {
  const { steps, g } = setup();
  g.down(200, 400, 0);
  g.move(215, 402);
  assert.deepEqual(steps, []);
  g.move(230, 404);
  assert.deepEqual(steps, [1], 'fires during the move, not at the end');
  g.move(300, 404);
  g.up(300, 404, 120);
  assert.deepEqual(steps, [1], 'one lane per swipe');
});

test('swipes work in both directions and from anywhere on the screen', () => {
  const { steps, g } = setup();
  g.down(320, 300, 0); g.move(280, 300); g.up(280, 300, 90);
  g.down(40, 300, 500); g.move(90, 300); g.up(90, 300, 590);
  assert.deepEqual(steps, [-1, 1]);
});

test('a short tap still steps towards its side', () => {
  const { steps, g } = setup();
  g.down(60, 400, 0); g.up(62, 401, 80);
  g.down(300, 400, 200); g.up(300, 400, 260);
  assert.deepEqual(steps, [-1, 1]);
});

test('vertical drags and long presses do nothing', () => {
  const { steps, g } = setup();
  g.down(100, 300, 0); g.move(110, 380); g.up(110, 380, 100);
  g.down(100, 300, 500); g.up(100, 300, 1500);
  assert.deepEqual(steps, []);
});
