// Odd One Out. A grid of squares all the same colour, except one that's a
// shade lighter or darker: tap it. Each one you find makes the grid bigger and
// the difference smaller. A wrong tap costs 3 seconds. 60 seconds in all.
// Score: odd ones found.

export const SECONDS = 60;
export const WRONG_MS = 3000;
export const TIMING = { readyMs: 1500, tickMs: 250 };

/** Squares across for a round (3 × 3 at first, up to 8 × 8). */
export const sizeFor = (round) => Math.min(8, 3 + Math.floor(round / 3));
/** How much lighter or darker the odd one is, in % lightness: easy at first, down to 3. */
export const diffFor = (round) => Math.max(3, 22 - round * 1.4);

export class OddOne {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
  }

  start() {
    this.found = 0;
    this.wrong = 0;
    this.round = 0;
    this.last = null; // { ok, at, odd, n }: the last tap, for the screens
    this.n = 0;
    this.phase = 'ready';
    this.schedule(() => this.begin(), TIMING.readyMs);
    this.ctx.update();
  }

  schedule(fn, ms) {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      fn();
    }, ms);
  }

  begin() {
    this.phase = 'play';
    this.endsAt = this.ctx.now() + SECONDS * 1000;
    this.deal();
    this.tick();
  }

  /** A new grid: a random colour, and one square a shade off it. */
  deal() {
    this.size = sizeFor(this.round);
    this.hue = Math.floor(this.rng() * 360);
    this.sat = 55 + Math.floor(this.rng() * 30);
    this.light = 40 + Math.floor(this.rng() * 15);
    const d = diffFor(this.round);
    this.oddLight = Math.round((this.light + (this.rng() < 0.5 ? d : -d)) * 10) / 10;
    this.odd = Math.floor(this.rng() * this.size * this.size);
  }

  tick() {
    if (this.ctx.now() >= this.endsAt) {
      this.phase = 'over';
      this.ctx.update();
      return;
    }
    this.ctx.update();
    this.schedule(() => this.tick(), Math.min(TIMING.tickMs, this.endsAt - this.ctx.now()));
  }

  pick(i) {
    const ok = i === this.odd;
    this.last = { ok, at: i, odd: this.odd, size: this.size, n: ++this.n };
    if (ok) {
      this.found++;
      this.round++;
      this.deal();
    } else {
      this.wrong++;
      this.endsAt -= WRONG_MS;
    }
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'pick' || this.phase !== 'play') return;
    if (!Number.isInteger(input.cell) || input.cell < 0 || input.cell >= this.size * this.size) return;
    this.pick(input.cell);
    this.tick();
  }

  view() {
    const play = this.phase === 'play';
    return {
      phase: this.phase,
      // The grid: its colour and the odd one's (the odd square is where it is, as on any screen).
      size: play ? this.size : 0,
      base: play ? `hsl(${this.hue}, ${this.sat}%, ${this.light}%)` : null,
      oddColour: play ? `hsl(${this.hue}, ${this.sat}%, ${this.oddLight}%)` : null,
      odd: play ? this.odd : null,
      round: this.round,
      last: this.last,
      timeLeft: play ? Math.max(0, this.endsAt - this.ctx.now()) : this.phase === 'ready' ? SECONDS * 1000 : 0,
      seconds: SECONDS,
      wrong: this.wrong,
      score: this.found,
    };
  }

  hostView() {
    return { ...this.view(), player: this.ctx.player };
  }

  playerView() {
    return this.view();
  }
}

export default {
  id: 'oddone',
  name: 'Odd One Out',
  tagline: 'One square is a shade different. Spot it, fast: the grid grows and the shades get closer.',
  category: 'brain',
  phone: true,
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new OddOne(ctx, ctx.rng),
};
