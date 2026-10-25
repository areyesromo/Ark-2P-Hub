import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RallyTennis, COURT, TIMING, SHOT, WIN_GAMES } from '../server/games/rally-tennis.js';
import { fakeCtx } from './helpers.js';

function setup(rng = () => 0.3, settings) {
  const ctx = fakeCtx();
  if (settings) ctx.settings = settings;
  let game = null;
  // As the room does: every update builds every view.
  const update = ctx.update.bind(ctx);
  ctx.update = () => {
    if (game) [game.hostView(), game.playerView(0), game.playerView(1)];
    update();
  };
  game = new RallyTennis(ctx, rng);
  game.start();
  return { ctx, game };
}

/** Past the countdown, to the serve. */
const toServe = (ctx) => ctx.advance(TIMING.countdownMs + 20);

/** Waits until the ball reaches the receiver, then swings `early` ms before the ideal moment. */
function swingAt(ctx, game, early = 0, input = {}) {
  const shot = game.shot;
  const ideal = shot.tReach + TIMING.lagMs;
  ctx.advance(Math.max(0, ideal - early - ctx.now()));
  game.onInput(shot.to, { type: 'swing', ...input });
}

test('counts down, then the server serves; a serve goes when you swing, or by itself after a while', () => {
  const { ctx, game } = setup();
  assert.equal(game.phase, 'countdown');
  toServe(ctx);
  assert.equal(game.phase, 'serve');
  assert.equal(game.server, 0);
  game.onInput(1, { type: 'swing' }); // not the server: nothing
  assert.equal(game.phase, 'serve');
  game.onInput(0, { type: 'swing' });
  assert.equal(game.phase, 'rally');
  assert.equal(game.shot.by, 0);
  const b = setup();
  toServe(b.ctx);
  b.ctx.advance(TIMING.serveMs + 50);
  assert.equal(b.game.phase, 'rally', 'served by itself');
});

test('views are pushed about 30 times a second in a rally', () => {
  const { ctx, game } = setup();
  toServe(ctx);
  game.onInput(0, { type: 'swing' });
  const before = ctx.updates;
  ctx.advance(500);
  const pushed = ctx.updates - before;
  assert.ok(pushed >= 13 && pushed <= 17, `pushed ${pushed}`);
});

test('a serve lands in the rival\'s half, in court, and the receiver runs to meet it', () => {
  const { ctx, game } = setup();
  toServe(ctx);
  game.onInput(0, { type: 'aim', dir: 1 });
  game.onInput(0, { type: 'swing' });
  const s = game.shot;
  assert.ok(s.land.y > COURT.net && s.land.y < COURT.l);
  assert.ok(s.land.x >= 0 && s.land.x <= COURT.w && !s.out);
  assert.ok(s.land.x > COURT.w / 2, 'aimed right');
  ctx.advance(s.tReach - ctx.now());
  assert.ok(Math.abs(game.players[1].x - s.at.x) <= SHOT.reach, 'got there');
});

test('swing as it reaches you and it goes back; miss it and the point is theirs', () => {
  const { ctx, game } = setup();
  toServe(ctx);
  game.onInput(0, { type: 'swing' });
  swingAt(ctx, game, 0);
  assert.equal(game.shot.by, 1, 'returned');
  // Now player 1 lets it go by: the point is player 2's.
  ctx.advance(game.shot.tReach + TIMING.lagMs + TIMING.windowMs + 50 - ctx.now());
  assert.equal(game.phase, 'point');
  assert.deepEqual(game.points, [0, 1]);
});

test('spot-on timing hits faster and deeper than a scrappy one', () => {
  const flight = (early) => {
    const { ctx, game } = setup();
    toServe(ctx);
    game.onInput(0, { type: 'swing' });
    swingAt(ctx, game, early);
    const s = game.shot;
    return { time: s.tReach - s.t0, depth: COURT.net - s.land.y, kind: s.kind };
  };
  const perfect = flight(0);
  const scrappy = flight(TIMING.windowMs * 0.9);
  assert.equal(perfect.kind, 'perfect');
  assert.equal(scrappy.kind, 'weak');
  assert.ok(perfect.time < scrappy.time);
  assert.ok(perfect.depth > scrappy.depth);
});

