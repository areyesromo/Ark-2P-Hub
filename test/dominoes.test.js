import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Dominoes, set, fitsEnds, pips, TIMING } from '../server/games/dominoes.js';
import { dominoesBot } from '../server/games/dominoes-bot.js';
import { fakeCtx } from './helpers.js';
import { play, seeded } from './helpers-bots.js';

function setup({ hands = [['6-6', '2-5', '1-3'], ['4-6', '0-0', '3-3']], line = [], yard = ['1-1', '2-2', '0-5'], turn = 0 } = {}, settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  const game = new Dominoes(ctx, seeded(3));
  game.start();
  game.hands = hands.map((h) => h.slice());
  game.line = line.map((x) => x.slice());
  game.yard = yard.slice();
  game.turn = turn;
  return { ctx, game };
}

test('the set: 28 tiles, double-blank to double-six; a tile fits an end with its number', () => {
  assert.equal(set().length, 28);
  assert.equal(pips('6-6'), 12);
  assert.deepEqual(fitsEnds('2-5', [5, 3]), ['L']);
  assert.deepEqual(fitsEnds('3-5', [5, 3]), ['L', 'R']);
  assert.deepEqual(fitsEnds('1-1', [5, 3]), []);
  assert.deepEqual(fitsEnds('1-1', null), ['L'], 'the first tile goes anywhere');
});

test('playing: the line grows at either end, turned to match; your tiles stay secret', () => {
  const { game } = setup();
  assert.ok(!JSON.stringify(game.playerView(1)).includes('2-5'));
  assert.ok(!('tiles' in game.hostView()));
  game.onInput(1, { type: 'play', tile: '4-6' }); // not their turn
  game.onInput(0, { type: 'play', tile: '6-6' });
  assert.deepEqual(game.line, [[6, 6]]);
  game.onInput(1, { type: 'play', tile: '0-0' }); // doesn't fit
  game.onInput(1, { type: 'play', tile: '4-6', end: 'L' });
  assert.deepEqual(game.line, [[4, 6], [6, 6]]);
  assert.deepEqual(game.ends(), [4, 6]);
  game.onInput(0, { type: 'play', tile: '2-5', end: 'R' }); // a 6 is needed there
  assert.equal(game.turn, 0);
});

test('nothing fits: draw till one does; with nothing left to draw, pass; both stuck ends the hand', () => {
  const { game } = setup({ hands: [['1-2', '1-3'], ['0-0', '2-2']], line: [[5, 5]], yard: ['4-5'] });
  assert.equal(game.playerView(0).stuck, 'draw');
  game.onInput(0, { type: 'play', tile: '1-2' }); // doesn't fit
  game.onInput(0, { type: 'pass' }); // there's still one to draw
  game.onInput(0, { type: 'draw' });
  assert.deepEqual(game.hands[0], ['1-2', '1-3', '4-5']);
  assert.equal(game.playerView(0).stuck, null, 'it fits now');
  game.onInput(0, { type: 'play', tile: '4-5', end: 'L' });
  assert.equal(game.playerView(1).stuck, 'pass');
  game.onInput(1, { type: 'pass' });
  game.onInput(0, { type: 'pass' });
  assert.equal(game.phase, 'handEnd');
  assert.deepEqual([game.result.winner, game.result.blocked, game.result.points], [1, true, 7 - 4], 'their 4 pips against 7');
});

test('out of tiles wins the hand and scores the other\'s pips; first to the target', () => {
  const { ctx, game } = setup({ hands: [['5-6'], ['0-1', '6-6']], line: [[6, 6]] });
  game.onInput(0, { type: 'play', tile: '5-6' });
  assert.equal(game.phase, 'handEnd');
  assert.deepEqual([game.result.winner, game.result.points], [0, 13]);
  assert.equal(game.scores[0], 13);
  game.scores = [0, 0];
  game.target = 10;
  ctx.advance(TIMING.handEndMs);
  assert.equal(game.phase, 'play');
  assert.equal(game.hands[0].length, 7);
  game.hands[game.turn] = ['3-4'];
  game.line = [];
  game.onInput(game.turn, { type: 'play', tile: '3-4' });
  assert.equal(game.phase, 'over');
});

test('out of time: you draw one and the turn passes; no timer waits', () => {
  const { ctx, game } = setup();
  game.armTurn();
  ctx.advance(TIMING.turnMs);
  assert.equal(game.hands[0].length, 4);
  assert.equal(game.turn, 1);
  const off = setup({}, { timer: 'off' });
  off.game.armTurn();
  off.ctx.advance(TIMING.turnMs * 3);
  assert.equal(off.game.turn, 0);
});

test('the computer: plays a tile that fits, draws or passes when stuck', () => {
  const { game } = setup({ line: [[6, 2]] });
  for (const level of ['easy', 'normal', 'hard']) {
    const m = dominoesBot(game.playerView(0), level, Math.random, 0, {});
    assert.equal(m.type, 'play');
    assert.ok(fitsEnds(m.tile, game.ends()).includes(m.end), level);
  }
  assert.equal(dominoesBot(game.playerView(0), 'normal', Math.random, 0, {}).tile, '6-6', 'the heaviest');
  const stuck = setup({ hands: [['1-2'], ['0-0']], line: [[5, 5]] });
  assert.equal(dominoesBot(stuck.game.playerView(0), 'hard', Math.random, 0, {}).type, 'draw');
});

test('the computer: Hard beats Easy, and Easy beats a player who leaves it to the clock', () => {
  let hard = 0;
  for (let seed = 1; seed <= 10; seed++) {
    const flip = seed % 2;
    const { view } = play('dominoes', flip ? ['easy', 'hard'] : ['hard', 'easy'], { seed });
    if (view.winner === (flip ? 1 : 0)) hard++;
  }
  assert.ok(hard >= 7, 'Hard won ' + hard + ' of 10');
  for (let seed = 1; seed <= 6; seed++) {
    const cpu = seed % 2;
    const { view } = play('dominoes', cpu ? [null, 'easy'] : ['easy', null], { seed });
    assert.equal(view.winner, cpu);
  }
});
