// Memory Match. A grid of face-down cards on the TV (and on the phones).
// Take turns flipping two: a pair is yours and you go again, otherwise they
// turn back over and it's the other player's go. Most pairs when the board
// is cleared wins. Players pick the board size, the card theme and the time
// per turn on the setup screen.

import { loadSettings, applySetting } from './options.js';

export const THEMES = [
  { name: 'Animals', faces: ['🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🦉', '🐙', '🦋', '🐢', '🦀', '🐬', '🦒', '🐘'] },
  { name: 'Food', faces: ['🍎', '🍌', '🍇', '🍓', '🍒', '🍍', '🥝', '🍉', '🍋', '🥕', '🌽', '🍕', '🍔', '🌭', '🍟', '🍩', '🍪', '🧁', '🍦', '🥨', '🧀', '🥐', '🍣', '🌮'] },
  { name: 'Sports', faces: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '⛳', '🏹', '🎣', '🛹', '⛸️', '🎿', '🏆', '🥇', '🚴', '🏊', '🧗', '🤿', '🎳'] },
  { name: 'Things', faces: ['🚀', '🚗', '🚲', '⛵', '✈️', '🚂', '🎸', '🎺', '🥁', '🎲', '🧩', '🎈', '🎁', '💡', '🔑', '⏰', '📷', '🔭', '☂️', '🧲', '⚓', '🌈', '⭐', '🌙'] },
];

export const OPTIONS = {
  cards: [16, 24, 36], // 4x4, 4x6, 6x6
  theme: [0, 1, 2, 3, 4], // 0: a mix of every theme
  turnSeconds: [20, 10, 30],
};
export const TIMING = { countdownMs: 2500, peekMs: 1300, matchMs: 700 };

/** Grid shape for a number of cards: [columns, rows]. */
export function gridOf(cards) {
  return cards === 16 ? [4, 4] : cards === 24 ? [6, 4] : [6, 6];
}

export class MemoryMatch {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
    this.settings = loadSettings(ctx, OPTIONS);
    this.starter = 0; // who goes first; swaps every match
  }

  /** The setup screen. */
  start() {
    this.clearTimer();
    this.phase = 'setup';
    this.cards = null;
    this.scores = [0, 0];
    this.winner = null;
    this.draw = false;
    this.ctx.update();
  }

  begin() {
    const n = this.settings.cards / 2;
    const pool = this.settings.theme === 0 ? THEMES.flatMap((t) => t.faces) : THEMES[this.settings.theme - 1].faces;
    const faces = this.shuffle(pool.slice()).slice(0, n);
    this.cards = this.shuffle(faces.concat(faces)).map((face) => ({ face, owner: null }));
    this.flipped = []; // indexes face up this turn (0, 1 or 2)
    this.scores = [0, 0];
    this.winner = null;
    this.draw = false;
    this.turn = this.starter;
    this.starter = 1 - this.starter;
    this.lastMatch = null; // { by, face } for the TV
    this.events = { flips: 0, matches: 0, misses: 0 };
    this.timed('countdown', TIMING.countdownMs, () => this.startTurn());
  }

  shuffle(list) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  clearTimer() {
    if (this.timer) this.ctx.clearTimeout(this.timer);
    this.timer = null;
  }

  /** Enter a phase that ends after `ms` with `then()`. */
  timed(phase, ms, then) {
    this.clearTimer();
    this.phase = phase;
    this.phaseEnds = this.ctx.now() + ms;
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      then();
    }, ms);
    this.ctx.update();
  }

  startTurn() {
    this.flipped = [];
    this.timed('turn', this.settings.turnSeconds * 1000, () => this.outOfTime());
  }

  /** Too slow: flip random cards for them. */
  outOfTime() {
    while (this.phase === 'turn') {
      const hidden = this.cards.map((c, i) => i).filter((i) => this.cards[i].owner === null && !this.flipped.includes(i));
      this.flip(this.turn, hidden[Math.floor(this.rng() * hidden.length)]);
    }
  }

  flip(slot, index) {
    if (this.phase !== 'turn' || slot !== this.turn) return;
    const card = this.cards[index];
    if (!card || card.owner !== null || this.flipped.includes(index)) return;
    this.flipped.push(index);
    this.events.flips++;
    if (this.flipped.length < 2) return this.ctx.update();
    const [a, b] = this.flipped.map((i) => this.cards[i]);
    if (a.face === b.face) {
      a.owner = b.owner = slot;
      this.scores[slot]++;
      this.events.matches++;
      this.lastMatch = { by: slot, face: a.face };
      // A pair: show it a moment, then the same player goes again.
      this.timed('match', TIMING.matchMs, () => (this.cards.every((c) => c.owner !== null) ? this.finish() : this.startTurn()));
    } else {
      this.events.misses++;
      // No pair: a moment to memorise them, then they turn back and the turn passes.
      this.timed('peek', TIMING.peekMs, () => {
        this.turn = 1 - this.turn;
        this.startTurn();
      });
    }
  }

  finish() {
    this.clearTimer();
    this.flipped = [];
    const [a, b] = this.scores;
    this.winner = a === b ? null : a > b ? 0 : 1;
    this.draw = this.winner === null;
    this.phase = 'over';
    this.ctx.update();
  }

  onInput(slot, input) {
    if (this.phase === 'setup') {
      if (input.type === 'setting' && applySetting(this.ctx, OPTIONS, this.settings, input.key, input.value)) this.ctx.update();
      if (input.type === 'go') this.begin();
      return;
    }
    if (this.phase === 'over') {
      if (input.type === 'rematch') this.begin();
      if (input.type === 'setup') this.start();
      return;
    }
    if (input.type === 'flip') this.flip(slot, input.index);
  }

  view() {
    const playing = Boolean(this.cards);
    const [cols, rows] = gridOf(this.settings.cards);
    return {
      phase: this.phase,
      settings: this.settings,
      options: OPTIONS,
      cols,
      rows,
      // Face-down cards don't reveal their face to anyone.
      cards: playing
        ? this.cards.map((c, i) => (c.owner !== null || this.flipped.includes(i) || this.phase === 'over' ? { face: c.face, owner: c.owner, up: true } : { up: false }))
        : null,
      flipped: playing ? this.flipped : [],
      turn: this.turn,
      scores: this.scores,
      pairs: this.settings.cards / 2,
      winner: this.winner,
      draw: this.draw,
      lastMatch: this.lastMatch || null,
      events: this.events || null,
      timeLeftMs: this.phase === 'turn' ? Math.max(0, this.phaseEnds - this.ctx.now()) : 0,
      turnMs: this.settings.turnSeconds * 1000,
      countdown: this.phase === 'countdown' ? Math.ceil(Math.max(0, this.phaseEnds - this.ctx.now()) / 1000) : 0,
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
  id: 'memory-match',
  name: 'Memory Match',
  tagline: 'Take turns flipping two cards: find a pair and go again. Remember what your rival turned over. Most pairs wins.',
  music: 'thinking',
  create: (ctx) => new MemoryMatch(ctx),
};
