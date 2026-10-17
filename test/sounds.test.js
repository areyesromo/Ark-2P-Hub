// The TV renderers' sounds(prev, view) hooks, fed real views from the games.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { fakeCtx } from './helpers.js';
import { Battleship, FLEET, TIMING as BS_TIMING } from '../server/games/battleship.js';
import { QuizBattle, TIMING as QUIZ_TIMING } from '../server/games/quiz.js';
import { SketchGuess } from '../server/games/sketch-guess.js';
import { DrawDuel, TIMING as DD_TIMING } from '../server/games/draw-duel.js';
import { RockPaperScissors } from '../server/games/rock-paper-scissors.js';
import { DiceParty } from '../server/games/dice-party.js';
import { MicroMayhem } from '../server/games/micro-mayhem.js';
import { PartyMinis } from '../server/games/party-minis.js';
import { TIMING as MINI_TIMING } from '../server/games/minis/runner.js';
import { LiarsDice } from '../server/games/liars-dice.js';

/** Load public/games/<id>/host.js with a stub Ark and return what it registers. */
function renderer(id) {
  let registered = null;
  const Ark = {
    register: (kind, gameId, r) => { if (kind === 'host' && gameId === id) registered = r; },
    loadCss: () => {},
    loadScript: () => new Promise(() => {}),
    escapeHtml: String,
  };
  vm.runInNewContext(fs.readFileSync(`public/games/${id}/host.js`, 'utf8'), { Ark, window: {} });
  assert.ok(registered && registered.sounds, `${id} registers a sounds hook`);
  return registered;
}

/** Records the sounds a game's hook asks for as its views change. */
function listen(id, game) {
  const r = renderer(id);
  let prev = JSON.parse(JSON.stringify(game.hostView()));
  return () => {
    const v = JSON.parse(JSON.stringify(game.hostView()));
    const out = Array.from(r.sounds(prev, v)); // the hook runs in another realm
    prev = v;
    return out;
  };
}

test('every TV renderer has a sounds hook', () => {
  for (const id of fs.readdirSync('public/games')) {
    if (fs.existsSync(`public/games/${id}/host.js`)) renderer(id);
  }
});

test('battleship: lock-in, splash, boom, big boom', () => {
  const ctx = fakeCtx();
  const game = new Battleship(ctx);
  game.start();
  const rows = FLEET.map((f, i) => ({ x: 0, y: i * 2, dir: 'h' }));
  const heard = listen('battleship', game);
  game.onInput(0, { type: 'ready', ships: rows });
  assert.deepEqual(heard(), ['lock']);
  game.onInput(1, { type: 'ready', ships: rows });
  heard();
  game.onInput(0, { type: 'fire', x: 9, y: 9 });
  assert.deepEqual(heard(), ['splash']);
  ctx.advance(BS_TIMING.shotMs);
  game.onInput(1, { type: 'fire', x: 0, y: 8 });
  assert.deepEqual(heard(), ['boom']);
  ctx.advance(BS_TIMING.shotMs);
  game.onInput(0, { type: 'fire', x: 8, y: 9 });
  heard();
  ctx.advance(BS_TIMING.shotMs);
  game.onInput(1, { type: 'fire', x: 1, y: 8 });
  assert.deepEqual(heard(), ['bigBoom']);
});

test('quiz: a click per locked answer, then right or wrong', () => {
  const ctx = fakeCtx();
  const game = new QuizBattle(ctx);
  game.start();
  const heard = listen('quiz', game);
  ctx.advance(QUIZ_TIMING.countdownMs);
  heard();
  const correct = game.questions[game.index].correct;
  game.onInput(0, { type: 'answer', choice: correct });
  assert.deepEqual(heard(), ['lock']);
  game.onInput(1, { type: 'answer', choice: (correct + 1) % 4 });
  assert.deepEqual(heard(), ['lock', 'correct']);
  ctx.advance(QUIZ_TIMING.revealMs);
  heard();
  ctx.advance(QUIZ_TIMING.questionMs); // nobody answers
  assert.deepEqual(heard(), ['wrong']);
});

test('sketch & guess: whoosh, wrong, so close, correct', () => {
  const ctx = fakeCtx();
  const game = new SketchGuess(ctx);
  game.start();
  const heard = listen('sketch-guess', game);
  game.choices[1].word = 'giraffe';
  game.onInput(game.drawer, { type: 'choose', index: 1 });
  assert.deepEqual(heard(), ['whoosh']);
  game.onInput(game.guesser, { type: 'guess', text: 'horse' });
  assert.deepEqual(heard(), ['wrong']);
  game.onInput(game.guesser, { type: 'guess', text: 'girafe' });
  assert.deepEqual(heard(), ['close']);
  game.onInput(game.guesser, { type: 'guess', text: 'giraffe' });
  assert.deepEqual(heard(), ['correct']);
});

