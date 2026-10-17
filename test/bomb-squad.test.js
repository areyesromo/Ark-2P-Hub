import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BombSquad, LEVELS, TIMING, MAX_STRIKES } from '../server/games/bomb-squad.js';
import {
  WIRE_RULES, wireAnswer, buttonAction, clockText, symbolOrder, SYMBOL_COLUMNS, PASSWORDS, STRIP_DIGITS,
  makeModules, makeEdgework, passwordShown, HOLD_MS, WHEEL_SIZE,
} from '../server/games/bomb-squad-modules.js';
import { fakeCtx } from './helpers.js';

/** A small seeded random number generator, so bombs are repeatable. */
function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

/** A game on its first live bomb. */
function live(settings = {}, seed = 1, names) {
  const ctx = fakeCtx(names);
  ctx.settings = settings;
  const game = new BombSquad(ctx, seeded(seed));
  game.start();
  ctx.advance(TIMING.briefMs + 1);
  assert.equal(game.phase, 'live');
  return { ctx, game };
}

/** Defuse one module the right way, as a player following the manual would. */
function solveModule(game, ctx, i) {
  const m = game.bomb.modules[i];
  const d = game.defuser;
  const edge = game.bomb.edge;
  if (m.type === 'wires') return game.onInput(d, { type: 'cut', module: i, wire: wireAnswer(m.wires, edge) });
  if (m.type === 'button') {
    game.onInput(d, { type: 'press', module: i });
    if (buttonAction(m, edge) === 'tap') return game.onInput(d, { type: 'release', module: i });
    // Hold until the timer shows the strip's digit.
    ctx.advance(HOLD_MS);
    const digit = String(STRIP_DIGITS[m.strip]);
    while (!clockText(game.timeLeft()).includes(digit)) ctx.advance(250);
    return game.onInput(d, { type: 'release', module: i });
  }
  if (m.type === 'symbols') {
    for (const k of symbolOrder(m.symbols)) game.onInput(d, { type: 'symbol', module: i, index: k });
    return;
  }
  for (let w = 0; w < m.wheels.length; w++) {
    while (m.wheels[w][m.at[w]] !== m.word[w]) game.onInput(d, { type: 'spin', module: i, wheel: w, dir: 1 });
  }
  game.onInput(d, { type: 'submit', module: i });
}

test('the manual: every wire count has rules ending in a catch-all; symbol and password puzzles have exactly one answer', () => {
  for (const n of [3, 4, 5, 6]) assert.equal(WIRE_RULES[n].at(-1).when([], {}), true, `${n} wires end with "otherwise"`);
  const rng = seeded(7);
  for (let k = 0; k < 300; k++) {
    const edge = makeEdgework(rng);
    assert.match(edge.serial, /^[A-Z0-9]{5}[0-9]$/);
    for (const m of makeModules(4, rng)) {
      if (m.type === 'wires') {
        const cut = wireAnswer(m.wires, edge);
        assert.ok(cut >= 0 && cut < m.wires.length, 'cuts a wire that exists');
      }
      if (m.type === 'symbols') {
        assert.equal(SYMBOL_COLUMNS.filter((c) => m.symbols.every((s) => c.includes(s))).length, 1);
        assert.deepEqual([...symbolOrder(m.symbols)].sort(), [0, 1, 2, 3]);
      }
      if (m.type === 'password') {
        assert.equal(PASSWORDS.filter((p) => [...p].every((ch, i) => m.wheels[i].includes(ch))).length, 1);
        assert.ok(m.wheels.every((w) => w.length === WHEEL_SIZE));
      }
    }
  }
  for (const col of SYMBOL_COLUMNS) assert.equal(new Set(col).size, 7, 'no repeats in a column');
  assert.equal(new Set(PASSWORDS).size, PASSWORDS.length);
  assert.equal(clockText(65000), '1:05');
  assert.equal(clockText(64001), '1:05', 'whole seconds, counting up');
});

test('some wire and button rules, by the book', () => {
  const odd = { serial: 'ABCDE3', batteries: 0 };
  const even = { serial: 'BCDFG4', batteries: 3 };
  assert.equal(wireAnswer(['red', 'red', 'white'], odd), 1, '3 wires, no blue: the second');
  assert.equal(wireAnswer(['red', 'blue', 'white'], odd), 2, '3 wires, first red: the last');
  assert.equal(wireAnswer(['yellow', 'blue', 'yellow', 'red'], even), 2, '4 wires, even serial, two yellows: last yellow');
  assert.equal(wireAnswer(['white', 'blue', 'red', 'red', 'black'], even), 3, '5 wires, batteries and white first: the fourth');
  assert.equal(wireAnswer(['red', 'blue', 'blue', 'white', 'black', 'white'], { serial: 'AXYZQ1', batteries: 0 }), 4, '6 wires, no yellow, vowel: the fifth');
  assert.equal(buttonAction({ color: 'red', label: 'ABORT' }, odd), 'tap');
  assert.equal(buttonAction({ color: 'blue', label: 'PRESS' }, even), 'tap');
  assert.equal(buttonAction({ color: 'yellow', label: 'PRESS' }, odd), 'hold');
  assert.equal(buttonAction({ color: 'white', label: 'DETONATE' }, odd), 'tap');
  assert.equal(buttonAction({ color: 'white', label: 'DETONATE' }, even), 'hold');
});

