// Chess. The full game (castling, en passant, promotion), checkmate to win; stalemate, threefold
// repetition, the fifty-move rule and too little left to mate are draws. Each of you has a chess
// clock (run out and you lose, unless the other has too little to mate: then it's a draw), and you
// can resign. Colours swap each game; first to the games needed.

import { settingOf } from './options.js';
import { startPosition, legalMoves, makeMove, inCheck, kingSquare, keyOf, insufficient, san } from './chess-rules.js';

export const MINUTES = 10;
export const WIN_SCORE = 1;
export const TIMING = { gameEndMs: 6000 };

export class Chess {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.minutes = settingOf(ctx, 'minutes', MINUTES); // 0: no clock
    this.winScore = settingOf(ctx, 'wins', WIN_SCORE);
    this.timer = null;
  }

  start() {
    this.clearTimer();
    this.scores = [0, 0];
    this.gameNo = 0;
    this.winner = null;
    this.whiteSlot = 1;
    this.newGame();
  }

  newGame() {
    this.clearTimer();
    this.gameNo++;
    this.whiteSlot = 1 - this.whiteSlot;
    this.pos = startPosition();
    this.seen = { [keyOf(this.pos)]: 1 };
    this.moves = []; // SAN, in order
    this.last = null; // { from, to }
    this.captured = { w: [], b: [] }; // pieces taken from white, from black
    this.result = null;
    this.banks = [this.minutes * 60000, this.minutes * 60000];
    this.phase = 'play';
    this.startTurn();
  }

  slotOf(colour) {
    return colour === 'w' ? this.whiteSlot : 1 - this.whiteSlot;
  }

  get turnSlot() {
    return this.slotOf(this.pos.turn);
  }

  // ---- the clock ------------------------------------------------------------------------

  startTurn() {
    this.legal = legalMoves(this.pos);
    this.turnStart = this.ctx.now();
    this.clearTimer();
    if (this.minutes) {
      const s = this.turnSlot;
      this.timer = this.ctx.setTimeout(() => { this.timer = null; this.flag(); }, Math.max(0, this.banks[s]));
    }
    this.ctx.update();
  }

  /** Out of time: you lose, unless the other has too little left to mate. */
  flag() {
    const s = this.turnSlot;
    this.banks[s] = 0;
    const other = this.pos.turn === 'w' ? 'b' : 'w';
    const theirs = this.pos.board.map((p) => (p !== '' && (p === p.toUpperCase() ? 'w' : 'b') === other ? p : ''));
    this.endGame(insufficient(theirs) ? null : 1 - s, insufficient(theirs) ? 'time-draw' : 'time');
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Picked up after a restart: the clock of whoever was thinking runs on from where it was. */
  resumed(downMs = 0) {
    this.timer = null;
    if (this.phase === 'play') {
      this.turnStart += downMs;
      if (this.minutes) {
        const s = this.turnSlot;
        const left = this.banks[s] - (this.ctx.now() - this.turnStart);
        this.timer = this.ctx.setTimeout(() => { this.timer = null; this.flag(); }, Math.max(0, left));
      }
    } else if (this.phase === 'gameEnd') {
      this.timer = this.ctx.setTimeout(() => { this.timer = null; this.newGame(); }, TIMING.gameEndMs);
    }
  }

  // ---- moves -------------------------------------------------------------------------------

  play(slot, m) {
    const before = this.pos;
    this.banks[slot] -= this.ctx.now() - this.turnStart;
    this.moves.push(san(before, m, this.legal));
    this.pos = makeMove(before, m);
    if (this.pos.captured) this.captured[before.turn === 'w' ? 'b' : 'w'].push(this.pos.captured);
    this.last = { from: m.from, to: m.to };
    const key = keyOf(this.pos);
    this.seen[key] = (this.seen[key] || 0) + 1;
    const replies = legalMoves(this.pos);
    if (!replies.length) return this.endGame(inCheck(this.pos) ? slot : null, inCheck(this.pos) ? 'mate' : 'stalemate');
    if (this.seen[key] >= 3) return this.endGame(null, 'repetition');
    if (this.pos.half >= 100) return this.endGame(null, 'fifty');
    if (insufficient(this.pos.board)) return this.endGame(null, 'material');
    this.startTurn();
  }

  endGame(winner, how) {
    this.clearTimer();
    this.result = { winner, how };
    this.legal = [];
    if (winner !== null) this.scores[winner]++;
    if (winner !== null && this.scores[winner] >= this.winScore) {
      this.winner = winner;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'gameEnd';
    this.ctx.update();
    this.timer = this.ctx.setTimeout(() => { this.timer = null; this.newGame(); }, TIMING.gameEndMs);
  }

  onInput(slot, input) {
    if (!input || (slot !== 0 && slot !== 1)) return;
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play') return;
    if (input.type === 'resign') {
      if (this.minutes && slot === this.turnSlot) this.banks[slot] -= this.ctx.now() - this.turnStart;
      return this.endGame(1 - slot, 'resign');
    }
    if (input.type !== 'move' || slot !== this.turnSlot) return;
    const { from, to } = input;
    if (!Number.isInteger(from) || !Number.isInteger(to)) return;
    if (input.promo !== undefined && !['q', 'r', 'b', 'n'].includes(input.promo)) return;
    // (a pawn reaching the end becomes what was picked, a queen if nothing was)
    const m = this.legal.find((x) => x.from === from && x.to === to && (!x.promo || x.promo === (input.promo || 'q')));
    if (!m) return;
    this.play(slot, m);
  }

  // ---- views -------------------------------------------------------------------------------

  view() {
    const ticking = this.phase === 'play' && this.minutes ? this.turnSlot : null;
    const banks = this.banks.map((b, s) => Math.max(0, s === ticking ? b - (this.ctx.now() - this.turnStart) : b));
    return {
      phase: this.phase,
      game: this.gameNo,
      board: this.pos.board,
      turn: this.pos.turn,
      castle: this.pos.castle,
      ep: this.pos.ep,
      half: this.pos.half,
      turnSlot: this.turnSlot,
      whiteSlot: this.whiteSlot,
      legal: this.phase === 'play' ? this.legal.map((m) => (m.promo ? { from: m.from, to: m.to, promo: m.promo } : { from: m.from, to: m.to })) : [],
      last: this.last,
      check: this.phase !== 'over' && inCheck(this.pos) ? kingSquare(this.pos.board, this.pos.turn) : -1,
      captured: this.captured,
      moves: this.moves.slice(-16),
      moveCount: this.moves.length,
      banks,
      ticking,
      timed: Boolean(this.minutes),
      result: this.result,
      scores: this.scores,
      winScore: this.winScore,
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
  id: 'chess',
  category: 'board',
  handheld: true,
  music: 'thinking',
  name: 'Chess',
  tagline: 'The full game on the TV and your phone, with a chess clock each. Checkmate to win.',
  create: (ctx) => new Chess(ctx),
};
