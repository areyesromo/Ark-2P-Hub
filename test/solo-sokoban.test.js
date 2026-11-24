import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers-solo.js';
import { Sokoban, parse } from '../server/solo/games/sokoban.js';
import { LEVELS } from '../server/solo/games/sokoban-levels.js';
import { SOLO_GAMES } from '../server/solo/games/index.js';
import { lockedFor } from '../server/solo/games/options.js';

const getGame = (id) => SOLO_GAMES.find((g) => g.id === id) || null;

const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** The fewest moves that solve a level, by a plain search over (worker, boxes). */
function solve(text) {
  const L = parse(text);
  const walls = new Set(L.walls);
  const targets = new Set(L.targets);
  const w = L.w;
  // A box pushed into a corner that isn't a target can never come out.
  const dead = (i) => !targets.has(i) && (walls.has(i - 1) || walls.has(i + 1)) && (walls.has(i - w) || walls.has(i + w));
  const key = (p, b) => p + '|' + b.slice().sort((x, y) => x - y).join(',');
  let level = [{ p: L.worker, b: L.boxes }];
  const seen = new Set([key(L.worker, L.boxes)]);
  for (let moves = 0; level.length; moves++) {
    const next = [];
    for (const s of level) {
      if (s.b.every((x) => targets.has(x))) return { moves, path: s.path || [] };
      for (const [dir, [dx, dy]] of Object.entries(DIRS)) {
        const d = dx + dy * w;
        const np = s.p + d;
        if (walls.has(np)) continue;
        let nb = s.b;
        const bi = s.b.indexOf(np);
        if (bi !== -1) {
          const t = np + d;
          if (walls.has(t) || s.b.includes(t) || dead(t)) continue;
          nb = s.b.slice();
          nb[bi] = t;
        }
        const k = key(np, nb);
        if (seen.has(k)) continue;
        seen.add(k);
        next.push({ p: np, b: nb, path: (s.path || []).concat(dir) });
      }
    }
    level = next;
  }
  return null;
}

function game(level = 1) {
  const ctx = fakeCtx('Ana', { level });
  const g = new Sokoban(ctx);
  g.start();
  return { ctx, g };
}

test('every level has as many boxes as targets, and solves in exactly its par', () => {
  for (const [i, L] of LEVELS.entries()) {
    const p = parse(L.map);
    assert.equal(p.boxes.length, p.targets.length, `level ${i + 1}`);
    assert.equal(solve(L.map).moves, L.par, `level ${i + 1}`);
  }
});

test('playing the solution solves it, with the moves as the score', () => {
  const { ctx, g } = game(4);
  ctx.advance(60000);
  for (const dir of solve(LEVELS[3].map).path) g.onInput({ type: 'move', dir });
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, LEVELS[3].par);
  assert.equal(v.variant, 'Level 4');
  g.onInput({ type: 'rematch' });
  assert.equal(g.phase, 'play');
  assert.equal(g.moves, 0);
});

test('walls and a second box stop a push; undo takes back moves and pushes', () => {
  const { g } = game(1); // #@$.#
  g.onInput({ type: 'move', dir: 'left' }); // wall
  g.onInput({ type: 'move', dir: 'up' });
  assert.equal(g.moves, 0);
  g.boxes = [g.worker + 1];
  g.level.targets = [g.worker + 3]; // so one push doesn't finish it
  g.onInput({ type: 'move', dir: 'right' });
  assert.equal(g.pushes, 1);
  g.onInput({ type: 'undo' });
  assert.equal(g.moves, 0);
  assert.equal(g.pushes, 0);
  assert.deepEqual(g.boxes, [g.worker + 1]);
  g.onInput({ type: 'undo' }); // nothing left to undo
  assert.equal(g.moves, 0);
});

test('restart puts the level back; bad input is ignored', () => {
  const { g } = game(2);
  g.onInput({ type: 'move', dir: 'up' });
  g.onInput({ type: 'restart' });
  assert.equal(g.worker, g.level.worker);
  assert.equal(g.moves, 0);
  assert.equal(g.restarts, 1);
  for (const input of [{ type: 'move', dir: 'north' }, { type: 'move', dir: 'toString' }, { type: 'zap' }]) g.onInput(input);
  assert.equal(g.moves, 0);
  assert.equal(new Sokoban(fakeCtx('Ana', { level: 99 })).levelNo, 1);
});

test('levels open one at a time: each once the one before is solved', () => {
  const def = getGame('sokoban');
  const ctx = fakeCtx();
  const solved = new Set();
  ctx.best = (variant) => (solved.has(variant) ? 10 : null);
  assert.deepEqual(Object.keys(lockedFor(ctx, def.spec).level).map(Number), LEVELS.map((_, i) => i + 1).slice(1));
  solved.add('Level 1');
  solved.add('Level 2');
  const locked = lockedFor(ctx, def.spec).level;
  assert.equal(locked[2], undefined);
  assert.equal(locked[3], undefined);
  assert.match(locked[4], /level 3/);
});
