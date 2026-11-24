// Solitaire (Klondike). Build the four foundations up by suit from ace to
// king. In the seven columns, cards go down in alternating colours (a red 9
// on a black 10) and you can move a run of face-up cards together; only a
// king goes into an empty column. Turn cards from the stock one or three at
// a time; when it runs out, the pile turns over and you go through again.
// Undo as much as you like. Score: the time to finish (lower is better), per
// draw-1 or draw-3; a game you can't finish doesn't count.

import { settingOf } from './options.js';
import { lookOf } from './looks.js';

const SUITS = ['s', 'h', 'd', 'c']; // spades, hearts, diamonds, clubs
const red = (c) => c.s === 'h' || c.s === 'd';
const code = (c) => c.s + c.r; // 'h12' is the queen of hearts
const MAX_UNDO = 300;

export const PILES = ['waste', 'f0', 'f1', 'f2', 'f3', 't0', 't1', 't2', 't3', 't4', 't5', 't6'];

export class Solitaire {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.drawCount = settingOf(ctx, 'draw', 1) === 3 ? 3 : 1;
    this.timer = null;
    this.look = lookOf(ctx, 'solitaire');
  }

  start() {
    const deck = [];
    for (const s of SUITS) for (let r = 1; r <= 13; r++) deck.push({ s, r });
    for (let i = deck.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [deck[i], deck[j]] = [deck[j], deck[i]];
    }
    // Column n gets n + 1 cards, the last one face up.
    this.tab = Array.from({ length: 7 }, (_, n) => deck.splice(0, n + 1).map((c, i) => ({ ...c, up: i === n })));
    this.stock = deck; // the top is the end of the array
    this.waste = [];
    this.found = [[], [], [], []];
    this.history = [];
    this.moves = 0;
    this.passes = 0;
    this.nope = 0; // moves that couldn't happen, counted so the screen can shake
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
    this.history.push(JSON.stringify({ tab: this.tab, stock: this.stock, waste: this.waste, found: this.found, passes: this.passes }));
    if (this.history.length > MAX_UNDO) this.history.shift();
  }

  undo() {
    const last = this.history.pop();
    if (!last) return false;
    Object.assign(this, JSON.parse(last));
    this.moves++;
    return true;
  }

  draw() {
    if (!this.stock.length && !this.waste.length) return false;
    this.snapshot();
    if (!this.stock.length) {
      this.stock = this.waste.reverse();
      this.waste = [];
      this.passes++;
    } else {
      for (let k = 0; k < this.drawCount && this.stock.length; k++) this.waste.push(this.stock.pop());
    }
    this.moves++;
    return true;
  }

  pile(name) {
    if (name === 'waste') return this.waste;
    if (/^f[0-3]$/.test(name)) return this.found[Number(name[1])];
    if (/^t[0-6]$/.test(name)) return this.tab[Number(name[1])];
    return null;
  }

  /** The cards a move would take: the top card, or (from a column) a face-up run starting at index. */
  taking(from, index) {
    const p = this.pile(from);
    if (!p || !p.length) return null;
    if (from[0] !== 't' || index === undefined || index === p.length - 1) return { start: p.length - 1, cards: [p[p.length - 1]] };
    if (!Number.isInteger(index) || index < 0 || index >= p.length || !p[index].up) return null;
    return { start: index, cards: p.slice(index) };
  }

  /** Can these cards go on that pile? */
  fits(cards, to) {
    const dest = this.pile(to);
    if (!dest) return false;
    const c = cards[0];
    const top = dest[dest.length - 1];
    if (to[0] === 'f') return cards.length === 1 && (top ? top.s === c.s && top.r === c.r - 1 : c.r === 1);
    if (!top) return c.r === 13;
    return top.up && red(top) !== red(c) && top.r === c.r + 1;
  }

  move(from, index, to) {
    if (from === to) return false;
    const t = this.taking(from, index);
    if (!t || !this.fits(t.cards, to)) return false;
    this.snapshot();
    const src = this.pile(from);
    src.splice(t.start);
    this.pile(to).push(...t.cards.map((c) => ({ ...c, up: true })));
    // A column's new top card turns face up.
    if (src.length && from[0] === 't' && !src[src.length - 1].up) src[src.length - 1].up = true;
    this.moves++;
    this.checkWin();
    return true;
  }

  /**
   * One tap: send a card (or a run) where it can go. A single card tries the
   * foundations first; then a column with cards in it, then an empty one.
   */
  smart(from, index) {
    const t = this.taking(from, index);
    if (!t) return false;
    if (t.cards.length === 1 && from[0] !== 'f') for (let f = 0; f < 4; f++) if (this.move(from, index, 'f' + f)) return true;
    const cols = [0, 1, 2, 3, 4, 5, 6].map((n) => 't' + n).filter((n) => n !== from);
    // Moving a king from the bottom of one column to an empty one gains nothing.
    const fromBottom = from[0] === 't' && t.start === 0;
    for (const to of cols) if (this.tab[Number(to[1])].length && this.move(from, index, to)) return true;
    if (!fromBottom) for (const to of cols) if (!this.tab[Number(to[1])].length && this.move(from, index, to)) return true;
    return false;
  }

  /** Every card face up and the stock gone: the rest goes home by itself. */
  get canFinish() {
    return this.phase === 'play' && !this.stock.length && !this.waste.length && this.tab.every((col) => col.every((c) => c.up));
  }

  finish() {
    if (!this.canFinish) return false;
    let moved = true;
    while (moved && this.phase === 'play') {
      moved = false;
      for (let n = 0; n < 7 && this.phase === 'play'; n++) {
        const col = this.tab[n];
        if (!col.length) continue;
        for (let f = 0; f < 4; f++) {
          if (this.fits([col[col.length - 1]], 'f' + f)) {
            this.found[f].push(col.pop());
            this.moves++;
            moved = true;
            break;
          }
        }
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
    let changed = false;
    if (input.type === 'draw') changed = this.draw();
    else if (input.type === 'undo') changed = this.undo();
    else if (input.type === 'finish') changed = this.finish();
    else if (input.type === 'move' && okPile(input.from) && okPile(input.to)) changed = this.move(input.from, input.index, input.to);
    else if (input.type === 'smart' && okPile(input.from)) changed = this.smart(input.from, input.index);
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
      // Face-down cards are just '#': what they are stays secret until they turn over.
      tab: this.tab.map((col) => col.map((c) => (c.up ? code(c) : '#'))),
      stock: this.stock.length,
      // The waste's top three (draw 3 fans them); only the last can be played.
      waste: this.waste.slice(-3).map(code),
      wasteCount: this.waste.length,
      found: this.found.map((f) => (f.length ? code(f[f.length - 1]) : null)),
      foundCount: this.found.reduce((a, f) => a + f.length, 0),
      canFinish: this.canFinish,
      canUndo: this.history.length > 0,
      nope: this.nope,
      moves: this.moves,
      elapsed: this.elapsed,
      draw: this.drawCount,
      won,
      score: won ? this.elapsed : null,
      variant: this.drawCount === 3 ? 'Draw 3' : 'Draw 1',
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
  id: 'solitaire',
  name: 'Solitaire',
  tagline: 'Klondike: build the suits up from ace to king. Tap a card to send it where it fits.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'time' },
  create: (ctx) => new Solitaire(ctx, ctx.rng),
};
