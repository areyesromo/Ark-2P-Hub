// Hidden Ranks: two armies, each piece's rank hidden from the other. An 8 x 8 board with two lakes
// in the middle; your 16 pieces start on your two back rows, set out as you like (in secret, on
// your phone). Ranks: 10 (the highest), 9, 7, 6, 5, 4, two 3s (miners), three 2s (scouts), the 1
// (the spy), three bombs and your flag. Take turns moving one piece one square, up, down or across
// (never into a lake); a scout may run any distance in a straight line. Bombs and the flag never
// move. Move onto one of theirs to attack: both are shown, and the lower rank is taken (equal: both
// go). The spy takes the 10, but only when the spy attacks. A bomb takes anything that attacks it,
// except a miner, which clears it. Take their flag, or leave them nothing that can move, to win.
// A piece may not shuttle back and forth between the same two squares more than three times in a
// row. After 200 moves each, the bigger army left wins. Who starts swaps every game; first to the
// games needed. Out of time setting out: your army goes as it stands; out of time moving: your
// turn's lost.

import { settingOf } from './options.js';

export const N = 8;
export const WIN_SCORE = 1;
export const MOVE_CAP = 200; // each
export const TIMING = { setupMs: 90000, turnMs: 30000, fightMs: 1800, gameEndMs: 6000 };
export const ARMY = [10, 9, 7, 6, 5, 4, 3, 3, 2, 2, 2, 1, 'B', 'B', 'B', 'F'];
export const LAKES = [[3, 1], [3, 2], [4, 1], [4, 2], [3, 5], [3, 6], [4, 5], [4, 6]].map(([r, c]) => r * N + c);
// What a piece is worth (for the move cap's count, and the computer).
export const VALUE = { 10: 10, 9: 8, 7: 6, 6: 5, 5: 4, 4: 3, 3: 3.5, 2: 2, 1: 4, B: 2, F: 0 };

/** The rows a player sets out on: player 1 the bottom two, player 2 the top two. */
export const homeRows = (s) => (s === 0 ? [N - 2, N - 1] : [0, 1]);
export const homeCells = (s) => homeRows(s).flatMap((r) => Array.from({ length: N }, (_, c) => r * N + c));
export const movable = (rank) => rank !== 'B' && rank !== 'F';

/** Who wins when `a` attacks `d`: 'a', 'd' or 'both'. */
export function fight(a, d) {
  if (d === 'F') return 'a';
  if (d === 'B') return a === 3 ? 'a' : 'd';
  if (a === 1 && d === 10) return 'a';
  if (a === d) return 'both';
  return a > d ? 'a' : 'd';
}

/**
 * The squares a piece at `cell` can move to: one step, or (a scout) a run in a straight line, ending
 * on an empty square or an enemy (an attack). `board[c]`: { s, rank } or null.
 */
export function targets(board, cell) {
  const p = board[cell];
  if (!p || !movable(p.rank)) return [];
  const r0 = Math.floor(cell / N);
  const c0 = cell % N;
  const out = [];
  for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    for (let k = 1; k < N; k++) {
      const r = r0 + dr * k;
      const c = c0 + dc * k;
      if (r < 0 || c < 0 || r >= N || c >= N) break;
      const t = r * N + c;
      if (LAKES.includes(t)) break;
      const q = board[t];
      if (q && q.s === p.s) break;
      out.push(t);
      if (q || p.rank !== 2) break; // (only a scout runs on, and it stops at an enemy)
    }
  }
  return out;
}

export class HiddenRanks {
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

