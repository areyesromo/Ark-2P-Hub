// Pawn Race: a race round a 40-square loop with a deck of move cards. You each have three pawns in
// your Start, and a hand of three cards, face up. On your turn play one card and move one pawn by
// it (then draw back up to three):
//   1 or 2: bring a pawn out of Start onto your first square, or move one forward 1 or 2.
//   3, 5, 8, 12: forward that many. 4: back 4. 10: forward 10, or back 1.
//   11: forward 11, or swap places with one of the other's pawns on the loop.
//   Bump: take a pawn from your Start and put it on a square where one of theirs is; theirs goes
//   back to its Start.
// Land on the other's pawn and it goes back to its Start; you can't land on your own. A slide in
// the other's colour carries you to its end, bumping anyone on it. Past your last loop square your
// pawn turns into your home stretch (4 squares, safe) and then Home, which needs an exact count.
// No card in your hand gives you a move: throw one away. First to get all three pawns Home wins.
// The deck is shuffled once and only again when it runs out. Who starts swaps every game; first to
// the games needed. Out of time: your turn's lost.

import { settingOf } from './options.js';

export const LOOP = 40;
export const PAWNS = 3;
export const STRETCH = 4; // squares in the home stretch
export const WIN_SCORE = 1;
export const HAND = 3;
export const TIMING = { moveMs: 25000, showMs: 1500, gameEndMs: 5000 };
// Each player's first square out of Start. A pawn's progress: 0 in Start, 1 … 40 round the loop
// (the 40th is the square just behind its entry), 41 … 44 the home stretch, 45 Home.
export const ENTRY = [2, 22];
export const HOME = LOOP + STRETCH + 1; // 45
// The slides: start square → end square, and whose colour they are (they don't carry their owner).
export const SLIDES = [
  { from: 7, to: 10, owner: 1 }, { from: 15, to: 19, owner: 1 },
  { from: 27, to: 30, owner: 0 }, { from: 35, to: 39, owner: 0 },
];
export const CARDS = { 1: 5, 2: 4, 3: 4, 4: 4, 5: 4, 8: 4, 10: 4, 11: 4, 12: 4, bump: 4 };

/** The loop square a pawn of player `s` stands on at progress `p` (1 … 40), or -1 off the loop. */
export const squareOf = (s, p) => (p >= 1 && p <= LOOP ? (ENTRY[s] + p - 1) % LOOP : -1);
/** A pawn's progress from the loop square it stands on. */
export const progressAt = (s, sq) => ((sq - ENTRY[s] + LOOP) % LOOP) + 1;

/** Every move player `s` can make with `card`, as { pawn, kind, to (progress), target? }. */
export function movesFor(pawns, s, card) {
  const mine = pawns[s];
  const theirs = pawns[1 - s];
  const out = [];
  const myOn = (sq) => mine.some((p) => squareOf(s, p) === sq);
  const landOk = (p) => {
    if (p < 1 || p > HOME) return false;
    if (p <= LOOP) return !myOn(squareOf(s, p));
    return p === HOME || !mine.includes(p); // the stretch: one pawn a square; Home holds all
  };
  const forward = (n) => mine.forEach((p, i) => { if (p >= 1 && p < HOME && landOk(p + n)) out.push({ pawn: i, kind: 'forward', to: p + n }); });
  const back = (n) => mine.forEach((p, i) => {
    if (p < 1 || p > LOOP) return; // (not from Start, nor in the stretch)
    let to = p - n;
    if (to < 1) to += LOOP; // back past its entry: round to the far end of the loop
    if (landOk(to)) out.push({ pawn: i, kind: 'back', to });
  });
  const leave = () => {
    const i = mine.indexOf(0);
    if (i >= 0 && landOk(1)) out.push({ pawn: i, kind: 'out', to: 1 });
  };
  if (card === 'bump') {
    const i = mine.indexOf(0);
    if (i >= 0) theirs.forEach((p, j) => { if (p >= 1 && p <= LOOP) out.push({ pawn: i, kind: 'bump', to: progressAt(s, squareOf(1 - s, p)), target: j }); });
    return out;
  }
  if (card === 1 || card === 2) leave();
  if (card === 4) back(4);
  else forward(card);
  if (card === 10) back(1);
  if (card === 11) {
    mine.forEach((p, i) => {
      if (p < 1 || p > LOOP) return;
      theirs.forEach((q, j) => { if (q >= 1 && q <= LOOP) out.push({ pawn: i, kind: 'swap', to: progressAt(s, squareOf(1 - s, q)), target: j }); });
    });
  }
  return out;
}

/**
 * The pawns after player `s` makes move `m` (a fresh copy): landing on the other's pawn sends it
 * back to Start; then a slide in the other's colour carries you to its end, sending back anyone on
 * it (yours too). Returns { pawns, bumped: the other's pawns sent back, slid }.
 */
