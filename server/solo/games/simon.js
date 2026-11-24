// Simon. The TV lights the four pads in a sequence; press them back in the
// same order. Get it right and the sequence grows by one (and plays a little
// faster). One wrong pad, or a long wait, and it's over. Score: the longest
// sequence you repeated.

import { lookOf } from './looks.js';

export const PADS = 4;
export const TIMING = {
  startMs: 1200, // before the first sequence
  litMs: 520, // how long a pad stays lit while showing the sequence, at the start
  minLitMs: 220,
  gapMs: 160,
  faster: 0.94, // each round's lit time is this much of the last's
  pressMs: 5000, // time allowed for each press
  flashMs: 200, // a pad you pressed lights this long
  nextMs: 900, // pause after a sequence you got right
};

export class Simon {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
    this.look = lookOf(ctx, 'simon');
  }

  start() {
    this.seq = [];
    this.step = 0; // while showing: which pad of the sequence; while repeating: how far you've got
    this.lit = null; // the pad lit right now
    this.pressed = null; // { pad, at } the last press, for the flash
    this.wrong = null; // the pad you got wrong
    this.timedOut = false;
    this.done = 0; // sequences repeated
    this.phase = 'ready';
    this.ctx.update();
    this.schedule(() => this.nextRound(), TIMING.startMs);
  }

  schedule(fn, ms) {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      fn();
    }, ms);
  }

  get litMs() {
    return Math.max(TIMING.minLitMs, Math.round(TIMING.litMs * TIMING.faster ** this.done));
  }

  nextRound() {
    this.seq.push(Math.floor(this.rng() * PADS));
    this.phase = 'show';
    this.step = 0;
    this.showStep();
  }

  /** Light the pads of the sequence one after another. */
  showStep() {
    if (this.step >= this.seq.length) {
      this.lit = null;
      this.phase = 'repeat';
      this.step = 0;
      this.ctx.update();
      this.waitForPress();
      return;
    }
    this.lit = this.seq[this.step];
    this.ctx.update();
    this.schedule(() => {
      this.lit = null;
      this.ctx.update();
      this.step++;
      this.schedule(() => this.showStep(), TIMING.gapMs);
    }, this.litMs);
  }

  waitForPress() {
    this.schedule(() => {
      this.timedOut = true;
      this.end();
    }, TIMING.pressMs);
  }

  end() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
    this.lit = null;
    this.phase = 'over';
    this.ctx.update();
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'press' || this.phase !== 'repeat') return;
    const pad = input.pad;
    if (!Number.isInteger(pad) || pad < 0 || pad >= PADS) return;
    this.pressed = { pad, n: (this.pressed ? this.pressed.n : 0) + 1 };
    if (pad !== this.seq[this.step]) {
      this.wrong = pad;
      return this.end();
    }
    this.step++;
    if (this.step === this.seq.length) {
      this.done++;
      this.phase = 'right';
      this.ctx.update();
      this.schedule(() => this.nextRound(), TIMING.nextMs);
      return;
    }
    this.ctx.update();
    this.waitForPress();
  }

  view() {
    return {
      look: this.look,
      phase: this.phase,
      lit: this.lit,
      pressed: this.pressed,
      length: this.seq.length,
      step: this.step,
      // Which pad was the right one, once it's over.
      expected: this.phase === 'over' ? this.seq[this.step] : null,
      wrong: this.wrong,
      timedOut: this.timedOut,
      pressMs: TIMING.pressMs,
      score: this.done,
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
  id: 'simon',
  name: 'Simon',
  tagline: 'Watch the pads light up, then play the sequence back. One more each round.',
  category: 'brain',
  phone: true,
  score: { better: 'higher', unit: 'pts' },
  create: (ctx) => new Simon(ctx, ctx.rng),
};