  shuffled(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  newRound() {
    this.clearTimer();
    this.round++;
    this.starter = 1 - this.starter;
    // Each player's arrangement: ranks for their home cells in order (a random start to edit).
    this.setups = [this.shuffled(ARMY), this.shuffled(ARMY)];
    this.ready = [false, false];
    this.edits = [0, 0]; // (how often each has rearranged: out in the open, the ranks aren't)
    this.board = null;
    this.moved = [0, 0];
    this.lastMove = null; // { by, from, to, fight: { a, d, result } }
    this.shuttle = [null, null]; // { from, to, count } a piece going back and forth
    this.n = 0;
    this.taken = [[], []]; // ranks each has lost (out in the open)
    this.result = null;
    this.turn = null;
    this.phase = 'deploy';
    this.deadline = this.clock ? this.ctx.now() + TIMING.setupMs : null;
    this.arm(TIMING.setupMs, 'setupTimeUp');
  }

  setupTimeUp() {
    this.ready = [true, true];
    this.begin();
  }

  begin() {
    this.clearTimer();
    this.board = new Array(N * N).fill(null);
    let id = 0;
    for (const s of [0, 1]) homeCells(s).forEach((cell, i) => { this.board[cell] = { s, rank: this.setups[s][i], id: id++, shown: false, moved: false }; });
    this.phase = 'play';
    this.turn = this.starter;
    this.armTurn();
  }

  armTurn() {
    this.deadline = this.clock ? this.ctx.now() + TIMING.turnMs : null;
    this.arm(TIMING.turnMs, 'turnTimeUp');
  }

  turnTimeUp() {
    this.lastMove = { by: this.turn, missed: true, n: ++this.n };
    this.moved[this.turn]++;
    this.next();
  }

  /** Every move player `s` may make: [from, to] (the back-and-forth rule applied). */
  movesOf(s) {
    const out = [];
    this.board.forEach((p, cell) => {
      if (!p || p.s !== s) return;
      for (const t of targets(this.board, cell)) {
        const sh = this.shuttle[s];
        if (sh && sh.count >= 3 && sh.at === cell && t === sh.back) continue;
        out.push([cell, t]);
      }
    });
    return out;
  }

  move(s, from, to) {
    const p = this.board[from];
    const q = this.board[to];
    // The back-and-forth count: the same piece straight back to where it came from.
    const sh = this.shuttle[s];
    if (sh && sh.at === from && sh.back === to) this.shuttle[s] = { at: to, back: from, count: sh.count + 1 };
    else this.shuttle[s] = { at: to, back: from, count: 1 };
    p.moved = true;
    this.board[from] = null;
    let fought = null;
    if (q) {
      const result = fight(p.rank, q.rank);
      fought = { a: p.rank, d: q.rank, result };
      p.shown = true;
      q.shown = true;
      if (result === 'a') { this.board[to] = p; this.taken[q.s].push(q.rank); } else if (result === 'd') this.taken[p.s].push(p.rank);
      else { this.board[to] = null; this.taken[p.s].push(p.rank); this.taken[q.s].push(q.rank); }
      if (result === 'a' && q.rank === 'F') {
        this.lastMove = { by: s, from, to, fight: fought, n: ++this.n };
        return this.endRound(s, 'flag');
      }
    } else this.board[to] = p;
    this.moved[s]++;
    this.lastMove = { by: s, from, to, fight: fought, n: ++this.n };
    this.next();
  }

  next() {
    const o = 1 - this.turn;
    if (!this.movesOf(o).length) return this.endRound(this.turn, 'stuck');
    if (this.moved[0] >= MOVE_CAP && this.moved[1] >= MOVE_CAP) {
      const army = [0, 1].map((s) => this.board.reduce((t, p) => t + (p && p.s === s ? VALUE[p.rank] : 0), 0));
      return this.endRound(army[0] === army[1] ? null : army[0] > army[1] ? 0 : 1, 'moves');
    }
    this.turn = o;
    if (this.lastMove && this.lastMove.fight) {
      // A pause so everyone can see the fight.
      this.phase = 'fight';
      this.deadline = null;
      return this.arm(TIMING.fightMs, 'afterFight');
    }
    this.armTurn();
  }

  afterFight() {
    this.phase = 'play';
    this.armTurn();
  }

  endRound(w, how) {
    this.clearTimer();
    this.deadline = null;
    if (w !== null) this.scores[w]++;
    this.result = { winner: w, how };
    this.turn = null;
    if (w !== null && this.scores[w] >= this.winScore) {
      this.winner = w;
      this.phase = 'over';
      return this.ctx.update();
    }
    this.phase = 'roundEnd';
    this.arm(TIMING.gameEndMs, 'newRound');
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
    if (this.phase === 'deploy') {
      if (this.ready[slot]) return;
      if (input.type === 'swap' && [input.a, input.b].every((i) => Number.isInteger(i) && i >= 0 && i < ARMY.length)) {
        const st = this.setups[slot];
        [st[input.a], st[input.b]] = [st[input.b], st[input.a]];
        this.edits[slot]++;
        return this.ctx.update();
      }
      if (input.type === 'shuffle') { this.setups[slot] = this.shuffled(ARMY); this.edits[slot]++; return this.ctx.update(); }
      if (input.type === 'arrange' && Array.isArray(input.ranks) && input.ranks.length === ARMY.length) {
        // A whole arrangement at once (the computer's): it must be the same army.
        const key = (a) => a.map(String).sort().join();
        if (key(input.ranks) !== key(ARMY)) return;
        this.setups[slot] = input.ranks.slice();
        this.edits[slot]++;
        return this.ctx.update();
      }
      if (input.type === 'ready') {
        this.ready[slot] = true;
        if (this.ready[0] && this.ready[1]) return this.begin();
        return this.ctx.update();
      }
      return;
    }
    if (input.type !== 'move' || this.phase !== 'play' || slot !== this.turn) return;
    const { from, to } = input;
    if (!this.movesOf(slot).some(([a, b]) => a === from && b === to)) return;
    this.move(slot, from, to);
  }

  view(viewer) {
    const open = this.phase === 'over' || this.phase === 'roundEnd';
    return {
      phase: this.phase,
      round: this.round,
      n: N,
      lakes: LAKES,
      // The board: your own pieces' ranks; theirs only once shown in a fight (or the game's over).
      board: this.board ? this.board.map((p) => (p ? { s: p.s, id: p.id, moved: p.moved, shown: p.shown, rank: open || p.shown || p.s === viewer ? p.rank : null } : null)) : null,
      setup: viewer === null ? null : this.setups[viewer],
      ready: this.ready,
      edits: this.edits,
      taken: this.taken,
      turn: this.turn,
      lastMove: this.lastMove,
      moves: this.phase === 'play' && viewer === this.turn ? this.movesOf(viewer) : [],
      moved: this.moved,
      moveCap: MOVE_CAP,
      result: this.result,
      scores: this.scores,
      winScore: this.winScore,
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
  id: 'hidden-ranks',
  category: 'board',
  phoneOnly: true, // (your ranks are secret)
  handheld: true,
  music: 'thinking',
  name: 'Hidden Ranks',
  tagline: 'Two armies, ranks hidden. Attack to find out who\'s stronger; the spy takes the 10, miners clear bombs. Capture the flag.',
  create: (ctx) => new HiddenRanks(ctx),
};
