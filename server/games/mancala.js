// Mancala (Kalah). Each side has 6 pits of 4 stones and a store on its right. Pick one of your
// pits and sow its stones one by one counter-clockwise (into your store, never your rival's).
// End in your store: go again. End in an empty pit of yours with stones opposite: capture both.
// When a side runs empty, the other side's stones go to their owner; the fuller store wins.
// Who starts swaps every round; each move has a clock (run out and a pit is picked for you).

import { settingOf } from './options.js';

export const PITS = 6;
export const SEEDS = 4;
export const WIN_SCORE = 1;
export const TIMING = { turnMs: 30000, roundEndMs: 5000 };

// pits[0..5]: P1's pits (left to right on their side), pits[6]: P1's store,
// pits[7..12]: P2's pits, pits[13]: P2's store. Sowing goes up the indexes.
export const STORE = [PITS, PITS * 2 + 1];
const SIZE = PITS * 2 + 2;
const mine = (slot, i) => i >= slot * (PITS + 1) && i < slot * (PITS + 1) + PITS;
const opposite = (i) => PITS * 2 - i;

/**
 * Sow `slot`'s pit `i` on `pits` (changed in place). Returns where the last stone landed, the
 * captured pit pair (or null) and whether the player goes again.
 */
export function sow(pits, slot, i) {
  let hand = pits[i];
  pits[i] = 0;
  let at = i;
  while (hand) {
    at = (at + 1) % SIZE;
    if (at === STORE[1 - slot]) continue; // skip the rival's store
    pits[at]++;
    hand--;
  }
  let captured = null;
  if (mine(slot, at) && pits[at] === 1 && pits[opposite(at)] > 0) {
    captured = { pit: at, from: opposite(at), stones: pits[opposite(at)] + 1 };
    pits[STORE[slot]] += captured.stones;
    pits[at] = 0;
    pits[opposite(at)] = 0;
  }
  return { last: at, captured, again: at === STORE[slot] };
}

/** The pits `slot` may pick (any of theirs with stones). */
export function legalPits(pits, slot) {
  const out = [];
  for (let k = 0; k < PITS; k++) {
    const i = slot * (PITS + 1) + k;
    if (pits[i]) out.push(i);
  }
  return out;
}

export class Mancala {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.seeds = settingOf(ctx, 'seeds', SEEDS);
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.scores = [0, 0];
    this.round = 0;
    this.winner = null;
    this.starter = null;
    this.newRound();
  }

  newRound() {
    this.round++;
    this.pits = Array.from({ length: SIZE }, (_, i) => (i === STORE[0] || i === STORE[1] ? 0 : this.seeds));
    this.starter = this.starter === null ? 0 : 1 - this.starter;
    this.turn = this.starter;
    this.lastMove = null;
    this.result = null;
    this.moves = 0;
    this.phase = 'play';
    this.startTurn();
  }

  // ---- clock ------------------------------------------------------------------------

  startTurn() {
    this.turnEnds = this.ctx.now() + TIMING.turnMs;
    this.ctx.update();
    this.scheduleTick();
  }

  /** Push the clock every second; pick a random pit when it runs out. */
  scheduleTick() {
    this.clearTimer();
    const left = this.turnEnds - this.ctx.now();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      if (this.phase !== 'play') return;
      if (this.turnEnds - this.ctx.now() > 0) {
        this.ctx.update();
        this.scheduleTick();
      } else {
        const legal = legalPits(this.pits, this.turn);
        this.move(this.turn, legal[Math.floor(this.rng() * legal.length)]);
      }
    }, Math.max(0, Math.min(1000, left)));
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  // ---- moves ------------------------------------------------------------------------

  move(slot, pit) {
    if (!legalPits(this.pits, slot).includes(pit)) return false;
    const stones = this.pits[pit];
    const r = sow(this.pits, slot, pit);
    this.moves++;
    this.lastMove = { slot, pit, stones, last: r.last, captured: r.captured, again: r.again, n: this.moves };
    // A side with no stones ends the round: the rest go to their owner.
    if (!legalPits(this.pits, 0).length || !legalPits(this.pits, 1).length) return this.endRound();
    if (!r.again) this.turn = 1 - slot;
    this.startTurn();
    return true;
  }

  endRound() {
    this.clearTimer();
    for (const s of [0, 1]) {
      for (const i of legalPits(this.pits, s)) {
        this.pits[STORE[s]] += this.pits[i];
        this.pits[i] = 0;
      }
    }
    const [a, b] = STORE.map((i) => this.pits[i]);
    const winner = a === b ? null : a > b ? 0 : 1;
    this.result = { winner, draw: winner === null, stores: [a, b] };
    if (winner !== null) this.scores[winner]++;
    if (winner !== null && this.scores[winner] >= this.winScore) {
      this.winner = winner;
      this.phase = 'over';
      this.ctx.update();
      return true;
    }
    this.phase = 'roundEnd';
    this.ctx.update();
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      this.newRound();
    }, TIMING.roundEndMs);
    return true;
  }

  onInput(slot, input) {
    if (!input || typeof input !== 'object') return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type !== 'sow' || this.phase !== 'play' || slot !== this.turn || !Number.isInteger(input.pit)) return;
    this.move(slot, input.pit);
  }

  // ---- views ------------------------------------------------------------------------

  view() {
    return {
      phase: this.phase,
      round: this.round,
      pits: this.pits,
      turn: this.turn,
      legal: this.phase === 'play' ? legalPits(this.pits, this.turn) : [],
      lastMove: this.lastMove,
      result: this.result,
      scores: this.scores,
      winScore: this.winScore,
      timeLeftMs: this.phase === 'play' ? Math.max(0, this.turnEnds - this.ctx.now()) : 0,
      turnMs: TIMING.turnMs,
      winner: this.winner,
    };
  }

  hostView() {
    return Object.assign(this.view(), { players: this.ctx.players });
  }

  playerView(slot) {
    return Object.assign(this.view(), { you: slot });
  }
}

export default {
  id: 'mancala',
  category: 'board',
  music: 'thinking',
  name: 'Mancala',
  tagline: 'Sow stones around the bowls. End in your store to go again; end in an empty bowl of yours to capture across. Fullest store wins.',
  create: (ctx) => new Mancala(ctx),
};
