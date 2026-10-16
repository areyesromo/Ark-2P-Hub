import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DrawDuel, ROUNDS, TIMING, DRAW_PUSH_MS, LIMITS } from '../server/games/draw-duel.js';
import { SHAPES, accuracy, fitted } from '../server/games/draw-shapes.js';
import { fakeCtx } from './helpers.js';

function setup() {
  const ctx = fakeCtx();
  const game = new DrawDuel(ctx);
  game.start();
  return { ctx, game };
}

const toDraw = (ctx) => ctx.advance(TIMING.countdownMs + TIMING.showMs);
/** Run the clock until the next drawing phase (or the end of the match). */
function untilDrawing(ctx, game) {
  while (game.phase !== 'draw' && game.phase !== 'over') ctx.advance(100);
}
const shapeOf = (game) => SHAPES.find((s) => s.name === game.rounds[game.index].name);

/** Send a set of strokes the way a phone does: in batches, flagging each new stroke. */
function drawStrokes(game, slot, strokes) {
  for (const s of strokes) {
    for (let i = 0; i < s.length; i += 40) game.onInput(slot, { type: 'draw', newStroke: i === 0, pts: s.slice(i, i + 40) });
  }
}

const by = (name) => SHAPES.find((s) => s.name === name);

test('scoring: an exact copy is 100%, anywhere and at any size', () => {
  for (const s of SHAPES) assert.equal(accuracy(s.paths, fitted(s.paths)), 100, s.name);
  const small = fitted(by('Star').paths, 0.35).map((p) => p.map((v) => v * 0.5 + 0.1)); // small, in a corner
  assert.ok(accuracy(by('Star').paths, small) >= 98);
});

test('scoring: the wrong shape, a scribble, a dot or nothing score low', () => {
  assert.ok(accuracy(by('Star').paths, fitted(by('Circle').paths)) < 30);
  assert.ok(accuracy(by('Lightning bolt').paths, fitted(by('Square').paths)) < 10);
  let seed = 7;
  const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const scribble = [Array.from({ length: 120 }, rnd)];
  for (const s of SHAPES) assert.ok(accuracy(s.paths, scribble) < 30, s.name);
  assert.equal(accuracy(by('Circle').paths, [[0.5, 0.5, 0.51, 0.5]]), 0, 'a dot');
  assert.equal(accuracy(by('Circle').paths, []), 0);
});

test('scoring: a shaky but recognisable copy still scores well', () => {
  const wobble = (paths, a) => paths.map((p) => p.map((v, i) => v + a * Math.sin(i * 0.15 + (i % 2) * 2)));
  for (const s of SHAPES) {
    const score = accuracy(s.paths, wobble(fitted(s.paths), 0.05));
    assert.ok(score >= 55 && score < 100, `${s.name}: ${score}`);
  }
});

test('countdown, then the shape is shown, then hidden while drawing', () => {
  const { ctx, game } = setup();
  assert.equal(game.phase, 'countdown');
  assert.equal(game.hostView().outline, null);
  assert.equal(game.hostView().shapeName, null);
  ctx.advance(1000);
  assert.equal(game.hostView().countdown, 2, 'countdown pushed every second');
  ctx.advance(TIMING.countdownMs - 1000);
  assert.equal(game.phase, 'show');
  assert.ok(game.hostView().outline.length >= 1);
  assert.ok(game.playerView(0).outline, 'phones see it too');
  ctx.advance(TIMING.showMs);
  assert.equal(game.phase, 'draw');
  assert.equal(game.hostView().outline, null, 'hidden while drawing');
  assert.equal(game.playerView(1).outline, null);
  assert.equal(game.hostView().shapeName, shapeOf(game).name, 'the name stays up');
});

test('drawing input builds strokes; pushes to screens are batched', () => {
  const { ctx, game } = setup();
  game.onInput(0, { type: 'draw', newStroke: true, pts: [0.1, 0.1, 0.2, 0.2] }); // not drawing yet
  assert.deepEqual(game.strokes[0], []);
  toDraw(ctx);
  const before = ctx.updates;
  game.onInput(0, { type: 'draw', newStroke: true, pts: [0.1, 0.1, 0.2, 0.2] });
  game.onInput(0, { type: 'draw', newStroke: false, pts: [0.3, 0.3] });
  game.onInput(0, { type: 'draw', newStroke: true, pts: [0.5, 0.5, 2, -1] }); // clamped
  assert.deepEqual(game.strokes[0], [[0.1, 0.1, 0.2, 0.2, 0.3, 0.3], [0.5, 0.5, 1, 0]]);
  assert.equal(ctx.updates, before, 'not pushed per input');
  ctx.advance(DRAW_PUSH_MS);
  assert.equal(ctx.updates, before + 1);
  assert.deepEqual(game.hostView().strokes[0], game.strokes[0], 'the TV sees drawings live');
  assert.equal(game.playerView(1).strokes, null, "phones don't get strokes while drawing");
});

