// Mind Meld: a co-op guessing game on a scale (Wavelength-style). Each round
// the TV shows a scale like "Cold ↔ Hot". The clue-giver's phone shows a
// secret spot on it, and they type a short clue ("soup"). The guesser turns
// a dial to where they think the clue sits; the closer, the more stars.
// Roles swap every round.
//
// The clue-giver needs a phone (a secret screen and typing). A controller
// player can still guess, turning the dial with the stick; with one, they
// always guess.

import { settingOf } from './options.js';

/** The scales: [left end, right end]. */
export const CARDS = [
  ['Cold', 'Hot'], ['Useless', 'Useful'], ['Boring', 'Exciting'], ['Cheap', 'Expensive'], ['Soft', 'Hard'],
  ['Quiet', 'Loud'], ['Tiny', 'Huge'], ['Slow', 'Fast'], ['Healthy', 'Unhealthy'], ['Easy', 'Hard to do'],
  ['Bad film', 'Great film'], ['Smells bad', 'Smells good'], ['Overrated', 'Underrated'], ['Old-fashioned', 'Modern'],
  ['Safe', 'Dangerous'], ['Sad song', 'Happy song'], ['Ugly', 'Beautiful'], ['Rare', 'Common'], ['Weak', 'Strong'],
  ['Dry', 'Wet'], ['Light', 'Heavy'], ['Messy', 'Tidy'], ['Mild food', 'Spicy food'], ['Normal', 'Weird'],
  ['Kids love it', 'Adults love it'], ['Bad habit', 'Good habit'], ['Forgettable', 'Unforgettable'], ['Fragile', 'Tough'],
  ['Calm', 'Chaotic'], ['Dull colour', 'Bright colour'], ['Bad pet', 'Good pet'], ['Easy to spell', 'Hard to spell'],
  ['Villain', 'Hero'], ['Snack', 'Meal'], ['Short-lived', 'Lasts forever'], ['Indoors', 'Outdoors'], ['Unknown', 'Famous'],
  ['Sweet', 'Savoury'], ['Lazy', 'Hard-working'], ['Rough', 'Smooth'], ['Bad gift', 'Great gift'], ['Relaxing', 'Stressful'],
  ['Sport', 'Not a sport'], ['Cat person', 'Dog person'], ['Underpaid job', 'Overpaid job'], ['Night', 'Morning'],
  ['Cosy', 'Uncomfortable'], ['Simple', 'Complicated'], ['Bad superpower', 'Great superpower'], ['Fruit', 'Vegetable'],
  ['Summer', 'Winter'], ['Funny', 'Serious'], ['Tasteless', 'Delicious'], ['Mainstream', 'Niche'], ['Polite', 'Rude'],
  ['Ancient', 'Futuristic'], ['Clean', 'Dirty'], ['Gross', 'Cute'], ['Fake', 'Real'], ['Waste of time', 'Time well spent'],
];

export const ROUNDS = 6;
export const CLUE_MAX = 40;
/** Stars by how far the dial lands from the target (0-100 scale). */
export const BANDS = [{ within: 4, stars: 3 }, { within: 11, stars: 2 }, { within: 18, stars: 1 }];
export const TIMING = { clueMs: 90000, guessMs: 60000, revealMs: 5000 };

export function starsFor(diff) {
  const band = BANDS.find((b) => diff <= b.within);
  return band ? band.stars : 0;
}

const cleanClue = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, CLUE_MAX);

