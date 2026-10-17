// Dice Party: Yahtzee-style dice for two. On your turn roll five dice up to
// three times, holding the ones you like between rolls, then score them in
// one of 13 boxes (each box once). Upper boxes (ones to sixes) earn a 35
// bonus at 63 or more. Highest total wins. Nothing is secret, so it plays on
// phones or controllers.

import { settingOf } from './options.js';

export const ROUNDS = 13;
export const ROLLS = 3;
export const UPPER_BONUS = { at: 63, points: 35 };

const counts = (dice) => [1, 2, 3, 4, 5, 6].map((f) => dice.filter((d) => d === f).length);
const sum = (dice) => dice.reduce((a, b) => a + b, 0);
const run = (dice) => {
  const has = new Set(dice);
  let best = 0;
  let cur = 0;
  for (let f = 1; f <= 6; f++) {
    cur = has.has(f) ? cur + 1 : 0;
    best = Math.max(best, cur);
  }
  return best;
};

/** The 13 boxes: id, name, and what five dice score there. */
export const BOXES = [
  { id: 'ones', name: 'Ones', upper: true, score: (d) => d.filter((x) => x === 1).length },
  { id: 'twos', name: 'Twos', upper: true, score: (d) => 2 * d.filter((x) => x === 2).length },
  { id: 'threes', name: 'Threes', upper: true, score: (d) => 3 * d.filter((x) => x === 3).length },
  { id: 'fours', name: 'Fours', upper: true, score: (d) => 4 * d.filter((x) => x === 4).length },
  { id: 'fives', name: 'Fives', upper: true, score: (d) => 5 * d.filter((x) => x === 5).length },
  { id: 'sixes', name: 'Sixes', upper: true, score: (d) => 6 * d.filter((x) => x === 6).length },
  { id: 'three', name: 'Three of a kind', score: (d) => (Math.max(...counts(d)) >= 3 ? sum(d) : 0) },
  { id: 'four', name: 'Four of a kind', score: (d) => (Math.max(...counts(d)) >= 4 ? sum(d) : 0) },
  { id: 'house', name: 'Full house', score: (d) => { const c = counts(d).filter(Boolean).sort(); return c.length === 2 && c[0] === 2 ? 25 : 0; } },
  { id: 'small', name: 'Small straight', score: (d) => (run(d) >= 4 ? 30 : 0) },
  { id: 'large', name: 'Large straight', score: (d) => (run(d) >= 5 ? 40 : 0) },
  { id: 'yahtzee', name: 'Five of a kind', score: (d) => (Math.max(...counts(d)) === 5 ? 50 : 0) },
  { id: 'chance', name: 'Chance', score: (d) => sum(d) },
];

/** A scorecard's totals: upper boxes, bonus, and the grand total. */
export function totals(card) {
  const upper = BOXES.filter((b) => b.upper).reduce((a, b) => a + (card[b.id] || 0), 0);
  const bonus = upper >= UPPER_BONUS.at ? UPPER_BONUS.points : 0;
  const lower = BOXES.filter((b) => !b.upper).reduce((a, b) => a + (card[b.id] || 0), 0);
  return { upper, bonus, lower, total: upper + bonus + lower };
}

export class DiceParty {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.rounds = settingOf(ctx, 'rounds', ROUNDS);
    this.firstStarter = 0;
  }

  start() {
    this.cards = [{}, {}];
    this.turn = this.firstStarter;
    this.firstStarter = 1 - this.firstStarter;
    this.round = 1;
    this.turnsTaken = 0;
    this.winner = null;
    this.draw = false;
    this.last = null; // { by, box, points } for the TV
    this.newTurn();
  }

  newTurn() {
    this.dice = [0, 0, 0, 0, 0]; // 0: not rolled yet
    this.held = [false, false, false, false, false];
    this.rollsLeft = ROLLS;
    this.phase = 'turn';
    this.ctx.update();
  }

  roll() {
    if (this.rollsLeft <= 0) return;
    this.dice = this.dice.map((d, i) => (this.held[i] && d ? d : 1 + Math.floor(this.rng() * 6)));
    this.rollsLeft--;
    this.rolls = (this.rolls || 0) + 1;
    this.ctx.update();
  }

  score(boxId) {
    const box = BOXES.find((b) => b.id === boxId);
    const card = this.cards[this.turn];
    if (!box || card[boxId] !== undefined || this.rollsLeft === ROLLS) return;
    card[boxId] = box.score(this.dice);
    this.last = { by: this.turn, box: box.name, points: card[boxId] };
    this.turnsTaken++;
    if (this.turnsTaken >= this.rounds * 2) return this.finish();
    this.turn = 1 - this.turn;
    if (this.turnsTaken % 2 === 0) this.round++;
    this.newTurn();
  }

  finish() {
    const [a, b] = this.cards.map((c) => totals(c).total);
    this.winner = a === b ? null : a > b ? 0 : 1;
    this.draw = this.winner === null;
    this.phase = 'over';
    this.ctx.update();
  }

  onInput(slot, input) {
    if (this.phase === 'over') {
      if (input.type === 'rematch') this.start();
      return;
    }
    if (slot !== this.turn) return;
    if (input.type === 'roll') return this.roll();
    if (input.type === 'hold') {
      const i = input.die;
      if (!Number.isInteger(i) || i < 0 || i > 4 || this.rollsLeft === ROLLS) return;
      this.held[i] = !this.held[i];
      return this.ctx.update();
    }
    if (input.type === 'score') this.score(input.box);
  }

  view() {
    const rolled = this.rollsLeft < ROLLS;
    return {
      phase: this.phase,
      turn: this.turn,
      round: this.round,
      rounds: this.rounds,
      dice: this.dice,
      held: this.held,
      rollsLeft: this.rollsLeft,
      boxes: BOXES.map((b) => ({ id: b.id, name: b.name, upper: Boolean(b.upper) })),
      cards: this.cards,
      totals: this.cards.map(totals),
      // What the dice would score in each open box, for whoever's turn it is.
      options: rolled ? Object.fromEntries(BOXES.filter((b) => this.cards[this.turn][b.id] === undefined).map((b) => [b.id, b.score(this.dice)])) : {},
      bonus: UPPER_BONUS,
      last: this.last,
      winner: this.winner,
      draw: this.draw,
      scores: this.cards.map((c) => totals(c).total),
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
  id: 'dice-party',
  name: 'Dice Party',
  category: 'board',
  music: 'casual',
  tagline: 'Yahtzee-style: roll five dice up to three times, hold the ones you want, and score them in one of 13 boxes. Full house, straights, five of a kind… highest total wins.',
  create: (ctx) => new DiceParty(ctx),
};