test('draw duel: whoosh for the shape, a click when done, a chime for the reveal', () => {
  const ctx = fakeCtx();
  const game = new DrawDuel(ctx);
  game.start();
  const heard = listen('draw-duel', game);
  ctx.advance(DD_TIMING.countdownMs);
  assert.deepEqual(heard(), ['whoosh']);
  ctx.advance(DD_TIMING.showMs);
  heard();
  game.onInput(0, { type: 'done' });
  assert.deepEqual(heard(), ['lock']);
  game.onInput(1, { type: 'done' });
  assert.deepEqual(heard(), ['lock', 'reveal']);
});

test('rock paper scissors: clicks as players lock in, a chime at the reveal', () => {
  const ctx = fakeCtx();
  const game = new RockPaperScissors(ctx);
  game.start();
  const heard = listen('rock-paper-scissors', game);
  game.onInput(0, { type: 'pick', choice: 'rock' });
  assert.deepEqual(heard(), ['lock']);
  game.onInput(1, { type: 'pick', choice: 'paper' });
  assert.ok(heard().includes('reveal'));
});

test('connect four: a clunk for each disc', async () => {
  const { ConnectFour } = await import('../server/games/connect-four.js');
  const game = new ConnectFour(fakeCtx());
  game.start();
  const heard = listen('connect-four', game);
  game.onInput(0, { type: 'drop', col: 3 });
  assert.deepEqual(heard(), ['drop']);
  assert.deepEqual(heard(), [], 'clock updates are silent');
});

test('sumo: whoosh for a dash, a crash for a fall', async () => {
  const { Sumo, TIMING } = await import('../server/games/sumo.js');
  const ctx = fakeCtx();
  const game = new Sumo(ctx);
  game.start();
  const heard = listen('sumo', game);
  ctx.advance(TIMING.countdownMs + 20);
  heard();
  game.onInput(0, { type: 'dash' });
  assert.ok(heard().includes('whoosh'));
  game.players[1].x = 100; // off the ring
  ctx.advance(20);
  assert.ok(heard().includes('crash'));
});

test('dice party: roll, hold, score', () => {
  const game = new DiceParty(fakeCtx(), () => 0.5);
  game.start();
  const heard = listen('dice-party', game);
  game.onInput(game.turn, { type: 'roll' });
  assert.deepEqual(heard(), ['drop']);
  game.onInput(game.turn, { type: 'hold', die: 0 });
  assert.deepEqual(heard(), ['lock']);
  game.onInput(game.turn, { type: 'score', box: 'fours' });
  assert.deepEqual(heard(), ['point']);
  game.onInput(game.turn, { type: 'roll' });
  heard();
  game.onInput(game.turn, { type: 'score', box: 'ones' });
  assert.deepEqual(heard(), ['wrong']);
});

test("liar's dice: bid, then the reveal", () => {
  const game = new LiarsDice(fakeCtx(), () => 0.5);
  game.start();
  const heard = listen('liars-dice', game);
  game.onInput(game.turn, { type: 'bid', qty: 2, face: 3 });
  assert.deepEqual(heard(), ['lock']);
  game.onInput(game.turn, { type: 'liar' });
  assert.deepEqual(heard(), ['reveal']);
});

/** A minigame each player wins / passes by saying so. */
const sayStub = (kind) => ({
  id: 'say', kind, name: 'Say', order: 'SAY!', howTo: 'say', durationMs: 5000,
  create(api) {
    const res = [null, null];
    return {
      start() {},
      onInput(slot, input) {
        if (kind === 'party') return api.end({ winner: slot });
        res[slot] = input.type === 'pass';
        if (res[0] !== null && res[1] !== null) api.end({ pass: res.slice() });
      },
      view: () => ({}),
    };
  },
});

test('micro mayhem: go, wrong / correct, fanfare', () => {
  const ctx = fakeCtx();
  ctx.settings = { lives: 3 };
  const game = new MicroMayhem(ctx, [sayStub('micro')]);
  game.start();
  const heard = listen('micro-mayhem', game);
  ctx.advance(MINI_TIMING.introMicroMs);
  assert.deepEqual(heard(), ['go']);
  game.onInput(0, { type: 'pass' });
  game.onInput(1, { type: 'pass' });
  assert.deepEqual(heard(), ['correct']);
  for (let i = 0; i < 3; i++) {
    ctx.advance(MINI_TIMING.resultMicroMs + MINI_TIMING.introMicroMs);
    heard();
    game.onInput(0, { type: 'pass' });
    game.onInput(1, { type: 'fail' });
    assert.deepEqual(heard(), ['wrong']);
  }
  ctx.advance(MINI_TIMING.resultMicroMs);
  assert.deepEqual(heard(), ['fanfare']);
});

test('party minigames: go, point, fanfare', () => {
  const ctx = fakeCtx();
  const game = new PartyMinis(ctx, [sayStub('party')]);
  game.start();
  const heard = listen('party-minis', game);
  for (let i = 0; i < 3; i++) {
    game.onInput(0, { type: 'ready' });
    game.onInput(1, { type: 'ready' });
    assert.deepEqual(heard(), ['go']);
    game.onInput(1, { type: 'win' });
    assert.deepEqual(heard(), ['point']);
    ctx.advance(MINI_TIMING.resultPartyMs);
  }
  assert.deepEqual(heard(), ['fanfare']);
});
