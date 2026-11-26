// Video Poker, head to head (play chips only). You both get the same five cards, and the same new
// cards in the same order when you draw: so it's only what you each hold that differs. Pick the
// cards to keep on your phone (secret until you've both locked in), then the rest are swapped for
// new ones. Better five-card hand takes the pot; the same is a split. Each hand you both put in the
// ante, and it goes up as the match goes on. Out of time to hold: you fold the hand. Most chips after
// the last hand wins (run out and it's over).

import { settingOf } from './options.js';
import { deck, evaluate } from './holdem-hands.js';

export const START_CHIPS = 1000;
export const HANDS = 10;
export const TIMING = { holdMs: 30000, revealMs: 5000 };
/** The ante each hand: 50, then up by 25 every few hands. */
export const anteFor = (hand, hands) => 50 + 25 * Math.floor(((hand - 1) * 4) / hands);

export class VideoPoker {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.hands = settingOf(ctx, 'hands', HANDS);
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.chips = [START_CHIPS, START_CHIPS];
    this.handNo = 0;
    this.winner = null;
    this.newHand();
  }

  newHand() {
    this.clearTimer();
    if (this.handNo >= this.hands || this.chips.some((c) => c <= 0)) return this.finish();
    this.handNo++;
    const cards = deck();
    for (let i = cards.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [cards[i], cards[j]] = [cards[j], cards[i]];
    }
    this.dealt = cards.slice(0, 5);
    this.spare = cards.slice(5, 10); // the new cards, in order: the same for you both
    this.ante = anteFor(this.handNo, this.hands);
    this.pot = 0;
    for (const s of [0, 1]) {
      const a = Math.min(this.ante, this.chips[s]);
      this.chips[s] -= a;
      this.pot += a;
    }
    this.holds = [null, null]; // each one's five true / false, once locked
    this.finals = null;
    this.result = null;
    this.phase = 'hold';
    this.deadline = this.clock ? this.ctx.now() + TIMING.holdMs : null;
    this.arm(TIMING.holdMs, 'holdTimeUp');
  }

  /** Out of time: you fold the hand (your ante goes to the other); both out of time, it's split. */
  holdTimeUp() {
    this.folded = [0, 1].filter((s) => !this.holds[s]);
    for (const s of this.folded) this.holds[s] = [false, false, false, false, false];
    this.reveal();
  }

  /** A hand after the draw: the held cards stay, the others are the spare cards from the top. */
  finalFor(hold) {
    let k = 0;
    return this.dealt.map((c, i) => (hold[i] ? c : this.spare[k++]));
  }

  reveal() {
    this.clearTimer();
    this.deadline = null;
    this.finals = this.holds.map((h) => this.finalFor(h));
    const hands = this.finals.map((f) => evaluate(f));
    let winner = hands[0].score === hands[1].score ? null : hands[0].score > hands[1].score ? 0 : 1;
    const folded = this.folded || [];
    if (folded.length === 1) winner = 1 - folded[0];
    else if (folded.length === 2) winner = null;
    if (winner === null) {
      const half = Math.floor(this.pot / 2);
      this.chips[0] += half;
      this.chips[1] += this.pot - half;
    } else this.chips[winner] += this.pot;
    this.result = { winner, names: hands.map((h, s) => (folded.includes(s) ? 'Out of time: folded' : h.name)), pot: this.pot };
    this.folded = null;
    this.phase = 'reveal';
    this.arm(TIMING.revealMs, 'newHand');
  }

  finish() {
    this.clearTimer();
    this.winner = this.chips[0] === this.chips[1] ? null : this.chips[0] > this.chips[1] ? 0 : 1;
    this.phase = 'over';
    this.deadline = null;
    this.ctx.update();
  }

  arm(ms, then) {
    this.clearTimer();
    this.after = then;
    this.ctx.update();
    if (!this.clock && then === 'holdTimeUp') return;
    this.due = this.ctx.now() + ms;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  resumed(downMs = 0) {
    this.timer = null;
    if (this.phase === 'over' || !this.after) return;
    if (this.deadline) this.deadline += downMs;
    if (!this.clock && this.after === 'holdTimeUp') return;
    const ms = Math.max(0, (this.due || this.ctx.now()) + downMs - this.ctx.now());
    this.due = this.ctx.now() + ms;
    const then = this.after;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'hold' || this.phase !== 'hold' || this.holds[slot]) return;
    const h = input.hold;
    if (!Array.isArray(h) || h.length !== 5 || !h.every((x) => x === true || x === false)) return;
    this.holds[slot] = h.slice();
    if (this.holds[0] && this.holds[1]) return this.reveal();
    this.ctx.update();
  }

  view(viewer) {
    const open = this.phase === 'reveal' || this.phase === 'over';
    return {
      phase: this.phase,
      hand: this.handNo,
      hands: this.hands,
      chips: this.chips,
      ante: this.ante,
      pot: this.pot,
      dealt: this.dealt,
      locked: this.holds.map(Boolean),
      // Your own holds as you locked them; theirs only once the cards are shown.
      holds: this.holds.map((h, s) => (h && (open || s === viewer) ? h : null)),
      finals: open ? this.finals : null,
      result: this.result,
      timeLeftMs: this.deadline ? Math.max(0, this.deadline - this.ctx.now()) : 0,
      timed: this.clock,
      winner: this.winner,
    };
  }

  hostView() {
    return Object.assign(this.view(null), { players: this.ctx.players });
  }

  playerView(slot) {
    return Object.assign(this.view(slot), { you: slot });
  }
}

export default {
  id: 'video-poker',
  category: 'board',
  phoneOnly: true, // (your holds are secret till you've both locked in)
  handheld: true,
  music: 'thinking',
  name: 'Video Poker',
  tagline: 'The same five cards for you both, and the same new ones: hold the best and draw. Better hand takes the pot.',
  create: (ctx) => new VideoPoker(ctx),
};
