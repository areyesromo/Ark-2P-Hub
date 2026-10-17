// Setup screens: every game opens on one; the hub draws it for the games
// wrapped with withSetup (server/games/options.js), which then start with the
// settings picked.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { listGames, getGame } from '../server/games/index.js';
import { fakeCtx } from './helpers.js';

/** A fresh game from the hub's list, with controller players (so Battleship skips placing ships). */
function create(id, saved = {}) {
  const ctx = fakeCtx();
  ctx.players.forEach((p) => (p.local = true));
  ctx.saved = saved;
  const game = getGame(id).create(ctx);
  game.start();
  return { ctx, game };
}

test('every game opens on a setup screen, its own or the hub\'s', () => {
  for (const { id } of listGames()) {
    const { game } = create(id);
    const v = game.hostView();
    assert.equal(v.phase, 'setup', id);
    const options = v.hubSetup ? v.hubSetup.options : v.options;
    assert.ok(options && Object.keys(options).length, `${id} has options`);
    if (v.hubSetup) {
      for (const row of v.hubSetup.rows) {
        assert.ok(row.title && options[row.key], `${id}.${row.key}`);
        for (const value of options[row.key]) assert.ok(row.labels[value], `${id}.${row.key}=${value} has a label`);
      }
      assert.deepEqual(game.playerView(1).hubSetup, v.hubSetup);
      assert.equal(game.playerView(1).you, 1);
    }
  }
});

test('the hub setup screen: pick, start, play with the settings, back to setup only once it is over', () => {
  const saved = {};
  const { ctx, game } = create('rock-paper-scissors', saved);
  game.onInput(0, { type: 'pick', choice: 'rock' }); // nothing to play yet
  game.onInput(0, { type: 'setting', key: 'wins', value: 5 });
  game.onInput(1, { type: 'setting', key: 'wins', value: 4 }); // not a choice
  assert.equal(game.hostView().hubSetup.settings.wins, 5);
  assert.deepEqual(saved.settings, { wins: 5 });
  game.onInput(1, { type: 'go' });
  let v = game.hostView();
  assert.equal(v.phase, 'choose');
  assert.equal(v.winScore, 5);
  assert.ok(v.hubSetup, 'the hub still knows it can offer the setup screen later');
  game.onInput(0, { type: 'setup' }); // mid-match: ignored
  assert.equal(game.hostView().phase, 'choose');
  for (let r = 0; r < 5; r++) {
    game.onInput(0, { type: 'pick', choice: 'rock' });
    game.onInput(1, { type: 'pick', choice: 'scissors' });
    if (game.hostView().phase !== 'over') ctx.advance(5000);
  }
  v = game.hostView();
  assert.equal(v.phase, 'over');
  assert.deepEqual(v.scores, [5, 0]);
  game.onInput(1, { type: 'setup' });
  assert.equal(game.hostView().phase, 'setup');
  // The next launch in this room remembers "first to 5".
  assert.equal(create('rock-paper-scissors', saved).game.hostView().hubSetup.settings.wins, 5);
});

test('each wrapped game honours its setting', () => {
  const start = (id, key, value) => {
    const { ctx, game } = create(id);
    game.onInput(0, { type: 'setting', key, value });
    game.onInput(0, { type: 'go' });
    return { ctx, game, v: game.hostView() };
  };
  for (const [id, value] of [['reaction-duel', 7], ['rock-paper-scissors', 7], ['pong', 11], ['tron', 5], ['air-hockey', 10], ['snake', 2], ['tanks', 5], ['sumo', 2], ['connect-four', 1]]) {
    assert.equal(start(id, 'wins', value).v.winScore, value, id);
  }
  assert.equal(start('quiz', 'questions', 5).v.total, 5);
  assert.equal(start('draw-duel', 'rounds', 3).v.rounds, 3);
  assert.equal(start('sketch-guess', 'rounds', 4).v.rounds, 4);
  const { v } = start('battleship', 'shotSeconds', 15); // controller players: straight to firing
  assert.equal(v.phase, 'aim');
  assert.equal(v.timeLeftMs, 15000);
});
