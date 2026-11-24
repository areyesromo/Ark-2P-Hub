import { test } from 'node:test';
import assert from 'node:assert/strict';
import { challengeFor, POOL } from '../server/solo/daily.js';
import { SOLO_GAMES } from '../server/solo/games/index.js';
import { fakeCtx } from './helpers-solo.js';
import { seeded } from '../server/solo/rng.js';

const getGame = (id) => SOLO_GAMES.find((g) => g.id === id) || null;

test('every game in the pool exists, takes the room rng, and its settings are real choices', () => {
  for (const p of POOL) {
    const def = getGame(p.game);
    assert.ok(def, p.game);
    for (const [key, value] of Object.entries(p.settings)) assert.ok(def.options && def.options[key].includes(value), `${p.game} ${key}=${value}`);
  }
});

test('the same day is the same challenge; every game comes round once in a lap', () => {
  assert.deepEqual(challengeFor('2026-10-22'), challengeFor('2026-10-22'));
  assert.notEqual(challengeFor('2026-10-22').seed, challengeFor('2026-10-23').seed);
  // A lap starts on a day number that's a multiple of the pool's size.
  const start = POOL.length * 1500;
  const games = [];
  for (let d = start; d < start + POOL.length; d++) games.push(challengeFor(new Date(d * 86400000).toISOString().slice(0, 10)).game);
  assert.deepEqual(games.slice().sort(), POOL.map((p) => p.game).sort());
});

test('the same seed deals the same game (a puzzle from the pool)', () => {
  const c = challengeFor('2026-10-22');
  for (const id of ['sudoku', 'gems', 'nonogram', 'trivia-1p', 'blocks-1p']) {
    const def = getGame(id);
    const deal = () => {
      const ctx = fakeCtx('Ana', POOL.find((p) => p.game === id).settings);
      ctx.rng = seeded(c.seed);
      ctx.challenge = true;
      const g = (def.base || def).create(ctx);
      g.start();
      return g;
    };
    const a = deal();
    const b = deal();
    assert.deepEqual(a.hostView(), b.hostView(), id);
  }
});