test('roles: the defuser sees the bomb, the expert the manual; nobody sees the answers', () => {
  const { game } = live({ level: 3 });
  const d = game.defuser;
  const dv = game.playerView(d);
  const ev = game.playerView(1 - d);
  assert.equal(dv.role, 'defuser');
  assert.equal(ev.role, 'expert');
  assert.ok(dv.bomb && !dv.manual);
  assert.ok(ev.manual && !ev.bomb);
  assert.equal(dv.bomb.modules.length, LEVELS[3].modules);
  const tv = JSON.stringify(game.hostView());
  assert.ok(!tv.includes(game.bomb.edge.serial), 'the TV does not show the bomb');
  const pw = game.bomb.modules.find((m) => m.type === 'password');
  assert.ok(!JSON.stringify(dv).includes('"word"'), 'the password answer stays on the server');
  assert.equal(dv.bomb.modules.find((m) => m.type === 'password').letters, passwordShown(pw).toUpperCase());
  const btn = dv.bomb.modules.find((m) => m.type === 'button');
  assert.equal(btn.strip, null, 'the strip only lights while holding');
});

test('defusing every module in time earns stars; roles swap each bomb; the match ends after the last bomb', () => {
  const { ctx, game } = live({ level: 3, bombs: 3 }, 3);
  const first = game.defuser;
  game.onInput(1 - first, { type: 'cut', module: 0, wire: 0 }); // the expert can't touch the bomb
  assert.equal(game.bomb.strikes, 0);
  game.bomb.modules.forEach((_, i) => solveModule(game, ctx, i));
  assert.equal(game.phase, 'result');
  assert.equal(game.result.defused, true);
  assert.equal(game.result.strikes, 0);
  assert.equal(game.result.stars, 3, 'quick: all three stars');
  ctx.advance(TIMING.resultMs + TIMING.briefMs + 2);
  assert.equal(game.phase, 'live');
  assert.equal(game.defuser, 1 - first, 'roles swap');
  // Bomb 2: let the timer run out.
  ctx.advance(LEVELS[3].ms + 1);
  assert.equal(game.result.defused, false);
  assert.equal(game.result.reason, 'time');
  ctx.advance(TIMING.resultMs + TIMING.briefMs + 2);
  game.bomb.modules.forEach((_, i) => solveModule(game, ctx, i));
  ctx.advance(TIMING.resultMs + 1);
  assert.equal(game.phase, 'over');
  const v = game.hostView();
  assert.equal(v.stars, 6);
  assert.equal(v.maxStars, 9);
  assert.equal(v.history.length, 3);
  assert.equal(ctx.pendingTimers(), 0);
  game.onInput(0, { type: 'rematch' });
  ctx.advance(TIMING.briefMs + 1);
  assert.equal(game.defuser, 1 - first, 'the other player starts the rematch');
});

test('mistakes are strikes; three strikes and it goes off', () => {
  const { ctx, game } = live({ level: 1 }, 5);
  const d = game.defuser;
  const wi = game.bomb.modules.findIndex((m) => m.type === 'wires');
  const m = game.bomb.modules[wi];
  const right = wireAnswer(m.wires, game.bomb.edge);
  const wrong = [...m.wires.keys()].filter((i) => i !== right);
  game.onInput(d, { type: 'cut', module: wi, wire: wrong[0] });
  assert.equal(game.bomb.strikes, 1);
  game.onInput(d, { type: 'cut', module: wi, wire: wrong[0] }); // already cut: nothing
  assert.equal(game.bomb.strikes, 1);
  const bi = game.bomb.modules.findIndex((x) => x.type === 'button');
  const b = game.bomb.modules[bi];
  // Do the opposite of what the manual says.
  game.onInput(d, { type: 'press', module: bi });
  if (buttonAction(b, game.bomb.edge) === 'hold') game.onInput(d, { type: 'release', module: bi });
  else {
    ctx.advance(HOLD_MS + 5);
    assert.equal(game.playerView(d).bomb.modules[bi].strip, b.strip, 'holding lights the strip');
    game.onInput(d, { type: 'release', module: bi });
  }
  assert.equal(game.bomb.strikes, 2);
  game.onInput(d, { type: 'cut', module: wi, wire: wrong[1] });
  assert.equal(game.phase, 'result');
  assert.deepEqual([game.result.defused, game.result.reason, game.result.strikes], [false, 'strikes', MAX_STRIKES]);
});

test('a wrong symbol is a strike but keeps your progress; a wrong password is a strike', () => {
  const { game } = live({ level: 3 }, 11);
  const d = game.defuser;
  const si = game.bomb.modules.findIndex((m) => m.type === 'symbols');
  const order = symbolOrder(game.bomb.modules[si].symbols);
  game.onInput(d, { type: 'symbol', module: si, index: order[0] });
  game.onInput(d, { type: 'symbol', module: si, index: order[2] });
  assert.equal(game.bomb.strikes, 1);
  assert.deepEqual(game.bomb.modules[si].pressed, [order[0]]);
  const pi = game.bomb.modules.findIndex((m) => m.type === 'password');
  const p = game.bomb.modules[pi];
  if (passwordShown(p) === p.word) game.onInput(d, { type: 'spin', module: pi, wheel: 0, dir: -1 });
  game.onInput(d, { type: 'submit', module: pi });
  assert.equal(game.bomb.strikes, 2);
});

test('controller players: the game asks for two phones', () => {
  const ctx = fakeCtx();
  ctx.players[1].local = true;
  const game = new BombSquad(ctx, seeded(1));
  game.start();
  assert.equal(game.phase, 'needPhones');
  assert.equal(ctx.pendingTimers(), 0);
});
