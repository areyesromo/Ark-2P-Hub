// FreeCell. All 52 cards are dealt face up into eight columns. Build the
// four foundations up by suit from ace to king. In the columns, cards go down
// in alternating colours; any card can go into an empty column. The four
// free cells each hold one card for a while. You can move a run of cards
// at once if there's room to do it one card at a time: (free cells + 1),
// doubled for each empty column. Nearly every deal can be won. Score: the
// time to finish (lower is better); a game you give up on doesn't count.

import { lookOf } from './looks.js';

const SUITS = ['s', 'h', 'd', 'c'];
const red = (c) => c.s === 'h' || c.s === 'd';
const code = (c) => c.s + c.r;
const MAX_UNDO = 300;

export const PILES = ['c0', 'c1', 'c2', 'c3', 'f0', 'f1', 'f2', 'f3', 't0', 't1', 't2', 't3', 't4', 't5', 't6', 't7'];

/** Does card b go on card a in a column (one lower, the other colour)? */
const onto = (a, b) => red(a) !== red(b) && a.r === b.r + 1;

export class FreeCell {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
    this.look = lookOf(ctx, 'freecell');
  }

  start() {
    const deck = [];
    for (const s of SUITS) for (let r = 1; r <= 13; r++) deck.push({ s, r });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    // Dealt in turn across the eight columns: four of 7 cards, four of 6.
    this.tab = Array.from({ length: 8 }, () => []);
    deck.forEach((c, i) => this.tab[i % 8].push(c));
    this.cells = [null, null, null, null];
    this.found = [[], [], [], []];
    this.history = [];
    this.moves = 0;
    this.nope = 0; // moves that couldn't happen, so the screens can shake
    this.startedAt = this.ctx.now();
    this.endedAt = null;
    this.phase = 'play';
    this.clock();
    this.ctx.update();
  }

  /** One update a second keeps the clock moving on screen between moves. */
  clock() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      if (this.phase !== 'play') return;
      this.ctx.update();
      this.clock();
    }, 1000);
  }

  snapshot() {
    this.history.push(JSON.stringify({ tab: this.tab, cells: this.cells, found: this.found }));
    if (this.history.length > MAX_UNDO) this.history.shift();
  }

  undo() {
    const last = this.history.pop();
    if (!last) return false;
    Object.assign(this, JSON.parse(last));
    this.moves++;
    return true;
  }

  /** The most cards that can move at once to `to`: (free cells + 1) × 2 for each empty column (not counting `to`). */
  maxRun(to) {
    const freeCells = this.cells.filter((c) => !c).length;
    const empty = this.tab.filter((col, n) => !col.length && 't' + n !== to).length;
    return (freeCells + 1) * 2 ** empty;
  }

  /** The cards a move would take: one card, or from a column an ordered run starting at index. */
  taking(from, index) {
    if (from[0] === 'c') return this.cells[Number(from[1])] ? { start: 0, cards: [this.cells[Number(from[1])]] } : null;
    if (from[0] === 'f') {
      const f = this.found[Number(from[1])];
      return f.length ? { start: f.length - 1, cards: [f[f.length - 1]] } : null;
    }
    const col = this.tab[Number(from[1])];
    if (!col.length) return null;
    const start = index === undefined ? col.length - 1 : index;
    if (!Number.isInteger(start) || start < 0 || start >= col.length) return null;
    for (let i = start; i < col.length - 1; i++) if (!onto(col[i], col[i + 1])) return null; // not a run
    return { start, cards: col.slice(start) };
  }

  fits(cards, to) {
    const c = cards[0];
    if (to[0] === 'c') return cards.length === 1 && !this.cells[Number(to[1])];
    if (to[0] === 'f') {
      const f = this.found[Number(to[1])];
      const top = f[f.length - 1];
      return cards.length === 1 && (top ? top.s === c.s && top.r === c.r - 1 : c.r === 1);
    }
    const col = this.tab[Number(to[1])];
    if (cards.length > this.maxRun(to)) return false;
    return !col.length || onto(col[col.length - 1], c);
  }

  move(from, index, to) {
    if (from === to) return false;
    const t = this.taking(from, index);
    if (!t || !this.fits(t.cards, to)) return false;
    this.snapshot();
    if (from[0] === 'c') this.cells[Number(from[1])] = null;
    else if (from[0] === 'f') this.found[Number(from[1])].pop();
    else this.tab[Number(from[1])].splice(t.start);
    if (to[0] === 'c') this.cells[Number(to[1])] = t.cards[0];
    else if (to[0] === 'f') this.found[Number(to[1])].push(t.cards[0]);
    else this.tab[Number(to[1])].push(...t.cards);
    this.moves++;
    this.checkWin();
    return true;
  }

  /**
   * One tap: send a card (or a run) where it can go: a single card home
   * first, then onto a column, then an empty column, then a free cell.
   */
  smart(from, index) {
    const t = this.taking(from, index);
    if (!t) return false;
    if (t.cards.length === 1 && from[0] !== 'f') for (let f = 0; f < 4; f++) if (this.move(from, index, 'f' + f)) return true;
    const cols = this.tab.map((_, n) => 't' + n).filter((n) => n !== from);
    for (const to of cols) if (this.tab[Number(to[1])].length && this.move(from, index, to)) return true;
    // A whole column moving to an empty one gains nothing.
    const wholeColumn = from[0] === 't' && t.start === 0;
    if (!wholeColumn) for (const to of cols) if (!this.tab[Number(to[1])].length && this.move(from, index, to)) return true;
    if (t.cards.length === 1 && from[0] === 't') for (let c = 0; c < 4; c++) if (this.move(from, index, 'c' + c)) return true;
    return false;
  }

  /** Every column in order (each card on the one it goes on): the rest can go home by itself. */
  get canFinish() {
    return this.phase === 'play' && this.tab.every((col) => col.every((c, i) => i === 0 || onto(col[i - 1], c)));
  }

  finish() {
    if (!this.canFinish) return false;
    this.snapshot();
    const tops = () => [...this.cells.map((c, i) => (c ? { pile: 'c' + i, card: c } : null)), ...this.tab.map((col, n) => (col.length ? { pile: 't' + n, card: col[col.length - 1] } : null))].filter(Boolean);
    let moved = true;
    while (moved && this.phase === 'play') {
      moved = false;
      for (const { pile, card } of tops()) {
        const f = this.found.findIndex((fd) => (fd.length ? fd[fd.length - 1].s === card.s && fd[fd.length - 1].r === card.r - 1 : card.r === 1));
        if (f === -1) continue;
        if (pile[0] === 'c') this.cells[Number(pile[1])] = null;
        else this.tab[Number(pile[1])].pop();
        this.found[f].push(card);
        this.moves++;
        moved = true;
      }
      this.checkWin();
    }
    return true;
  }

  checkWin() {
    if (this.found.every((f) => f.length === 13)) {
      this.phase = 'over';
      this.endedAt = this.ctx.now();
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
    }
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (input.type === 'give-up' && this.phase === 'play') {
      this.endedAt = this.ctx.now();
      this.phase = 'over';
      if (this.timer) this.ctx.clearTimeout(this.timer);
      this.timer = null;
      return this.ctx.update();
    }
    if (this.phase !== 'play') return;
    const okPile = (p) => typeof p === 'string' && PILES.includes(p);
    const okIndex = (i) => i === undefined || Number.isInteger(i);
    let changed;
    if (input.type === 'undo') changed = this.undo();
    else if (input.type === 'finish') changed = this.finish();
    else if (input.type === 'move' && okPile(input.from) && okPile(input.to) && okIndex(input.index)) changed = this.move(input.from, input.index, input.to);
    else if (input.type === 'smart' && okPile(input.from) && okIndex(input.index)) changed = this.smart(input.from, input.index);
    else return;
    // A move that couldn't happen still gets an answer, so the screen can say so.
    if (!changed && (input.type === 'move' || input.type === 'smart')) this.nope++;
    this.ctx.update();
  }

  get elapsed() {
    return (this.endedAt !== null ? this.endedAt : this.ctx.now()) - this.startedAt;
  }

  view() {
    const won = this.phase === 'over' && this.found.every((f) => f.length === 13);
    return {
      look: this.look,
      phase: this.phase,
      tab: this.tab.map((col) => col.map(code)),
      cells: this.cells.map((c) => (c ? code(c) : null)),
      found: this.found.map((f) => (f.length ? code(f[f.length - 1]) : null)),
      foundCount: this.found.reduce((a, f) => a + f.length, 0),
      canFinish: this.canFinish,
      canUndo: this.history.length > 0,
      nope: this.nope,
      moves: this.moves,
      elapsed: this.elapsed,
      won,
      score: won ? this.elapsed : null,
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
  id: 'freecell',
  name: 'FreeCell',
  tagline: 'Every card face up, four free cells to juggle with. Nearly every deal can be won.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'time' },
  create: (ctx) => new FreeCell(ctx, ctx.rng),
};
