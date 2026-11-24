// Memory Pairs. The cards lie face down; turn two over. A pair stays face
// up, two different ones turn back after a moment (remember where they
// were). Find every pair in as few tries as you can. Three sizes. Score: the
// tries it took (lower is better), per size.

import { settingOf } from './options.js';
import { lookOf } from './looks.js';

export const SIZES = { small: { w: 4, h: 4 }, medium: { w: 6, h: 4 }, large: { w: 6, h: 6 } };
export const FACES = ['🐶', '🐱', '🦊', '🐼', '🐸', '🐵', '🦁', '🐯', '🐨', '🐷', '🐙', '🦄', '🐝', '🐢', '🦋', '🐳', '🦉', '🐧'];
// The faces each look deals from (a 6 × 6 board needs 18 pairs, so each set has at least 18).
export const FACE_SETS = {
  animals: FACES,
  food: ['🍕', '🍔', '🍟', '🌭', '🍿', '🍩', '🍪', '🎂', '🍦', '🍉', '🍌', '🥑', '🥕', '🌽', '🍞', '🧀', '🍣', '🥨'],
  sea: ['🐠', '🐟', '🐡', '🦈', '🐬', '🐳', '🦀', '🦞', '🦐', '🦑', '🐙', '🐚', '🏖️', '⛵', '🐢', '🦦', '🌊', '⚓'],
  space: ['🚀', '🛸', '🪐', '🌍', '🌙', '⭐', '🎆', '☄️', '🌞', '👽', '🛰️', '🔭', '🌌', '🌠', '👾', '🌑', '🌕', '🌓'],
};
export const PEEK_MS = 900; // how long two different cards stay up

export class Memory {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const size = settingOf(ctx, 'size', 'small');
    this.size = Object.prototype.hasOwnProperty.call(SIZES, size) ? size : 'small';
    this.look = lookOf(ctx, 'memory-1p');
    this.timer = null;
  }

  start() {
    const { w, h } = SIZES[this.size];
    const faces = this.shuffle(FACE_SETS[this.look]).slice(0, (w * h) / 2);
    this.cards = this.shuffle([...faces, ...faces]);
    this.matched = Array(this.cards.length).fill(false);
    this.up = []; // the one or two cards turned over right now
    this.tries = 0; // pairs of cards turned over
    this.streak = 0;
    this.bestStreak = 0; // pairs found in a row
    this.lastMiss = 0; // tries that didn't match, so the screens can shake
    this.startedAt = null; // the clock starts with the first card
    this.endedAt = null;
    this.phase = 'play';
    this.clear();
    this.ctx.update();
  }

  shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  clear() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Turn the two cards that didn't match back over. */
  hide() {
    this.clear();
    this.up = [];
    this.ctx.update();
  }

  flip(i) {
    if (this.matched[i] || this.up.includes(i)) return;
    // A third card while two different ones still show: they turn back straight away.
    if (this.up.length === 2) {
      this.clear();
      this.up = [];
    }
    if (this.startedAt === null) this.startedAt = this.ctx.now();
    this.up.push(i);
    if (this.up.length === 2) {
      this.tries++;
      const [a, b] = this.up;
      if (this.cards[a] === this.cards[b]) {
        this.matched[a] = this.matched[b] = true;
        this.up = [];
        this.streak++;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        if (this.matched.every(Boolean)) {
          this.endedAt = this.ctx.now();
          this.phase = 'over';
        }
      } else {
        this.streak = 0;
        this.lastMiss = this.tries;
        this.timer = this.ctx.setTimeout(() => this.hide(), PEEK_MS);
      }
    }
    this.ctx.update();
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'flip' || this.phase !== 'play') return;
    const i = input.cell;
    if (!Number.isInteger(i) || i < 0 || i >= this.cards.length) return;
    this.flip(i);
  }

  get elapsed() {
    if (this.startedAt === null) return 0;
    return (this.endedAt !== null ? this.endedAt : this.ctx.now()) - this.startedAt;
  }

  view() {
    const { w, h } = SIZES[this.size];
    return {
      look: this.look,
      phase: this.phase,
      w,
      h,
      // Only the cards that are face up show what they are.
      cards: this.cards.map((c, i) => (this.matched[i] || this.up.includes(i) ? c : null)),
      matched: this.matched,
      up: this.up,
      tries: this.tries,
      pairsLeft: this.matched.filter((m) => !m).length / 2,
      streak: this.streak,
      bestStreak: this.bestStreak,
      lastMiss: this.lastMiss,
      elapsed: this.elapsed,
      score: this.phase === 'over' ? this.tries : null,
      variant: `${w}×${h}`,
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
  id: 'memory-1p',
  name: 'Memory Pairs 1P',
  tagline: 'Turn two cards over and find the pairs. Fewer tries is better.',
  category: 'brain',
  phone: true,
  score: { better: 'lower', unit: 'tries' },
  create: (ctx) => new Memory(ctx, ctx.rng),
};