test('early pulls it left, late pushes it right; aimed wide and mistimed, it goes out', () => {
  const landX = (early, dir = 0) => {
    const { ctx, game } = setup();
    toServe(ctx);
    game.onInput(0, { type: 'swing' });
    game.onInput(1, { type: 'aim', dir });
    swingAt(ctx, game, early);
    return game.shot;
  };
  assert.ok(landX(150).land.x < landX(-150).land.x);
  const wide = landX(-TIMING.windowMs * 0.95, 1);
  assert.equal(wide.out, true);
  assert.equal(landX(0, 1).out, false, 'aimed wide but on time: in');
});

test('an out ball is the other player\'s point when it lands', () => {
  const { ctx, game } = setup();
  toServe(ctx);
  game.onInput(0, { type: 'swing' });
  game.onInput(1, { type: 'aim', dir: 1 });
  swingAt(ctx, game, -TIMING.windowMs * 0.95);
  assert.equal(game.shot.out, true);
  ctx.advance(game.shot.tLand - ctx.now() + 20);
  assert.equal(game.phase, 'point');
  assert.deepEqual(game.points, [1, 0]);
  assert.equal(game.hostView().last.reason, 'out');
});

test('one swing per ball: swing too early and that ball is gone, however much you mash', () => {
  const { ctx, game } = setup();
  toServe(ctx);
  game.onInput(0, { type: 'swing' });
  const shot = game.shot;
  const ideal = shot.tReach + TIMING.lagMs;
  ctx.advance(ideal - TIMING.windowMs - 50 - ctx.now());
  game.onInput(1, { type: 'swing' }); // too early: a whiff
  for (let t = ideal - TIMING.windowMs; t < ideal + TIMING.windowMs; t += 50) {
    ctx.advance(t - ctx.now());
    game.onInput(1, { type: 'swing' });
  }
  assert.equal(game.shot, shot, 'never returned');
  ctx.advance(200);
  assert.deepEqual(game.points, [1, 0]);
});

test('the window\'s edges: spot on within ' + TIMING.perfectMs + ' ms, a hit within ' + TIMING.windowMs + ' ms, late after that', () => {
  const kind = (late) => {
    const { ctx, game } = setup();
    toServe(ctx);
    game.onInput(0, { type: 'swing' });
    swingAt(ctx, game, -late);
    return game.shot.by === 1 ? game.shot.kind : 'missed';
  };
  assert.equal(kind(TIMING.perfectMs), 'perfect');
  assert.equal(kind(TIMING.perfectMs + 1), 'good');
  assert.equal(kind(TIMING.windowMs), 'weak');
  assert.equal(kind(TIMING.windowMs + 1), 'missed');
});

test('swings that don\'t count: at an out ball, after the point', () => {
  const { ctx, game } = setup();
  toServe(ctx);
  game.onInput(0, { type: 'swing' });
  game.onInput(1, { type: 'aim', dir: 1 });
  swingAt(ctx, game, -TIMING.windowMs * 0.95); // out
  const out = game.shot;
  assert.equal(out.out, true);
  game.onInput(0, { type: 'swing' }); // at an out ball: nothing
  assert.equal(game.shot, out);
  ctx.advance(out.tLand - ctx.now() + 20);
  assert.equal(game.phase, 'point');
  game.onInput(0, { type: 'swing' });
  game.onInput(1, { type: 'swing' });
  assert.equal(game.phase, 'point');
  assert.deepEqual(game.points, [1, 0]);
});

test('no shot goes where nobody could reach it', () => {
  const { ctx, game } = setup();
  toServe(ctx);
  game.phase = 'rally';
  game.players[0].x = 9.5; // as far out as you can run
  game.aims[0] = -1;
  game.hit(0, -0.75 * TIMING.windowMs, false); // weak, across to the far side
  assert.equal(game.shot.out, false);
  assert.ok(game.shot.at.x >= -1.5, String(game.shot.at.x));
});

