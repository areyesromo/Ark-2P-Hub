import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fakeCtx } from './helpers-solo.js';
import { Peg, BOARDS, ORDER, parseBoard, jumpsOf, legal, solve } from '../server/solo/games/peg.js';

function game(board = 'english') {
  const ctx = fakeCtx('Ana', { board });
  const g = new Peg(ctx);
  g.start();
  return { ctx, g };
}

test('the boards: English has 33 holes and 32 pegs, European 37 and 36; every board is in the list', () => {
  const en = parseBoard(BOARDS.english.rows);
  assert.equal(en.holes.length, 33);
  assert.equal(en.pegs.filter(Boolean).length, 32);
  assert.equal(en.pegs[24], false, 'the middle starts empty');
  const eu = parseBoard(BOARDS.european.rows);
  assert.equal(eu.holes.length, 37);
  assert.equal(eu.pegs.filter(Boolean).length, 36);
  assert.deepEqual([...ORDER].sort(), Object.keys(BOARDS).sort());
});

test('English and every warm-up solve to one peg in the middle', () => {
  for (const id of ORDER.filter((k) => k !== 'european')) {
    const { holes, pegs } = parseBoard(BOARDS[id].rows);
    const s = solve(pegs, jumpsOf(holes), true, 2e6);
    assert.ok(s.path, id);
  }
});

test('a jump: over a neighbour into an empty hole, and the jumped peg comes off; nothing else goes', () => {
  const { g } = game('english');
  // The opening jumps are into the middle from two away.
  const opening = legal(g.pegs, g.jumps).map(([a, , c]) => [a, c]);
  assert.equal(opening.length, 4);
  assert.ok(opening.every(([, c]) => c === 24));
  g.onInput({ type: 'jump', from: 0, to: 24 });
  g.onInput({ type: 'jump', from: 10, to: 30 });
  assert.equal(g.left, 32, 'not a legal jump');
  g.onInput({ type: 'jump', from: 10, to: 24 });
  assert.equal(g.left, 31);
  assert.equal(g.pegs[17], false);
  assert.equal(g.pegs[24], true);
  g.onInput({ type: 'undo' });
  assert.equal(g.left, 32);
  for (const bad of [{ type: 'jump' }, { type: 'jump', from: 'a', to: 3 }, { type: 'nope' }]) g.onInput(bad);
  assert.equal(g.left, 32);
});

test('following the hints finishes the English board perfectly; the score is the pegs left', () => {
  const { g } = game('english');
  for (let k = 0; k < 40 && g.phase === 'play'; k++) {
    g.onInput({ type: 'hint' });
    const [a, , c] = g.hint;
    g.onInput({ type: 'jump', from: a, to: c });
  }
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, 1);
  assert.equal(v.perfect, true);
  assert.equal(v.variant, 'English');
  g.onInput({ type: 'undo' });
  assert.equal(g.phase, 'play', 'undo after the end takes the last jump back');
  g.onInput({ type: 'restart' });
  assert.equal(g.left, 32);
});

test('a dead end ends the game with the pegs left; a hint from a dead end says so', () => {
  const { g } = game('cross');
  // Play the first jumps the list offers until it's stuck (not the right way).
  for (let k = 0; k < 10 && g.phase === 'play'; k++) {
    const [a, , c] = legal(g.pegs, g.jumps).at(-1);
    g.onInput({ type: 'jump', from: a, to: c });
  }
  const v = g.hostView();
  assert.equal(v.phase, 'over');
  assert.equal(v.score, v.left);
  g.onInput({ type: 'undo' });
  if (g.left > 2) {
    const before = legal(g.pegs, g.jumps).length;
    g.onInput({ type: 'hint' });
    assert.ok(g.hint || g.stuck || before === 0);
  }
  assert.equal(game('nowhere').g.boardId, 'english');
});
