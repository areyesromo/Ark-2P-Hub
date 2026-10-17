// The real lobby entries (with their setup screens) run minigame after minigame.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers.js';
import { getGame } from '../server/games/index.js';

test('Micro Mayhem from the lobby plays 20 micros without breaking', () => {
  const ctx = fakeCtx();
  const game = getGame('micro-mayhem').create(ctx);
  game.start();
  game.onInput(0, { type: 'go' });
  ctx.settings = undefined;
  let micros = 0;
  for (let i = 0; i < 400 && micros < 20; i++) {
    const v = game.hostView();
    if (v.phase === 'over') { game.onInput(0, { type: 'rematch' }); continue; }
    if (v.phase === 'play') {
      micros++;
      game.onInput(0, { type: 'touch' });
    }
    ctx.advance(500);
  }
  assert.equal(micros >= 20, true, `played ${micros}`);
});

test('Party Minigames from the lobby plays every party minigame', () => {
  const ctx = fakeCtx();
  const game = getGame('party-minis').create(ctx);
  game.start();
  game.onInput(0, { type: 'go' });
  const seen = new Set();
  for (let i = 0; i < 8000 && seen.size < 10; i++) {
    const v = game.hostView();
    if (v.phase === 'over') game.onInput(0, { type: 'rematch' });
    if (v.phase === 'play') seen.add(v.mini.id);
    ctx.advance(250);
  }
  assert.equal(seen.size, 10);
});