export class MindMeld {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.rounds = settingOf(ctx, 'rounds', ROUNDS);
    this.timer = null;
    this.firstGiver = 0;
  }

  start() {
    this.clearTimer();
    this.round = 0;
    this.stars = 0;
    this.history = []; // { card, clue, target, aim, stars, giver }
    this.deck = this.shuffle(CARDS.map((_, i) => i));
    this.result = null;
    const local = this.ctx.players.map((p) => Boolean(p.local));
    if (local[0] && local[1]) {
      this.phase = 'needPhone';
      return this.ctx.update();
    }
    // A controller player can't type a clue, so they always guess.
    this.fixedGiver = local[0] ? 1 : local[1] ? 0 : null;
    this.nextRound();
  }

  shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  timed(phase, ms, then) {
    this.clearTimer();
    this.phase = phase;
    this.phaseEnds = this.ctx.now() + ms;
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      then();
    }, ms);
    this.ctx.update();
  }

  get giver() {
    if (this.fixedGiver !== null) return this.fixedGiver;
    return (this.firstGiver + this.round - 1) % 2;
  }

  get guesser() {
    return 1 - this.giver;
  }

  nextRound() {
    this.round++;
    this.card = CARDS[this.deck[(this.round - 1) % this.deck.length]];
    this.target = 3 + Math.floor(this.rng() * 95); // 3..97
    this.clue = null;
    this.aim = 50;
    this.result = null;
    this.timed('clue', TIMING.clueMs, () => this.reveal(true));
  }

  reveal(noClue = false) {
    const diff = Math.abs(this.aim - this.target);
    const stars = noClue ? 0 : starsFor(diff);
    this.stars += stars;
    this.result = { target: this.target, aim: this.aim, diff, stars, noClue };
    this.history.push({ card: this.card, clue: this.clue, target: this.target, aim: this.aim, stars, giver: this.giver });
    const last = this.round >= this.rounds;
    this.timed('reveal', TIMING.revealMs, () => (last ? this.finish() : this.nextRound()));
  }

  finish() {
    this.clearTimer();
    this.phase = 'over';
    this.firstGiver = 1 - this.firstGiver; // the other one starts giving clues next time
    this.ctx.update();
  }

  onInput(slot, input) {
    if (this.phase === 'over') {
      if (input.type === 'rematch') this.start();
      return;
    }
    if (this.phase === 'clue' && slot === this.giver && input.type === 'clue') {
      const clue = cleanClue(input.text);
      if (!clue) return;
      this.clue = clue;
      return this.timed('guess', TIMING.guessMs, () => this.reveal());
    }
    if (this.phase !== 'guess' && this.phase !== 'clue') return;
    if (slot !== this.guesser) return;
    // The guesser can line up the dial while waiting, but only lock in once there's a clue.
    if (input.type === 'aim' && Number.isFinite(input.value)) {
      const v = Math.max(0, Math.min(100, Math.round(input.value)));
      if (v !== this.aim) {
        this.aim = v;
        this.ctx.update();
      }
    } else if (input.type === 'lock' && this.phase === 'guess') {
      this.reveal();
    }
  }

  view() {
    const now = this.ctx.now();
    const revealed = this.phase === 'reveal' || this.phase === 'over';
    return {
      phase: this.phase,
      round: this.round,
      rounds: this.rounds,
      giver: this.phase === 'needPhone' ? null : this.giver,
      guesser: this.phase === 'needPhone' ? null : this.guesser,
      card: this.card || null,
      clue: this.clue || null,
      aim: this.aim,
      target: revealed && this.result ? this.result.target : null,
      result: this.result,
      bands: BANDS,
      timeLeftMs: this.phase === 'clue' || this.phase === 'guess' ? Math.max(0, this.phaseEnds - now) : 0,
      history: this.history,
      stars: this.stars,
      maxStars: this.rounds * 3,
    };
  }

  hostView() {
    return Object.assign(this.view(), { players: this.ctx.players });
  }

  playerView(slot) {
    const v = Object.assign(this.view(), { you: slot, clueMax: CLUE_MAX });
    // Only the clue-giver sees the target before the reveal.
    if (slot === this.giver && (this.phase === 'clue' || this.phase === 'guess')) v.target = this.target;
    return v;
  }
}

export default {
  id: 'mind-meld',
  name: 'Mind Meld',
  category: 'casual',
  needsPhone: true, // the clue-giver types on a secret screen
  music: 'thinking',
  tagline: 'Co-op: one of you secretly sees a spot on a scale (Cold ↔ Hot) and gives a clue; the other turns the dial to it. Closer means more stars.',
  create: (ctx) => new MindMeld(ctx),
};
