// Games that pick up after a restart (RESUMES in server/games/index.js): each one, played partway,
// saved at a calm moment, through the save file's own format, and put back on a new instance, is
// the same game (the TV's and both phones' views), and plays on to the end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import v8 from 'node:v8';
import { getGame, RESUMES } from '../server/games/index.js';
import { stateOf, restoreState } from '../server/saves.js';
import { fakeCtx } from './helpers.js';
import { seeded } from './helpers-bots.js';

/** The computer in both seats, each move as it comes (no reaction time), until `until` says stop. */
function playOn(def, g, ctx, rng, memory, until) {
  for (let t = 0; t < 30 * 60 * 1000; t += 50) {
    if (until()) return true;
    for (const slot of [0, 1]) {
      const view = g.botView ? g.botView(slot) : g.playerView(slot);
      const move = def.bot(view, slot ? 'easy' : 'hard', rng, 0, memory[slot]);
      if (move) {
        const { botDelayMs, botAnticipate, botFor, ...input } = move;
        g.onInput(slot, input);
      }
    }
    ctx.advance(50);
  }
  return until();
}

const views = (g) => JSON.stringify([g.hostView(), g.playerView(0), g.playerView(1)]);

/** A copy of `g` as a restart brings it back: through the save file's format, onto a new instance. */
function pickedUp(def, g, ctx) {
  const saved = v8.deserialize(v8.serialize(g.snapshot ? g.snapshot() : stateOf(g)));
  const ctx2 = fakeCtx();
  ctx2.players.forEach((p, slot) => { p.local = true; p.bot = slot ? 'easy' : 'hard'; });
  ctx2.advance(ctx.now());
  const g2 = def.create(ctx2);
  if (g2.restore) g2.restore(saved, 0);
  else {
    restoreState(g2, saved);
    if (g2.resumed) g2.resumed(0);
  }
  return { g2, ctx2 };
}

for (const id of RESUMES) {
  test(id + ': saved at any point in a game, it picks up as the same game, clock and all, and plays on to the end', () => {
    const random = Math.random;
    try {
      for (const at of [20, 90, 200]) {
        Math.random = seeded(11 + at);
        const def = getGame(id);
        const ctx = fakeCtx();
        ctx.players.forEach((p, slot) => { p.local = true; p.bot = slot ? 'easy' : 'hard'; });
        const g = def.create(ctx);
        g.start();
        if (g.hostView().phase === 'setup') g.onInput(0, { type: 'go' });
        const rng = seeded(5 + at);
        const memory = [{}, {}];
        // Partway in (`at` steps of 50 ms), mid-game: a clock may well be running.
        let steps = 0;
        if (!playOn(def, g, ctx, rng, memory, () => ++steps > at || g.hostView().phase === 'over')) assert.fail(id + ': never got going');
        if (g.hostView().phase === 'over') continue; // (a quick game: nothing to save at this point)
        const { g2, ctx2 } = pickedUp(def, g, ctx);
        assert.equal(views(g2), views(g), id + ' at step ' + at + ': the same on the TV and both phones');
        assert.equal(ctx2.pendingTimers() > 0, ctx.pendingTimers() > 0, id + ' at step ' + at + ': its clock is running again if it was');
        // It plays on to the end: its clock runs again (a timed turn, a pause between rounds).
        assert.ok(playOn(def, g2, ctx2, rng, memory, () => g2.hostView().phase === 'over'), id + ' at step ' + at + ': finishes after being picked up (stuck in ' + g2.hostView().phase + ')');
      }
    } finally {
      Math.random = random;
    }
  });
}

test('a timed turn picked up after a restart keeps the time it had: the time the hub was down doesn\'t count', () => {
  const def = getGame('connect-four');
  const ctx = fakeCtx();
  const g = def.create(ctx);
  g.start();
  g.onInput(0, { type: 'setting', key: 'timer', value: 'timed' });
  g.onInput(0, { type: 'go' });
  ctx.advance(5000); // (5 s of a 20 s turn gone)
  const left = g.game.turnEnds - ctx.now();
  assert.ok(left > 0 && left < 20000, 'a timed turn under way: ' + left);
  const saved = v8.deserialize(v8.serialize(g.snapshot()));
  const ctx2 = fakeCtx();
  ctx2.advance(ctx.now() + 60000); // back a minute later
  const g2 = def.create(ctx2);
  g2.restore(saved, 60000);
  assert.equal(g2.game.turnEnds - ctx2.now(), left, 'the same time left');
  const turn = g2.game.turn;
  ctx2.advance(left - 100);
  assert.equal(g2.game.turn, turn, 'not out of time yet');
  ctx2.advance(1500);
  assert.notEqual(g2.game.turn, turn, 'then out of time: a move is played for them');
});

test('a saved game nobody came back for is dropped after a day', async () => {
  const fs = await import('node:fs');
  const os = await import('node:os');
  const path = await import('node:path');
  const { GameSaves, SAVE_MAX_AGE_MS } = await import('../server/saves.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ark-saves-'));
  try {
    const saves = new GameSaves(dir);
    saves.save('ABCD', { hostToken: 'x', gameId: 'checkers' });
    saves.save('WXYZ', { hostToken: 'y', gameId: 'mancala' });
    assert.equal(saves.load('ABCD').gameId, 'checkers');
    assert.equal(saves.load('ABCD', Date.now() + SAVE_MAX_AGE_MS + 1), null, 'too old to pick up');
    // A hub starting a day later clears out what was left.
    new GameSaves(dir, Date.now() + SAVE_MAX_AGE_MS + 1000);
    assert.deepEqual(fs.readdirSync(path.join(dir, 'games')), []);
    assert.equal(new GameSaves(dir).file('../x'), null, 'only a room code makes a file name');
    // An unchanged game is written again every few seconds, so its time is when the hub was last up.
    const { SAVE_EVERY_MS } = await import('../server/saves.js');
    const t0 = Date.now();
    saves.save('QRST', { gameId: 'mancala' }, t0);
    saves.save('QRST', { gameId: 'mancala' }, t0 + 1000);
    assert.equal(saves.load('QRST', t0 + 2000).savedAt, t0, 'not again a second later');
    saves.save('QRST', { gameId: 'mancala' }, t0 + SAVE_EVERY_MS + 1);
    assert.equal(saves.load('QRST', t0 + SAVE_EVERY_MS + 2).savedAt, t0 + SAVE_EVERY_MS + 1, 'again a few seconds on');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
