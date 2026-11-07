import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { TowerStack, TIMING, STACK, offsetAt } from '../server/games/tower-stack.js';
import { towerStackBot } from '../server/games/tower-stack-bot.js';
import { getGame } from '../server/games/index.js';

function game({ difficulty = 0 } = {}) {
  const ctx = fakeCtx();
  ctx.settings = { difficulty };
  const g = new TowerStack(ctx);
  g.start();
  ctx.advance(TIMING.introMs + 1);
  return { ctx, g };
}
/** Wait until the sliding block is `off` from the middle (moving either way), give or take a tick. */
function waitFor(ctx, g, off) {
  for (let i = 0; i < 4000; i++) {
    if (Math.abs(g.offsetNow() - off) < 0.06) return;
    ctx.advance(5);
  }
  throw new Error('never got there');
}
/** Drop it right over the middle: a perfect one. */
function perfect(ctx, g) {
  // (the server reads where it was LAG_MS ago: drop that long after it crosses)
  waitFor(ctx, g, 0);
  ctx.advance(STACK.lagMs);
  g.onInput(g.turn, { type: 'drop' });
  ctx.advance(TIMING.settleMs + 1);
}

test('the sliding block goes back and forth across the tower, out to the same distance either side', () => {
  const xs = [];
  for (let t = 0; t < 4000; t += 10) xs.push(offsetAt(t, 4, 7));
  assert.ok(Math.min(...xs) <= -6.95 && Math.max(...xs) >= 6.95);
  assert.equal(offsetAt(0, 4, 7), -7, 'it comes in from one side');
});

test('you take turns: player 1 drops the floors that slide left-right, player 2 the ones that slide front-back', () => {
  const { ctx, g } = game();
  assert.equal(g.phase, 'drop');
  assert.equal(g.turn, 0);
  assert.equal(g.hostView().move.axis, 'x');
  g.onInput(1, { type: 'drop' });
  assert.equal(g.phase, 'drop', 'not your turn');
  perfect(ctx, g);
  assert.equal(g.height(), 1);
  assert.equal(g.turn, 1);
  assert.equal(g.hostView().move.axis, 'z');
});

test('a perfect drop keeps the full size; an off one is cut down to what overlaps (the rest falls)', () => {
  const { ctx, g } = game();
  perfect(ctx, g);
  assert.equal(g.hostView().last.kind, 'perfect');
  const w0 = g.top().z1 - g.top().z0;
  // Player 2: 1.5 off along z.
  waitFor(ctx, g, 1.5);
  ctx.advance(STACK.lagMs);
  g.onInput(1, { type: 'drop' });
  const v = g.hostView();
  assert.equal(v.last.kind, 'cut');
  const top = g.top();
  assert.ok(Math.abs(top.z1 - top.z0 - (w0 - 1.5)) < 0.12, 'cut to the overlap: ' + (top.z1 - top.z0));
  assert.ok(v.last.piece && v.last.piece.z1 - v.last.piece.z0 > 1.3, 'the piece that falls off');
});

test('a miss costs a life and that player tries the floor again; out of lives, the tower is done', () => {
  const { ctx, g } = game();
  const lives = g.lives;
  waitFor(ctx, g, -6.9);
  ctx.advance(STACK.lagMs);
  g.onInput(0, { type: 'drop' });
  assert.equal(g.hostView().last.kind, 'miss');
  assert.equal(g.lives, lives - 1);
  ctx.advance(TIMING.missMs + 1);
  assert.equal(g.turn, 0);
  assert.equal(g.height(), 0);
  for (let i = 0; i < lives - 1; i++) {
    waitFor(ctx, g, 6.9);
    ctx.advance(STACK.lagMs);
    g.onInput(0, { type: 'drop' });
    ctx.advance(TIMING.missMs + 1);
  }
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().stars, 0);
});

