// Nine Men's Morris. Nine pieces each and a board of three squares, one inside another, joined at the
// middle of each side: 24 points. First take turns placing your pieces on empty points; then take
// turns sliding one along a line to the next empty point. Three of yours in a line (a mill) lets you
// take one of theirs off (not one in a mill, unless they all are). Down to three pieces, yours can
// fly to any empty point. Fewer than three, or no move at all, loses. Fifty moves in a row without a
// mill (once all are placed) is a draw.
//
// Points: 0-7 the outer square, 8-15 the middle one, 16-23 the inner one, each clockwise from its top
// left corner; the odd ones are the middles of the sides, joined to the next square's.

import { settingOf } from './options.js';

export const PIECES = 9;
export const WIN_SCORE = 1;
export const QUIET_DRAW = 50;
export const TIMING = { turnMs: 30000, gameEndMs: 5000 };

export const NEIGHBOURS = Array.from({ length: 24 }, (_, p) => {
  const ring = Math.floor(p / 8);
  const i = p % 8;
  const out = [ring * 8 + ((i + 1) % 8), ring * 8 + ((i + 7) % 8)];
  if (i % 2 === 1) {
    if (ring > 0) out.push(p - 8);
    if (ring < 2) out.push(p + 8);
  }
  return out;
});

export const MILLS = [];
for (let r = 0; r < 3; r++) for (const [a, b, c] of [[0, 1, 2], [2, 3, 4], [4, 5, 6], [6, 7, 0]]) MILLS.push([r * 8 + a, r * 8 + b, r * 8 + c]);
for (const i of [1, 3, 5, 7]) MILLS.push([i, i + 8, i + 16]);

/** Whether the piece on `p` is in a mill. */
export function inMill(board, p) {
  const who = board[p];
  return who !== 0 && MILLS.some((m) => m.includes(p) && m.every((q) => board[q] === who));
}

/** The pieces of `who` that can be taken: any not in a mill (or any at all, if every one is). */
export function takeable(board, who) {
  const mine = board.map((v, p) => (v === who ? p : -1)).filter((p) => p >= 0);
  const free = mine.filter((p) => !inMill(board, p));
  return free.length ? free : mine;
}

/** Every action of `slot`: { at } to place, { from, to } to move (flying when down to three). */
export function actions(board, inHand, slot) {
  const who = slot + 1;
  const empty = board.map((v, p) => (v === 0 ? p : -1)).filter((p) => p >= 0);
  if (inHand[slot] > 0) return empty.map((at) => ({ at }));
  const mine = board.map((v, p) => (v === who ? p : -1)).filter((p) => p >= 0);
  const flying = mine.length === 3;
  const out = [];
  for (const from of mine) for (const to of flying ? empty : NEIGHBOURS[from].filter((q) => board[q] === 0)) out.push({ from, to });
  return out;
}

