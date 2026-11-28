// Word Tiles: make words with letter tiles on an 11 x 11 board. You each draw 7 tiles from the bag
// (your rack is secret, on your phone). On your turn lay tiles in one line, across or down, so that
// every run of two or more letters they make (the word along the line, and any they cross) is a
// real word; the first word covers the middle square, and after that every word joins on to the
// ones already down. Score each letter's value, doubled or tripled on a letter bonus square, then
// the word doubled or tripled on a word bonus square (bonus squares count only when you cover them).
// Play all seven tiles at once for 25 more. Then draw back up to seven. Instead of playing you may
// swap tiles (while the bag has 7 or more) or pass. The game ends when the bag is empty and one of
// you has played every tile (they get the other's leftover tiles' value; the other loses it), or
// after six turns in a row with no score. Highest score wins. Out of time: you pass.

import { settingOf } from './options.js';
import { N, RACK, POINTS, newBag, checkPlay } from './word-tiles-rules.js';

export const WIN_SCORE = 1;
export const TIMING = { turnMs: 120000, playedMs: 2500, gameEndMs: 7000 };
export const SCORELESS_END = 6;

export class WordTiles {
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

  newRound() {
    this.clearTimer();
    this.round++;
    this.starter = 1 - this.starter;
    this.bag = newBag(this.rng);
    this.board = new Array(N * N).fill(null);
    this.racks = [this.bag.splice(-RACK), this.bag.splice(-RACK)];
    this.points = [0, 0];
    this.scoreless = 0;
    this.lastPlay = null; // { by, kind: 'play' | 'swap' | 'pass', words, score, cells, n }
    this.rejected = [null, null]; // { reason, n }: your last play that didn't go (yours alone)
    this.n = 0;
    this.result = null;
    this.turn = this.starter;
    this.phase = 'play';
    this.armTurn();
  }

  armTurn() {
    this.deadline = this.clock ? this.ctx.now() + TIMING.turnMs : null;
    this.arm(TIMING.turnMs, 'turnTimeUp');
  }

  turnTimeUp() {
    this.pass(this.turn, true);
  }

  refill(s) {
    while (this.racks[s].length < RACK && this.bag.length) this.racks[s].push(this.bag.pop());
  }

  play(s, tiles) {
    const res = checkPlay(this.board, tiles);
    if (res.error) {
      this.rejected[s] = { reason: res.error, n: ++this.n };
      return this.ctx.update();
    }
    for (const t of tiles) {
      this.board[t.cell] = t.letter;
      this.racks[s].splice(this.racks[s].indexOf(t.letter), 1);
    }
    this.points[s] += res.score;
    this.refill(s);
    this.scoreless = 0;
    this.rejected[s] = null;
    this.lastPlay = { by: s, kind: 'play', words: res.words.map((w) => ({ word: w.word, score: w.score })), score: res.score, cells: tiles.map((t) => t.cell), n: ++this.n };
    if (!this.racks[s].length && !this.bag.length) return this.finish(s);
    this.next();
  }

  swap(s, letters) {
    const rack = this.racks[s].slice();
    for (const l of letters) {
      const i = rack.indexOf(l);
      if (i < 0) return;
      rack.splice(i, 1);
    }
    // The new tiles first, then the old ones go back in the bag.
    const fresh = this.bag.splice(-letters.length);
    this.racks[s] = rack.concat(fresh);
    this.bag.push(...letters);
    for (let i = this.bag.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
    }
    this.scoreless++;
    this.lastPlay = { by: s, kind: 'swap', count: letters.length, n: ++this.n };
    this.next();
  }

  pass(s, late) {
    this.scoreless++;
    this.lastPlay = { by: s, kind: 'pass', late: !!late, n: ++this.n };
    this.next();
  }

  next() {
    if (this.scoreless >= SCORELESS_END) return this.finish(null);
    this.turn = 1 - this.turn;
    this.phase = 'played';
    this.deadline = null;
    this.arm(TIMING.playedMs, 'resume');
  }

  resume() {
    this.phase = 'play';
    this.armTurn();
  }

  /** The end: leftover tiles count against their owner (and for whoever went out). */
  finish(out) {
    this.clearTimer();
    this.deadline = null;
    const left = this.racks.map((r) => r.reduce((t, l) => t + POINTS[l], 0));
    for (const s of [0, 1]) this.points[s] -= left[s];
    if (out !== null) this.points[out] += left[1 - out];
    const [a, b] = this.points;
    const w = a === b ? null : a > b ? 0 : 1;
    if (w !== null) this.scores[w]++;
    this.result = { winner: w, points: this.points.slice(), left, out };
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
    if (this.phase !== 'play' || slot !== this.turn) return;
    if (input.type === 'pass') return this.pass(slot);
    if (input.type === 'swap' && Array.isArray(input.letters) && input.letters.length >= 1 && input.letters.length <= RACK && this.bag.length >= RACK) {
      if (!input.letters.every((l) => typeof l === 'string' && /^[a-z]$/.test(l))) return;
      return this.swap(slot, input.letters);
    }
    if (input.type === 'play' && Array.isArray(input.tiles) && input.tiles.length >= 1 && input.tiles.length <= RACK) {
      const tiles = input.tiles;
      if (!tiles.every((t) => t && Number.isInteger(t.cell) && t.cell >= 0 && t.cell < N * N && typeof t.letter === 'string' && /^[a-z]$/.test(t.letter))) return;
      // The letters must be on your rack.
      const rack = this.racks[slot].slice();
      for (const t of tiles) {
        const i = rack.indexOf(t.letter);
        if (i < 0) return;
        rack.splice(i, 1);
      }
      this.play(slot, tiles.map((t) => ({ cell: t.cell, letter: t.letter })));
    }
  }

  view(viewer) {
    return {
      phase: this.phase,
      round: this.round,
      n: this.n,
      size: N,
      board: this.board,
      rack: viewer === null ? null : this.racks[viewer],
      rackSizes: this.racks.map((r) => r.length),
      bag: this.bag.length,
      points: this.points,
      lastPlay: this.lastPlay,
      rejected: viewer === null ? null : this.rejected[viewer],
      scoreless: this.scoreless,
      turn: this.turn,
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
  id: 'word-tiles',
  category: 'board',
  phoneOnly: true, // (your tiles are secret)
  handheld: true,
  music: 'thinking',
  name: 'Word Tiles',
  tagline: 'Make words with your seven letter tiles on a board of bonus squares, crossing the words already down. Highest score wins.',
  create: (ctx) => new WordTiles(ctx),
};
