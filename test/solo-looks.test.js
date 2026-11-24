import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers-solo.js';
import { LOOKS, lookOf } from '../server/solo/games/looks.js';
import { getAchievement } from '../server/solo/achievements.js';
import { SOLO_GAMES } from '../server/solo/games/index.js';
import { lockedFor } from '../server/solo/games/options.js';

const getGame = (id) => SOLO_GAMES.find((g) => g.id === id) || null;

test('every look but the first is opened by one of its own game\'s achievements', () => {
  for (const [game, list] of Object.entries(LOOKS)) {
    const [first, ...rest] = Object.values(list);
    assert.equal(first.unlock, undefined, game);
    for (const look of rest) assert.equal(getAchievement(look.unlock).game, game, `${game} ${look.name}`);
  }
});

test('a new player sees the looks locked with how to open them; an earned one can be picked', () => {
  for (const game of Object.keys(LOOKS)) {
    const def = getGame(game);
    const ctx = fakeCtx();
    ctx.achievements = () => ({});
    assert.equal(Object.keys(lockedFor(ctx, def.spec).look).length, Object.keys(LOOKS[game]).length - 1, game);
    const [, second] = Object.keys(LOOKS[game]);
    ctx.achievements = () => ({ [LOOKS[game][second].unlock]: 1 });
    const setup = def.create(ctx);
    setup.start();
    setup.onInput({ type: 'setting', key: 'look', value: second });
    setup.onInput({ type: 'go' });
    assert.equal(setup.hostView().look, second, game);
  }
});

test('a look doesn\'t change the scores\' table', () => {
  const variant = (look) => {
    const ctx = fakeCtx('Ana', { look, speed: 'fast', walls: 'wrap' });
    const def = getGame('snake-1p').base;
    const g = def.create(ctx);
    g.start();
    return g.hostView().variant;
  };
  assert.equal(variant('gold'), variant('classic'));
  assert.equal(lookOf(fakeCtx('Ana', { look: 'toString' }), 'flappy'), 'bird');
});

test('every Memory look has enough different faces for the biggest board', async () => {
  const { FACE_SETS } = await import('../server/solo/games/memory-1p.js');
  assert.deepEqual(Object.keys(FACE_SETS), Object.keys(LOOKS['memory-1p']));
  for (const [look, faces] of Object.entries(FACE_SETS)) assert.ok(new Set(faces).size >= 18, look);
});