export function applyMove(before, s, m) {
  const pawns = [before[0].slice(), before[1].slice()];
  const mine = pawns[s];
  const theirs = pawns[1 - s];
  const from = mine[m.pawn];
  const bumped = [];
  const sendBack = (j) => { theirs[j] = 0; bumped.push(j); };
  if (m.kind === 'swap') {
    theirs[m.target] = progressAt(1 - s, squareOf(s, from));
    mine[m.pawn] = m.to;
  } else {
    mine[m.pawn] = m.to;
    if (m.kind === 'bump') sendBack(m.target);
  }
  let slid = false;
  const sq = squareOf(s, mine[m.pawn]);
  if (sq >= 0) {
    if (m.kind !== 'swap' && m.kind !== 'bump') theirs.forEach((p, j) => { if (squareOf(1 - s, p) === sq) sendBack(j); });
    const slide = SLIDES.find((x) => x.from === sq && x.owner !== s);
    if (slide) {
      slid = true;
      for (let k = 1; k <= ((slide.to - slide.from + LOOP) % LOOP); k++) {
        const on = (slide.from + k) % LOOP;
        theirs.forEach((p, j) => { if (squareOf(1 - s, p) === on) sendBack(j); });
        mine.forEach((p, i) => { if (i !== m.pawn && squareOf(s, p) === on) mine[i] = 0; });
      }
      mine[m.pawn] = progressAt(s, slide.to); // (no slide runs past anyone's last loop square)
    }
  }
  return { pawns, bumped, slid };
}

export class PawnRace {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.clock = settingOf(ctx, 'timer', 'timed') === 'timed';
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.scores = [0, 0];
    this.round = 0;
    this.starter = 1;
    this.winner = null;
    this.newRound();
  }

  newDeck() {
    const deck = [];
    for (const [c, k] of Object.entries(CARDS)) for (let i = 0; i < k; i++) deck.push(c === 'bump' ? 'bump' : Number(c));
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    return deck;
  }

  newRound() {
    this.clearTimer();
    this.round++;
    this.starter = 1 - this.starter;
    this.pawns = [new Array(PAWNS).fill(0), new Array(PAWNS).fill(0)];
    this.deck = this.newDeck();
    this.hands = [[], []];
    for (const s of [0, 1]) for (let k = 0; k < HAND; k++) this.hands[s].push(this.draw());
    this.options = [];
    this.lastMove = null;
    this.n = 0;
    this.result = null;
    this.turn = this.starter;
    this.startTurn();
  }

  draw() {
    if (!this.deck.length) this.deck = this.newDeck();
    return this.deck.pop();
  }

  /** Every move the player to move can make: { card (its place in the hand), pawn, kind, to, target? }; or, with none, the discards. */
  optionsFor(s) {
    const out = [];
    this.hands[s].forEach((card, ci) => { for (const m of movesFor(this.pawns, s, card)) out.push({ card: ci, ...m }); });
    if (!out.length) this.hands[s].forEach((_, ci) => out.push({ card: ci, kind: 'discard' }));
    return out;
  }

  startTurn() {
    this.options = this.optionsFor(this.turn);
    this.phase = 'move';
    this.armClock(TIMING.moveMs, 'moveTimeUp');
  }

  /** Out of time: the turn's lost (the hand stays as it is). */
  moveTimeUp() {
    this.lastMove = { by: this.turn, missed: true, n: ++this.n };
    this.after2('show');
  }

  after2(phase) {
    this.phase = phase;
    this.deadline = null;
    this.options = [];
    this.turn = 1 - this.turn;
    this.arm(TIMING.showMs, 'startTurn');
  }

  play(s, m) {
    const card = this.hands[s][m.card];
    this.hands[s].splice(m.card, 1);
    this.hands[s].push(this.draw());
    this.n++;
    if (m.kind === 'discard') {
      this.lastMove = { by: s, card, kind: 'discard', n: this.n };
      return this.after2('show');
    }
    const from = this.pawns[s][m.pawn];
    const { pawns, bumped, slid } = applyMove(this.pawns, s, m);
    this.pawns = pawns;
    this.lastMove = { by: s, card, kind: m.kind, pawn: m.pawn, from, to: pawns[s][m.pawn], bumped, slid, n: this.n };
    if (pawns[s].every((p) => p === HOME)) return this.endRound(s);
    this.after2('show');
  }

  endRound(w) {
    this.clearTimer();
    this.deadline = null;
    this.scores[w]++;
    this.result = { winner: w };
    this.turn = null;
    if (this.scores[w] >= this.winScore) {
      this.winner = w;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'roundEnd';
    this.arm(TIMING.gameEndMs, 'newRound');
  }

  armClock(ms, then) {
    this.deadline = this.clock ? this.ctx.now() + ms : null;
    this.arm(ms, then);
  }

  arm(ms, then) {
    this.clearTimer();
    this.after = then;
    this.ctx.update();
    if (!this.clock && /TimeUp$/.test(then)) return;
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
    if (!this.clock && /TimeUp$/.test(this.after)) return;
    const ms = Math.max(0, (this.due || this.ctx.now()) + downMs - this.ctx.now());
    this.due = this.ctx.now() + ms;
    const then = this.after;
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this[then](); }, ms);
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (slot !== this.turn) return;
    if (input.type === 'move' && this.phase === 'move' && Number.isInteger(input.option) && input.option >= 0 && input.option < this.options.length) {
      this.play(slot, this.options[input.option]);
    }
  }

  view() {
    return {
      phase: this.phase,
      round: this.round,
      pawns: this.pawns,
      entry: ENTRY,
      slides: SLIDES,
      hands: this.hands, // (face up)
      options: this.phase === 'move' ? this.options : [],
      deckLeft: this.deck.length,
      turn: this.turn,
      lastMove: this.lastMove,
      n: this.n,
      result: this.result,
      scores: this.scores,
      winScore: this.winScore,
      timeLeftMs: this.deadline ? Math.max(0, this.deadline - this.ctx.now()) : 0,
      timed: this.clock,
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
  id: 'pawn-race',
  category: 'board',
  handheld: true,
  music: 'casual',
  name: 'Pawn Race',
  tagline: 'Play a card from your hand to move a pawn: race all three round the loop and Home. Land on theirs to send it back to Start.',
  create: (ctx) => new PawnRace(ctx),
};
