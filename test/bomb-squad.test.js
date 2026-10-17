import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BombSquad, LEVELS, TIMING, MAX_STRIKES } from '../server/games/bomb-squad.js';
import {
  makeRulebook, manualOf, wireAnswer, buttonAction, clockText, symbolOrder, simonPress, mazeRoute, mazeBlocked,
  switchTarget, makeModules, makeEdgework, MODULE_TYPES, WIRE_COLORS, BUTTON_COLORS, BUTTON_LABELS, MAZE_SIZE,
  HOLD_MS, WHEEL_SIZE,
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

/** A live Expert bomb that has all of `types` (trying seeds in turn). */
function liveWith(types) {
  for (let seed = 1; ; seed++) {
    const g = live({ level: 4 }, seed);
    if (types.every((t) => g.game.bomb.modules.some((m) => m.type === t))) return g;
  }
}

/** Defuse one module the right way, as a player following the manual would. */
function solveModule(game, ctx, i) {
  const m = game.bomb.modules[i];
  const d = game.defuser;
  const { edge, rules } = game.bomb;
  if (m.type === 'wires') return game.onInput(d, { type: 'cut', module: i, wire: wireAnswer(rules, m.wires, edge) });
  if (m.type === 'button') {
    game.onInput(d, { type: 'press', module: i });
    if (buttonAction(rules, m, edge) === 'tap') return game.onInput(d, { type: 'release', module: i });
    // Hold until the timer shows the strip's digit.
    ctx.advance(HOLD_MS);
    const digit = String(rules.strip[m.strip]);
    while (!clockText(game.timeLeft()).includes(digit)) ctx.advance(250);
    return game.onInput(d, { type: 'release', module: i });
  }
  if (m.type === 'symbols') {
    for (const k of symbolOrder(rules, m.symbols)) game.onInput(d, { type: 'symbol', module: i, index: k });
    return;
  }
  if (m.type === 'simon') {
    while (!m.solved) {
      const stage = m.stage; // (it moves on as the last colour of the stage goes in)
      for (let k = 0; k < stage; k++) game.onInput(d, { type: 'simon', module: i, color: simonPress(rules, edge, game.bomb.strikes, m.sequence[k]) });
    }
    return;
  }
  if (m.type === 'maze') {
    for (const dir of mazeRoute(rules.mazes[m.index], m.at, m.goal)) game.onInput(d, { type: 'move', module: i, dir });
    return;
  }
  if (m.type === 'switches') {
    switchTarget(rules, m.lights).forEach((up, k) => { if (m.up[k] !== up) game.onInput(d, { type: 'flip', module: i, switch: k }); });
    return game.onInput(d, { type: 'check', module: i });
  }
  for (let w = 0; w < m.wheels.length; w++) {
    while (m.wheels[w][m.at[w]] !== m.word[w]) game.onInput(d, { type: 'spin', module: i, wheel: w, dir: 1 });
  }
  game.onInput(d, { type: 'submit', module: i });
}

// ---- reading the manual like a player does: from its sentences only ----

const EDGE = {
  'the serial number ends in an odd digit': (e) => Number(e.serial.at(-1)) % 2 === 1,
  'the serial number ends in an even digit': (e) => Number(e.serial.at(-1)) % 2 === 0,
  'there are 2 or more batteries': (e) => e.batteries >= 2,
  'there are no batteries': (e) => e.batteries === 0,
  'the serial number has a vowel (A E I O U)': (e) => /[AEIOU]/.test(e.serial),
};
const ORD = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];

/** Split "If X, Y." / "Otherwise, if X, Y." / "Otherwise, Y." into [X or null, Y]. */
function parseRule(text) {
  const m = text.match(/^(?:If|Otherwise, if) (.+), ([^,]+)\.$/) || text.match(/^Otherwise, ([^,]+)\.$/);
  assert.ok(m, 'readable rule: ' + text);
  return m.length === 3 ? [m[1], m[2]] : [null, m[1]];
}

/** Test an "A and B" condition, where A may be about the edgework. */
function withEdge(cond, e, rest) {
  for (const k of Object.keys(EDGE)) if (cond.startsWith(k + ' and ')) return EDGE[k](e) && rest(cond.slice(k.length + 5));
  return rest(cond);
}