test('three perfect drops in a row and the block starts growing back (never past where it started)', () => {
  const { ctx, g } = game();
  waitFor(ctx, g, 1);
  ctx.advance(STACK.lagMs);
  g.onInput(0, { type: 'drop' });
  ctx.advance(TIMING.settleMs + 1);
  const narrow = g.top().x1 - g.top().x0;
  for (let i = 0; i < 6; i++) perfect(ctx, g);
  assert.ok(g.hostView().combo >= 6);
  assert.ok(g.top().x1 - g.top().x0 > narrow + 0.2, 'grew: ' + narrow + ' -> ' + (g.top().x1 - g.top().x0));
  assert.ok(g.top().x1 - g.top().x0 <= STACK.size + 1e-9);
});

test('it speeds up as the tower grows; Easy is slower with a wider perfect and more lives', () => {
  const { ctx, g } = game();
  const s0 = g.hostView().move.speed;
  for (let i = 0; i < 10; i++) perfect(ctx, g);
  assert.ok(g.hostView().move.speed > s0);
  const e = game({ difficulty: 1 }).g;
  assert.ok(e.hostView().move.speed < s0);
  assert.ok(e.lives > g.lives || e.maxLives > g.maxLives);
  assert.ok(e.perfectWindow > g.perfectWindow);
});

test('stars for height; the view says how high, the targets and whose drop it is', () => {
  const { ctx, g } = game();
  for (let i = 0; i < 16; i++) perfect(ctx, g);
  const v = g.hostView();
  assert.equal(v.height, 16);
  assert.deepEqual(v.targets, STACK.targets[0]);
  assert.ok(v.height >= v.targets[0]);
  // Out of lives up there: one star.
  g.lives = 1;
  waitFor(ctx, g, 6.9);
  ctx.advance(STACK.lagMs);
  g.onInput(g.turn, { type: 'drop' });
  ctx.advance(TIMING.missMs + 1);
  assert.equal(g.phase, 'over');
  assert.equal(g.hostView().stars, 1);
  assert.equal(g.hostView().maxStars, 3);
  // Rematch.
  g.onInput(1, { type: 'rematch' });
  ctx.advance(TIMING.introMs + 1);
  assert.equal(g.phase, 'drop');
  assert.equal(g.height(), 0);
});

test('bad input is ignored; a drop while the last one settles does nothing; one timer at a time', () => {
  const { ctx, g } = game();
  for (const bad of [null, 5, {}, { type: 'drop', x: 1 }, { type: 'rematch' }]) g.onInput(1, bad);
  assert.equal(g.phase, 'drop');
  g.onInput(0, { type: 'drop' });
  g.onInput(0, { type: 'drop' });
  g.onInput(1, { type: 'drop' });
  assert.equal(ctx.pendingTimers(), 1);
});

test('in the lobby: Tower Stack, a co-op game with a difficulty, and the computer as a teammate', () => {
  const def = getGame('tower-stack');
  assert.equal(def.name, 'Tower Stack');
  assert.equal(def.category, 'casual');
  assert.equal(typeof def.bot, 'function');
  assert.deepEqual(def.create(fakeCtx()).options.difficulty, [0, 1]);
});

test('the computer drops on its turn as the block crosses the middle: Hard nearly always perfect, Easy less often', () => {
  const rate = (level) => {
    let n = 0;
    for (let s = 0; s < 30; s++) {
      const { ctx, g } = game();
      let seed = s + 1;
      const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
      ctx.advance(Math.floor(rng() * 900)); // (somewhere along its slide)
      const m = towerStackBot(g.playerView(0), level, rng, 0, {});
      assert.equal(m.type, 'drop');
      assert.equal(towerStackBot(g.playerView(1), level, rng, 0, {}), null, 'not its turn');
      ctx.advance(m.botDelayMs);
      g.onInput(0, { type: 'drop' });
      if (g.hostView().last.kind === 'perfect') n++;
    }
    return n;
  };
  const hard = rate('hard');
  const easy = rate('easy');
  assert.ok(hard >= 22, 'hard ' + hard + '/30');
  assert.ok(easy < hard, 'easy ' + easy);
});
