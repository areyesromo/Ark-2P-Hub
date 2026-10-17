// The engine behind Micro Mayhem and Party Minigames: plays a playlist of
// minigames (server/games/minis/<id>.js), each through
//   intro (title card) -> play -> result -> the next one, until isOver().
// The lobby games subclass MiniGame and score the results (lives, wins).
//
// A minigame module:
//   { id, kind: 'micro' | 'party', name, order, howTo, durationMs, create(api) }
// create(api) returns { start(), onInput(slot, input), view(slot), onTimeUp()? }
// and calls api.end({ pass: [bool, bool] }) (micro) or api.end({ winner }) (party).
// api: { players, rng, speed, now(), elapsed(), update(), setTimeout, clearTimeout, end }.
// Its timers are cleared when it ends; inputs only reach it while it's in play.

export const TIMING = { introMicroMs: 1500, readyMaxMs: 8000, resultMicroMs: 1500, resultPartyMs: 3000 };

/** How far past the server's own clock a phone's time may be (network jitter). */
export const T_SLACK_MS = 150;

/**
 * The time to judge an input at: the phone's own `t` (ms since it saw play
 * start), so a slow network doesn't cost you, unless it's not believable.
 */
export function plausibleT(t, serverElapsed) {
  return typeof t === 'number' && Number.isFinite(t) && t >= 0 && t <= serverElapsed + T_SLACK_MS ? t : serverElapsed;
}

/** Shuffled ids, each once before any repeats, never the same one twice in a row. */
export class Playlist {
  constructor(ids, rng = Math.random) {
    this.ids = ids;
    this.rng = rng;
    this.queue = [];
    this.last = null;
  }

  next() {
    if (!this.queue.length) {
      const q = this.ids.slice();
      for (let i = q.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [q[i], q[j]] = [q[j], q[i]];
      }
      if (q.length > 1 && q[0] === this.last) [q[0], q[1]] = [q[1], q[0]];
      this.queue = q;
    }
    this.last = this.queue.shift();
    return this.last;
  }
}

export class MiniGame {
  constructor(ctx, pool, rng = Math.random) {
    this.ctx = ctx;
    this.pool = pool;
    this.rng = rng;
    this.playlist = new Playlist(pool.map((d) => d.id), rng);
    this.epoch = 0; // bumps with every minigame, so a stale api.end is ignored
    this.timers = []; // the current minigame's timers
    this.phaseTimer = null;
    this.scores = [0, 0];
    this.phase = 'intro';
  }

  // ---- hooks for the lobby games ----
  reset() {}
  scale() {
    return 1;
  }
  score() {}
  isOver() {
    return false;
  }
  extraView() {
    return {};
  }

  start() {
    this.clearMini();
    this.reset();
    this.count = 0;
    this.winner = null;
    this.draw = false;
    this.lastResult = null;
    this.nextMini();
  }

  clearMini() {
    for (const t of this.timers) this.ctx.clearTimeout(t);
    this.timers = [];
    if (this.phaseTimer) this.ctx.clearTimeout(this.phaseTimer);
    this.phaseTimer = null;
  }

  after(ms, fn) {
    if (this.phaseTimer) this.ctx.clearTimeout(this.phaseTimer);
    this.phaseTimer = this.ctx.setTimeout(() => {
      this.phaseTimer = null;
      fn();
    }, ms);
  }

  nextMini() {
    const epoch = ++this.epoch;
    const id = this.playlist.next();
    const def = this.pool.find((d) => d.id === id);
    const ctx = this.ctx;
    const api = {
      players: ctx.players,
      rng: this.rng,
      speed: this.scale(),
      now: () => ctx.now(),
      elapsed: () => ctx.now() - this.playAt,
      update: () => ctx.update(),
      setTimeout: (fn, ms) => {
        const t = ctx.setTimeout(() => {
          this.timers = this.timers.filter((x) => x !== t);
          fn();
        }, ms);
        this.timers.push(t);
        return t;
      },
      clearTimeout: (t) => {
        ctx.clearTimeout(t);
        this.timers = this.timers.filter((x) => x !== t);
      },
      end: (result) => {
        if (epoch === this.epoch && this.phase === 'play') this.end(result);
      },
    };
    this.def = def;
    this.durationMs = Math.round(def.durationMs * this.scale());
    this.instance = def.create(api);
    this.ready = [false, false];
    this.phase = 'intro';
    this.after(def.kind === 'micro' ? TIMING.introMicroMs : TIMING.readyMaxMs, () => this.play());
    ctx.update();
  }

  play() {
    this.phase = 'play';
    this.playAt = this.ctx.now();
    this.after(this.durationMs, () => this.timeUp());
    this.instance.start();
    this.ctx.update();
  }

  timeUp() {
    if (this.instance.onTimeUp) this.instance.onTimeUp();
    if (this.phase === 'play') this.end(this.def.kind === 'micro' ? { pass: [false, false] } : { winner: null });
  }

  end(result) {
    this.clearMini();
    this.phase = 'result';
    this.lastResult = result;
    this.count++;
    this.score(result);
    this.after(this.def.kind === 'micro' ? TIMING.resultMicroMs : TIMING.resultPartyMs, () => (this.isOver() ? this.finish() : this.nextMini()));
    this.ctx.update();
  }

  finish() {
    this.phase = 'over';
    this.ctx.update();
  }

  onInput(slot, input) {
    if (!input || typeof input !== 'object') return;
    if (this.phase === 'over') {
      if (input.type === 'rematch') this.start();
      return;
    }
    if (this.phase === 'intro' && this.def.kind === 'party' && input.type === 'ready') {
      this.ready[slot] = true;
      if (this.ready[0] && this.ready[1]) this.play();
      else this.ctx.update();
      return;
    }
    if (this.phase === 'play') this.instance.onInput(slot, input);
  }

  view(slot) {
    const d = this.def;
    return Object.assign({
      phase: this.phase,
      count: this.count,
      mini: { id: d.id, name: d.name, order: d.order, howTo: d.howTo, kind: d.kind },
      durationMs: this.durationMs,
      timeLeftMs: this.phase === 'play' ? Math.max(0, this.durationMs - (this.ctx.now() - this.playAt)) : 0,
      ready: this.ready,
      state: this.instance.view(slot),
      lastResult: this.lastResult,
      winner: this.winner,
      draw: this.draw,
      scores: this.scores,
      players: this.ctx.players,
    }, this.extraView());
  }

  hostView() {
    return this.view(null);
  }

  playerView(slot) {
    return Object.assign(this.view(slot), { you: slot });
  }
}

/**
 * Exactly one minigame (for Party Board): after its result card, calls
 * onDone(result) instead of ending the match.
 */
export class OneMini extends MiniGame {
  constructor(ctx, pool, rng, onDone) {
    super(ctx, pool, rng);
    this.onDone = onDone;
  }

  isOver() {
    return this.count >= 1;
  }

  finish() {
    this.phase = 'done';
    this.onDone(this.lastResult);
  }
}
