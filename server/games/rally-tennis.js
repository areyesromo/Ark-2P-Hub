// Rally Tennis: tennis seen from above, player 1 at the bottom, player 2 at the top. Your player
// runs to the ball by themselves; you choose when to swing and where to aim. Swing as the ball
// reaches you: spot on is a faster, deeper shot; a touch early pulls it left, late pushes it
// right (on the TV), and holding ◀ or ▶ aims that way too. Aim wide with a mistimed swing and it
// lands out. A swing too early is a whiff (you need a moment to get ready again); miss it, or
// be too far away, and the point goes to your rival. Tennis scoring (15, 30, 40, deuce,
// advantage); the serve changes each game; first to WIN_GAMES games wins.
//
// Every shot's flight is worked out when it's hit (where it bounces, when it reaches the far
// baseline), so judging a swing is only a matter of time. Swings get the same small allowance
// for the trip to the hub (TIMING.lagMs), whoever makes them.

import { settingOf } from './options.js';

export const WIN_GAMES = 4;
// Court in arbitrary units: x across (TV left to right), y along it, player 1's baseline at
// y = 0 and player 2's at y = l. The net is across the middle.
export const COURT = { w: 8, l: 16, net: 8 };
export const SHOT = {
  run: 3.4, // how fast a player runs to the ball, units a second
  reach: 1.1, // how far from the ball you can still hit it
  aimX: 2.6, // sideways, holding ◀ or ▶
  timingX: 1.8, // sideways, from swinging early (left) or late (right), at the edge of the window
  flight: { perfect: 0.8, good: 1.0, weak: 1.2 }, // seconds to the bounce
  depth: { perfect: 0.85, good: 0.7, weak: 0.55 }, // how deep into their half it bounces
  afterBounce: 0.85, // the ball keeps this much of its pace after the bounce
};
export const TIMING = {
  tickMs: 1000 / 60, sendEvery: 2,
  countdownMs: 3000, serveMs: 4000, pointMs: 1600,
  windowMs: 260, // a swing this far either side of the right moment still hits
  perfectMs: 80, // and this close is spot on
  lagMs: 60, // the right moment, allowing for the swing's trip to the hub
  cooldownMs: 400, // after a whiff
};

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const BASE = [0, COURT.l];
const RUN_LIMIT = [-1.5, COURT.w + 1.5]; // players can run a little way outside the lines