function readWires(rules, w, e) {
  const n = (c) => w.filter((x) => x === c).length;
  for (const text of rules) {
    const [cond, act] = parseRule(text);
    const holds = cond === null || withEdge(cond, e, (c) => {
      let m;
      if ((m = c.match(/^there are no (\w+) wires$/))) return n(m[1]) === 0;
      if ((m = c.match(/^there is more than one (\w+) wire$/))) return n(m[1]) > 1;
      if ((m = c.match(/^there is exactly one (\w+) wire$/))) return n(m[1]) === 1;
      if ((m = c.match(/^the first wire is (\w+)$/))) return w[0] === m[1];
      if ((m = c.match(/^the last wire is (\w+)$/))) return w.at(-1) === m[1];
      if ((m = c.match(/^there are more (\w+) wires than (\w+) wires$/))) return n(m[1]) > n(m[2]);
      throw new Error('unknown wire condition: ' + c);
    });
    if (!holds) continue;
    let m;
    if (act === 'cut the last wire') return w.length - 1;
    if ((m = act.match(/^cut the (\w+) wire$/)) && ORD.includes(m[1])) return ORD.indexOf(m[1]);
    if ((m = act.match(/^cut the last (\w+) wire$/))) return w.lastIndexOf(m[1]);
    if ((m = act.match(/^cut the first (\w+) wire$/))) return w.indexOf(m[1]);
    if ((m = act.match(/^cut the (\w+) wire$/))) return w.indexOf(m[1]);
    throw new Error('unknown wire action: ' + act);
  }
  throw new Error('no rule applied');
}

function readButton(rules, b, e) {
  for (const text of rules) {
    const [cond, act] = parseRule(text);
    const holds = cond === null || withEdge(cond, e, (c) => {
      let m;
      if ((m = c.match(/^the button is (\w+) and says (\w+)$/))) return b.color === m[1] && b.label === m[2];
      if ((m = c.match(/^the button is (\w+)$/))) return b.color === m[1];
      if ((m = c.match(/^the button says (\w+)$/))) return b.label === m[1];
      throw new Error('unknown button condition: ' + c);
    });
    if (holds) return act.split(' ')[0];
  }
  throw new Error('no rule applied');
}

test('every bomb deals a new rulebook, and the manual\'s sentences say exactly what the bomb checks', () => {
  const rng = seeded(7);
  const editions = new Set();
  const wireTexts = new Set();
  for (let k = 0; k < 300; k++) {
    const rb = makeRulebook(rng);
    editions.add(rb.edition);
    const man = manualOf(rb, MODULE_TYPES);
    wireTexts.add(man.wires[4].join('|'));
    for (let t = 0; t < 10; t++) {
      const e = makeEdgework(rng);
      const w = Array.from({ length: 3 + (t % 4) }, () => WIRE_COLORS[Math.floor(rng() * 5)]);
      const cut = wireAnswer(rb, w, e);
      assert.ok(cut >= 0 && cut < w.length, 'cuts a wire that exists');
      assert.equal(readWires(man.wires[w.length], w, e), cut, man.wires[w.length].join(' / ') + ' on ' + w.join(','));
      const b = { color: BUTTON_COLORS[t % 4], label: BUTTON_LABELS[Math.floor(rng() * 4)] };
      assert.equal(readButton(man.button.rules, b, e), buttonAction(rb, b, e));
    }
    assert.deepEqual(Object.values(man.button.strip).sort(), [...new Set(Object.values(man.button.strip))].sort(), 'strip digits differ');
  }
  assert.ok(editions.size > 250, 'editions vary');
  assert.ok(wireTexts.size > 250, 'the wire rules change from bomb to bomb');
  assert.equal(clockText(65000), '1:05');
  assert.equal(clockText(64001), '1:05', 'whole seconds, counting up');
});