export class Morris {
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
    this.winner = null;
    this.starter = null;
    this.newRound();
  }

  newRound() {
    this.round++;
    this.board = new Array(24).fill(0);
    this.inHand = [PIECES, PIECES];
    this.starter = this.starter === null ? 0 : 1 - this.starter;
    this.turn = this.starter;
    this.step = 'act'; // or 'take' (a mill was made: take one of theirs)
    this.quiet = 0; // moves since a mill, once everything's placed
    this.last = null; // { by, at?, from?, to?, mill?, took? , n }
    this.mill = null; // the mill just made (for the screens)
    this.n = 0;
    this.result = null;
    this.phase = 'play';
    this.startTurn();
  }

  count(slot) {
    return this.board.filter((v) => v === slot + 1).length;
  }

  startTurn() {
    this.clearTimer();
    if (this.step === 'act') {
      const s = this.turn;
      // Fewer than three (all placed), or nothing to move: lost.
      if (this.inHand[s] === 0 && this.count(s) < 3) return this.endRound(1 - s, 'pieces');
      if (!actions(this.board, this.inHand, s).length) return this.endRound(1 - s, 'blocked');
    }
    this.turnEnds = this.clock ? this.ctx.now() + TIMING.turnMs : null;
    this.ctx.update();
    if (this.clock) this.timer = this.ctx.setTimeout(() => { this.timer = null; this.turnTimeUp(); }, TIMING.turnMs);
  }

  /** Out of time: a move (or the piece to take) is picked for you. */
  turnTimeUp() {
    const s = this.turn;
    if (this.step === 'take') {
      const list = takeable(this.board, 2 - s);
      return this.take(s, list[Math.floor(this.rng() * list.length)]);
    }
    const list = actions(this.board, this.inHand, s);
    this.act(s, list[Math.floor(this.rng() * list.length)]);
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  resumed(downMs = 0) {
    this.timer = null;
    if (this.phase === 'play' && this.turnEnds) {
      this.turnEnds += downMs;
      this.timer = this.ctx.setTimeout(() => { this.timer = null; this.turnTimeUp(); }, Math.max(0, this.turnEnds - this.ctx.now()));
    } else if (this.phase === 'roundEnd') {
      this.timer = this.ctx.setTimeout(() => { this.timer = null; this.newRound(); }, TIMING.gameEndMs);
    }
  }

  act(slot, a) {
    const who = slot + 1;
    let p;
    if (a.at !== undefined) {
      this.board[a.at] = who;
      this.inHand[slot]--;
      p = a.at;
    } else {
      this.board[a.from] = 0;
      this.board[a.to] = who;
      p = a.to;
    }
    this.n++;
    this.last = { ...a, by: slot, n: this.n };
    const made = MILLS.find((m) => m.includes(p) && m.every((q) => this.board[q] === who));
    this.mill = made || null;
    if (made) {
      this.last.mill = true;
      this.quiet = 0;
      this.step = 'take';
      return this.startTurn();
    }
    if (!this.inHand[0] && !this.inHand[1] && ++this.quiet >= QUIET_DRAW) return this.endRound(null, 'quiet');
    this.turn = 1 - slot;
    this.startTurn();
  }

  take(slot, p) {
    this.board[p] = 0;
    this.last = { ...this.last, took: p };
    this.step = 'act';
    this.mill = null;
    this.turn = 1 - slot;
    this.startTurn();
  }

  endRound(winner, how) {
    this.clearTimer();
    this.result = { winner, how };
    this.turnEnds = null;
    if (winner !== null) this.scores[winner]++;
    if (winner !== null && this.scores[winner] >= this.winScore) {
      this.winner = winner;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'roundEnd';
    this.ctx.update();
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this.newRound(); }, TIMING.gameEndMs);
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play' || slot !== this.turn) return;
    const ok = (p) => Number.isInteger(p) && p >= 0 && p < 24;
    if (this.step === 'take') {
      if (input.type === 'take' && ok(input.at) && takeable(this.board, 2 - slot).includes(input.at)) this.take(slot, input.at);
      return;
    }
    const list = actions(this.board, this.inHand, slot);
    if (input.type === 'place' && ok(input.at)) {
      const a = list.find((x) => x.at === input.at);
      if (a) this.act(slot, a);
    } else if (input.type === 'move' && ok(input.from) && ok(input.to)) {
      const a = list.find((x) => x.from === input.from && x.to === input.to);
      if (a) this.act(slot, a);
    }
  }

  view() {
    const s = this.turn;
    const playing = this.phase === 'play';
    return {
      phase: this.phase,
      round: this.round,
      board: this.board,
      inHand: this.inHand,
      counts: [this.count(0), this.count(1)],
      turn: this.turn,
      step: this.step,
      stage: this.inHand[s] > 0 ? 'place' : this.count(s) === 3 ? 'fly' : 'move',
      actions: playing && this.step === 'act' ? actions(this.board, this.inHand, s) : [],
      takeable: playing && this.step === 'take' ? takeable(this.board, 2 - s) : [],
      mill: this.mill,
      last: this.last,
      quiet: this.quiet,
      result: this.result,
      scores: this.scores,
      winScore: this.winScore,
      timeLeftMs: playing && this.turnEnds ? Math.max(0, this.turnEnds - this.ctx.now()) : 0,
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
  id: 'morris',
  category: 'board',
  handheld: true,
  music: 'thinking',
  name: "Nine Men's Morris",
  tagline: 'Place your nine pieces, then slide them. Three in a line (a mill) takes one of theirs. Leave them with two.',
  create: (ctx) => new Morris(ctx),
};