test('undo and clear', () => {
  const { ctx, game } = setup();
  toDraw(ctx);
  drawStrokes(game, 1, [[0, 0, 1, 1], [0, 1, 1, 0], [0.5, 0, 0.5, 1]]);
  game.onInput(1, { type: 'undo' });
  assert.equal(game.strokes[1].length, 2);
  assert.equal(game.points[1], 4);
  game.onInput(1, { type: 'clear' });
  assert.deepEqual(game.strokes[1], []);
  assert.equal(game.points[1], 0);
});

test('malformed or oversized drawing input is ignored; limits hold', () => {
  const { ctx, game } = setup();
  toDraw(ctx);
  for (const pts of [null, 'x', [0.1], [0.1, 0.2, 0.3], [0.1, NaN], [0.1, '0.2'], new Array(LIMITS.batch + 2).fill(0.5)]) {
    game.onInput(0, { type: 'draw', newStroke: true, pts });
  }
  game.onInput(0, { type: 'paint' });
  assert.deepEqual(game.strokes[0], []);
  for (let i = 0; i < LIMITS.strokes + 10; i++) game.onInput(0, { type: 'draw', newStroke: true, pts: [0.5, 0.5] });
  assert.equal(game.strokes[0].length, LIMITS.strokes);
  game.onInput(1, { type: 'clear' });
  for (let i = 0; i < 30; i++) game.onInput(1, { type: 'draw', newStroke: false, pts: new Array(LIMITS.batch).fill(0.5) });
  assert.equal(game.points[1], LIMITS.points);
});

test('the reveal scores both drawings; it comes early when both are done', () => {
  const { ctx, game } = setup();
  toDraw(ctx);
  const shape = shapeOf(game);
  drawStrokes(game, 0, fitted(shape.paths)); // perfect
  drawStrokes(game, 1, [[0.1, 0.1, 0.9, 0.9]]); // one line
  game.onInput(0, { type: 'done' });
  game.onInput(0, { type: 'draw', newStroke: true, pts: [0, 0, 1, 1] }); // locked once done
  assert.equal(game.phase, 'draw');
  assert.equal(game.playerView(1).opponentDone, true);
  game.onInput(1, { type: 'done' });
  assert.equal(game.phase, 'reveal');
  const v = game.hostView();
  assert.equal(v.accuracy[0], 100);
  assert.ok(v.accuracy[1] < 50);
  assert.deepEqual(game.scores, v.accuracy);
  assert.ok(v.outline, 'the shape is back for the reveal');
  assert.deepEqual(game.playerView(1).strokes, game.strokes[1], 'phones get their drawing back');
  assert.equal(v.history.length, 1);
});

test('time running out reveals; an empty canvas scores 0', () => {
  const { ctx, game } = setup();
  toDraw(ctx);
  drawStrokes(game, 0, fitted(shapeOf(game).paths));
  ctx.advance(TIMING.drawMs);
  assert.equal(game.phase, 'reveal');
  assert.deepEqual(game.accuracy, [100, 0]);
  ctx.advance(TIMING.revealMs);
  assert.equal(game.phase, 'show');
  assert.equal(game.hostView().round, 2);
  assert.deepEqual(game.strokes, [[], []], 'fresh canvases each round');
});

test('after the last round the higher total wins; equal totals draw; rematch picks new shapes', () => {
  const { ctx, game } = setup();
  for (let r = 0; r < ROUNDS; r++) {
    untilDrawing(ctx, game);
    drawStrokes(game, 1, fitted(shapeOf(game).paths));
    game.onInput(0, { type: 'done' });
    game.onInput(1, { type: 'done' });
    ctx.advance(TIMING.revealMs);
  }
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
  assert.deepEqual(game.scores, [0, 100 * ROUNDS]);
  assert.equal(ctx.pendingTimers(), 0);

  const first = new Set(game.rounds.map((s) => s.name));
  game.onInput(0, { type: 'rematch' });
  assert.equal(game.phase, 'countdown');
  assert.deepEqual(game.scores, [0, 0]);
  for (const s of game.rounds) assert.ok(!first.has(s.name), `repeated ${s.name}`);

  for (let r = 0; r < ROUNDS; r++) {
    untilDrawing(ctx, game);
    ctx.advance(TIMING.drawMs + TIMING.revealMs);
  }
  assert.equal(game.phase, 'over');
  assert.equal(game.draw, true);
  assert.equal(game.winner, null);
});