test('every puzzle has exactly one answer: symbols, passwords, mazes; switches never start solved', () => {
  const rng = seeded(9);
  for (let k = 0; k < 150; k++) {
    const rb = makeRulebook(rng);
    rb.symbols.forEach((c) => assert.equal(new Set(c).size, 7));
    const markers = rb.mazes.flatMap((m) => m.markers.map((p) => p.join(',')));
    assert.equal(new Set(markers).size, markers.length, 'markers pick out one maze');
    for (const m of makeModules(rb, 7, rng)) {
      if (m.type === 'symbols') {
        assert.equal(rb.symbols.filter((c) => m.symbols.every((s) => c.includes(s))).length, 1);
        assert.deepEqual([...symbolOrder(rb, m.symbols)].sort(), [0, 1, 2, 3]);
      }
      if (m.type === 'password') {
        assert.equal(rb.passwords.filter((p) => [...p].every((ch, i) => m.wheels[i].includes(ch))).length, 1);
        assert.ok(m.wheels.every((w) => w.length === WHEEL_SIZE));
      }
      if (m.type === 'maze') {
        const route = mazeRoute(rb.mazes[m.index], m.at, m.goal);
        assert.ok(route.length >= 5);
        assert.ok(m.at.every((v) => v >= 0 && v < MAZE_SIZE));
      }
      if (m.type === 'switches') assert.ok(m.up.some((u, i) => u !== switchTarget(rb, m.lights)[i]));
      if (m.type === 'simon') assert.ok(m.sequence.length >= 3 && m.sequence.length <= 4);
    }
  }
});

test('roles: the defuser sees the bomb, the expert this bomb\'s manual; nobody sees the answers', () => {
  const { game } = live({ level: 4 });
  const d = game.defuser;
  const dv = game.playerView(d);
  const ev = game.playerView(1 - d);
  assert.equal(dv.role, 'defuser');
  assert.equal(ev.role, 'expert');
  assert.ok(dv.bomb && !dv.manual);
  assert.ok(ev.manual && !ev.bomb);
  assert.equal(dv.bomb.modules.length, LEVELS[4].modules);
  assert.equal(dv.bomb.edition, ev.manual.edition, 'both see which edition it is');
  for (const m of dv.bomb.modules) assert.ok(ev.manual[m.type], 'the manual has a page for ' + m.type);
  const tv = JSON.stringify(game.hostView());
  assert.ok(!tv.includes(game.bomb.edge.serial), 'the TV does not show the bomb');
  const face = JSON.stringify(dv);
  assert.ok(!face.includes('"word"') && !face.includes('"right"') && !face.includes('"sequence"'), 'no answers or maze walls on the bomb');
  const btn = dv.bomb.modules.find((m) => m.type === 'button');
  if (btn) assert.equal(btn.strip, null, 'the strip only lights while holding');
});