test('the result is recorded with the games as its score', () => {
  const { game } = setup(() => 0.3, { wins: 1 });
  for (let p = 0; p < 4; p++) game.award(0, 'test');
  assert.equal(game.phase, 'over');
  assert.deepEqual(game.hostView().scores, [1, 0]);
});

test('out of reach: the swing whiffs and the point goes to the hitter', () => {
  const { ctx, game } = setup();
  toServe(ctx);
  game.onInput(0, { type: 'aim', dir: 1 });
  game.onInput(0, { type: 'swing' });
  game.players[1].x = -1.5; // far out on the other side: too far to run
  swingAt(ctx, game, 0);
  assert.equal(game.shot.by, 0);
  ctx.advance(TIMING.windowMs + 50);
  assert.deepEqual(game.points, [1, 0]);
});

test('both sides play alike: a mirrored rally gives mirrored shots', () => {
  const rally = (server) => {
    const { ctx, game } = setup();
    game.server = server;
    toServe(ctx);
    game.onInput(server, { type: 'swing' });
    swingAt(ctx, game, 40);
    const s = game.shot;
    return { t: s.tReach - s.t0, x: server === 0 ? s.land.x : COURT.w - s.land.x, y: server === 0 ? s.land.y : COURT.l - s.land.y };
  };
  const a = rally(0);
  const b = rally(1);
  assert.ok(Math.abs(a.t - b.t) < 1e-6 && Math.abs(a.y - b.y) < 1e-9);
  // ◀ ▶ and early / late are the TV's left and right for both players.
  assert.ok(Math.abs(a.x - (COURT.w - b.x)) < 1e-9, 'x measured from each player\'s own left on the TV is the same');
});

test('tennis scoring: 15, 30, 40, deuce, advantage, game; the serve changes each game', () => {
  const { game } = setup();
  const label = () => game.hostView().score;
  const win = (slot) => game.award(slot, 'test');
  win(0);
  assert.equal(label(), '15 – 0');
  assert.deepEqual(game.hostView().calls, ['15', '0'], 'each player\'s own call');
  assert.deepEqual(game.playerView(1).calls, ['15', '0']);
  win(0); win(0);
  assert.equal(label(), '40 – 0');
  win(1); win(1); win(1);
  assert.equal(label(), 'Deuce');
  win(1);
  assert.match(label(), /Advantage/);
  assert.deepEqual(game.hostView().calls, ['40', 'Ad']);
  win(0);
  assert.equal(label(), 'Deuce');
  win(0); win(0);
  assert.deepEqual(game.games, [1, 0]);
  assert.deepEqual(game.points, [0, 0]);
  assert.equal(game.server, 1);
});

test('first to the setting\'s games wins the match; then rematch', () => {
  const { ctx, game } = setup(() => 0.3, { wins: 3 });
  assert.equal(game.winGames, 3);
  for (let g = 0; g < 3; g++) for (let p = 0; p < 4; p++) game.award(1, 'test');
  assert.equal(game.phase, 'over');
  assert.equal(game.winner, 1);
  const updates = ctx.updates;
  ctx.advance(3000);
  assert.equal(ctx.updates, updates, 'nothing runs after the end');
  assert.equal(ctx.pendingTimers(), 0);
  game.onInput(0, { type: 'rematch' });
  assert.equal(game.phase, 'countdown');
  assert.deepEqual(game.games, [0, 0]);
});

test('bad input is ignored; the default is first to ' + WIN_GAMES + ' games', () => {
  const { ctx, game } = setup();
  assert.equal(game.winGames, WIN_GAMES);
  toServe(ctx);
  for (const bad of [{ type: 'aim', dir: 2 }, { type: 'aim', dir: '1' }, { type: 'aim' }, { type: 'warp' }]) game.onInput(0, bad);
  assert.equal(game.aims[0], 0);
  game.onInput(2, { type: 'swing' });
  game.onInput(-1, { type: 'swing' });
  assert.equal(game.phase, 'serve');
});

test('the phone view has the score and whether it\'s your shot, not the ball', () => {
  const { ctx, game } = setup();
  toServe(ctx);
  assert.equal(game.playerView(0).yourServe, true);
  assert.equal(game.playerView(1).yourServe, false);
  assert.equal(game.playerView(0).ball, undefined);
});