export class RallyTennis {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.winGames = settingOf(ctx, 'wins', WIN_GAMES);
    this.rng = rng;
    this.timer = null;
  }

  start() {
    this.points = [0, 0];
    this.games = [0, 0];
    this.server = this.rng() < 0.5 ? 0 : 1;
    this.winner = null;
    this.last = null; // the latest point: { n, winner, reason: 'winner' (not returned) | 'out' }
    this.pointsPlayed = 0;
    this.players = [0, 1].map(() => ({ x: COURT.w / 2 }));
    if (!this.aims) this.aims = [0, 0]; // held ◀ ▶ (phones and controllers only send changes)
    this.cooldown = [0, 0];
    this.shot = null;
    this.frame = 0;
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.enter('countdown', TIMING.countdownMs);
    this.lastTick = this.ctx.now();
    this.loop();
  }

  enter(phase, ms) {
    this.phase = phase;
    this.phaseEnds = ms ? this.ctx.now() + ms : null;
    this.ctx.update();
  }

  loop() {
    this.timer = this.ctx.setTimeout(() => {
      this.tick();
      if (this.phase !== 'over') this.loop();
    }, TIMING.tickMs);
  }

  tick() {
    const now = this.ctx.now();
    const dt = clamp((now - this.lastTick) / 1000, 0, 0.1);
    this.lastTick = now;
    const before = this.phase;

    if ((this.phase === 'countdown' || this.phase === 'point') && now >= this.phaseEnds) {
      this.shot = null;
      this.players.forEach((p) => { p.x = COURT.w / 2; });
      this.enter('serve', TIMING.serveMs);
    } else if (this.phase === 'serve' && now >= this.phaseEnds) {
      this.hit(this.server, 0, true); // served for you
    }

    if (this.phase === 'rally') {
      const s = this.shot;
      if (s.out && now >= s.tLand) this.award(s.to, 'out');
      else if (!s.out && now > s.tReach + TIMING.lagMs + TIMING.windowMs) this.award(s.by, 'winner');
    }
    // Players run: the one the ball is coming to towards where it will be, the other back to the middle.
    this.players.forEach((p, i) => {
      const goal = this.phase === 'rally' && this.shot.to === i && !this.shot.out ? this.shot.at.x : COURT.w / 2;
      p.x = clamp(p.x + clamp(goal - p.x, -SHOT.run * dt, SHOT.run * dt), RUN_LIMIT[0], RUN_LIMIT[1]);
    });

    this.frame++;
    if (this.phase === before && this.frame % TIMING.sendEvery === 0) this.ctx.update();
  }

  /**
   * `slot` hits the ball: `offset` is how late the swing was (ms; negative is early), `serve`
   * for a serve (always good, always in).
   */
  hit(slot, offset, serve) {
    const now = this.ctx.now();
    const t = clamp(offset / TIMING.windowMs, -1, 1);
    const kind = serve ? 'good' : Math.abs(offset) <= TIMING.perfectMs ? 'perfect' : Math.abs(t) > 0.7 ? 'weak' : 'good';
    const from = { x: this.players[slot].x, y: BASE[slot] };
    const dir = slot === 0 ? 1 : -1; // up the court for player 1, down for player 2
    let x = COURT.w / 2 + this.aims[slot] * SHOT.aimX + (serve ? 0 : t * SHOT.timingX);
    if (serve) x = clamp(x, 0.8, COURT.w - 0.8);
    const land = { x, y: COURT.net + dir * SHOT.depth[kind] * COURT.net };
    // On past the bounce to the far baseline, the same way.
    const to = 1 - slot;
    const along = (BASE[to] - land.y) / (land.y - from.y);
    const at = { x: land.x + (land.x - from.x) * along, y: BASE[to] };
    const flight = SHOT.flight[kind] * 1000;
    const speed = Math.hypot(land.x - from.x, land.y - from.y) / flight;
    const tReach = now + flight + Math.hypot(at.x - land.x, at.y - land.y) / (speed * SHOT.afterBounce);
    this.shot = { by: slot, to, kind, from, land, at, t0: now, tLand: now + flight, tReach, out: land.x < 0 || land.x > COURT.w, serve: Boolean(serve) };
    if (this.phase !== 'rally') this.enter('rally');
  }

  /** The point to `slot`; then the next point, game or the end. */
  award(slot, reason) {
    this.points[slot]++;
    this.last = { n: ++this.pointsPlayed, winner: slot, reason };
    const [a, b] = this.points;
    const lead = Math.abs(a - b);
    if (Math.max(a, b) >= 4 && lead >= 2) {
      this.games[slot]++;
      this.points = [0, 0];
      this.server = 1 - this.server;
      if (this.games[slot] >= this.winGames) {
        this.winner = slot;
        if (this.timer) this.ctx.clearTimeout(this.timer);
        this.timer = null;
        this.enter('over');
        return;
      }
    }
    this.enter('point', TIMING.pointMs);
  }

  /** The score of the game in play, as a tennis umpire would call it. */
  scoreLabel() {
    const [a, b] = this.points;
    if (a >= 3 && b >= 3) {
      if (a === b) return 'Deuce';
      return 'Advantage ' + (this.ctx.players[a > b ? 0 : 1] || {}).name;
    }
    const call = ['0', '15', '30', '40'];
    return call[a] + ' – ' + call[b];
  }

  /** Each player's call in the game in play: '0', '15', '30', '40' or 'Ad'. */
  calls() {
    const [a, b] = this.points;
    if (a >= 3 && b >= 3) return [a > b ? 'Ad' : '40', b > a ? 'Ad' : '40'];
    const call = ['0', '15', '30', '40'];
    return [call[a], call[b]];
  }

  onInput(slot, input) {
    if (slot !== 0 && slot !== 1) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'aim') {
      if (input.dir === -1 || input.dir === 0 || input.dir === 1) this.aims[slot] = input.dir;
      return;
    }
    if (input.type !== 'swing') return;
    const now = this.ctx.now();
    if (this.phase === 'serve') {
      if (slot === this.server) this.hit(slot, 0, true);
      return;
    }
    if (this.phase !== 'rally' || this.shot.to !== slot || this.shot.out || now < this.cooldown[slot]) return;
    const offset = now - (this.shot.tReach + TIMING.lagMs);
    // Too early, or too far from the ball: a whiff, and a moment to recover.
    if (offset < -TIMING.windowMs || Math.abs(this.players[slot].x - this.shot.at.x) > SHOT.reach) {
      this.cooldown[slot] = now + TIMING.cooldownMs;
      return;
    }
    if (offset > TIMING.windowMs) return; // too late: the point is already going
    this.hit(slot, offset, false);
  }

  /** Where the ball is now: along the ground and its height (for the TV). */
  ball() {
    const s = this.shot;
    if (!s) return { x: this.players[this.server].x, y: BASE[this.server] + (this.server === 0 ? -0.4 : 0.4), z: 1.2 };
    const now = this.ctx.now();
    if (now <= s.tLand) {
      const u = (now - s.t0) / (s.tLand - s.t0);
      return { x: s.from.x + (s.land.x - s.from.x) * u, y: s.from.y + (s.land.y - s.from.y) * u, z: (1 - u) * 1 + 4 * 1.6 * u * (1 - u) };
    }
    const v = (now - s.tLand) / (s.tReach - s.tLand);
    return { x: s.land.x + (s.at.x - s.land.x) * v, y: s.land.y + (s.at.y - s.land.y) * v, z: Math.max(0, 4 * 1.1 * (v / 1.3) * (1 - v / 1.3)) };
  }

  hostView() {
    const s = this.shot;
    return {
      phase: this.phase,
      players: this.ctx.players,
      countdown: this.phase === 'countdown' ? Math.max(0, Math.ceil((this.phaseEnds - this.ctx.now()) / 1000)) : 0,
      court: COURT,
      ball: this.ball(),
      shot: s ? { by: s.by, to: s.to, kind: s.kind, land: s.land, out: s.out } : null,
      positions: this.players.map((p) => p.x),
      score: this.scoreLabel(),
      calls: this.calls(),
      points: this.points,
      games: this.games,
      winGames: this.winGames,
      server: this.server,
      last: this.last,
      winner: this.winner,
    };
  }

  playerView(slot) {
    const s = this.shot;
    return {
      phase: this.phase,
      you: slot,
      countdown: this.phase === 'countdown' ? Math.max(0, Math.ceil((this.phaseEnds - this.ctx.now()) / 1000)) : 0,
      score: this.scoreLabel(),
      calls: this.calls(),
      games: this.games,
      winGames: this.winGames,
      yourServe: this.phase === 'serve' && this.server === slot,
      yourShot: this.phase === 'rally' && s.to === slot && !s.out,
      aim: this.aims[slot],
      last: this.last,
      winner: this.winner,
    };
  }
}

export default {
  id: 'rally-tennis',
  name: 'Rally Tennis',
  tagline: 'Tennis from above: your player runs to the ball, you time the swing and aim. Spot-on timing hits hardest.',
  create: (ctx) => new RallyTennis(ctx),
};