test('defusing every module in time earns stars; roles swap and the rules change each bomb; the match ends after the last bomb', () => {
  const { ctx, game } = live({ level: 4, bombs: 3 }, 3);
  const first = game.defuser;
  const edition = game.bomb.rules.edition;
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
  assert.notEqual(game.bomb.rules.edition, edition, 'a new rulebook');
  // Bomb 2: let the timer run out.
  ctx.advance(LEVELS[4].ms + 1);
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

test('every module type, many bombs: following the manual always defuses it', () => {
  for (let seed = 1; seed <= 40; seed++) {
    const { ctx, game } = live({ level: 4 }, seed);
    game.bomb.modules.forEach((_, i) => solveModule(game, ctx, i));
    assert.equal(game.result.defused, true, 'seed ' + seed);
    assert.equal(game.result.strikes, 0, 'seed ' + seed);
  }
});

test('mistakes are strikes; three strikes and it goes off', () => {
  const { game } = liveWith(['maze', 'switches', 'simon']);
  const d = game.defuser;
  const find = (t) => game.bomb.modules.findIndex((m) => m.type === t);
  const { rules, edge } = game.bomb;
  // A wall in the maze.
  const mi = find('maze');
  const mz = game.bomb.modules[mi];
  const blocked = ['up', 'down', 'left', 'right'].find((dir) => mazeBlocked(rules.mazes[mz.index], mz.at[0], mz.at[1], dir));
  const at = mz.at.slice();
  game.onInput(d, { type: 'move', module: mi, dir: blocked });
  assert.equal(game.bomb.strikes, 1, 'bumped a wall');
  assert.deepEqual(mz.at, at, 'and stayed put');
  // Switches checked while wrong.
  const si = find('switches');
  game.onInput(d, { type: 'check', module: si });
  assert.equal(game.bomb.strikes, 2);
  // Simon: a wrong colour.
  const ci = find('simon');
  const sm = game.bomb.modules[ci];
  const want = simonPress(rules, edge, game.bomb.strikes, sm.sequence[0]);
  game.onInput(d, { type: 'simon', module: ci, color: ['red', 'blue', 'green', 'yellow'].find((c) => c !== want) });
  assert.equal(game.phase, 'result');
  assert.deepEqual([game.result.defused, game.result.reason, game.result.strikes], [false, 'strikes', MAX_STRIKES]);
});

test('the button: holding lights the strip; the wrong kind of press is a strike', () => {
  for (let seed = 1; seed < 60; seed++) {
    const { ctx, game } = live({ level: 4 }, seed);
    const bi = game.bomb.modules.findIndex((x) => x.type === 'button');
    if (bi === -1) continue;
    const d = game.defuser;
    const b = game.bomb.modules[bi];
    game.onInput(d, { type: 'press', module: bi });
    if (buttonAction(game.bomb.rules, b, game.bomb.edge) === 'hold') game.onInput(d, { type: 'release', module: bi });
    else {
      ctx.advance(HOLD_MS + 5);
      assert.equal(game.playerView(d).bomb.modules[bi].strip, b.strip, 'holding lights the strip');
      game.onInput(d, { type: 'release', module: bi });
    }
    assert.equal(game.bomb.strikes, 1);
    return;
  }
  assert.fail('no bomb with a button');
});

test('a wrong symbol is a strike but keeps your progress; Simon starts the stage again; a wrong password is a strike', () => {
  const { game } = liveWith(['symbols', 'simon', 'password']);
  const d = game.defuser;
  const { rules, edge } = game.bomb;
  const si = game.bomb.modules.findIndex((m) => m.type === 'symbols');
  const order = symbolOrder(rules, game.bomb.modules[si].symbols);
  game.onInput(d, { type: 'symbol', module: si, index: order[0] });
  game.onInput(d, { type: 'symbol', module: si, index: order[2] });
  assert.equal(game.bomb.strikes, 1);
  assert.deepEqual(game.bomb.modules[si].pressed, [order[0]]);
  const ci = game.bomb.modules.findIndex((m) => m.type === 'simon');
  const sm = game.bomb.modules[ci];
  game.onInput(d, { type: 'simon', module: ci, color: simonPress(rules, edge, game.bomb.strikes, sm.sequence[0]) });
  assert.equal(sm.stage, 2, 'stage 1 done');
  game.onInput(d, { type: 'simon', module: ci, color: simonPress(rules, edge, game.bomb.strikes, sm.sequence[0]) });
  const wrong = ['red', 'blue', 'green', 'yellow'].find((c) => c !== simonPress(rules, edge, game.bomb.strikes, sm.sequence[1]));
  game.onInput(d, { type: 'simon', module: ci, color: wrong });
  assert.equal(game.bomb.strikes, 2);
  assert.deepEqual([sm.stage, sm.entered.length], [2, 0], 'same stage, from the top');
  const pi = game.bomb.modules.findIndex((m) => m.type === 'password');
  const p = game.bomb.modules[pi];
  if (p.wheels.map((w, i) => w[p.at[i]]).join('') === p.word) game.onInput(d, { type: 'spin', module: pi, wheel: 0, dir: -1 });
  game.onInput(d, { type: 'submit', module: pi });
  assert.equal(game.phase, 'result', 'third strike');
});

test('controller players: the game asks for two phones', () => {
  const ctx = fakeCtx();
  ctx.players[1].local = true;
  const game = new BombSquad(ctx, seeded(1));
  game.start();
  assert.equal(game.phase, 'needPhones');
  assert.equal(ctx.pendingTimers(), 0);
});
