// Memory Match. A grid of face-down cards on the TV (and on the phones).
// Take turns flipping two: a pair is yours and you go again, otherwise they
// turn back over and it's the other player's go. Most pairs when the board
// is cleared wins. Players pick the board size, the card theme and the time
// per turn on the setup screen.
//
// In the 1 player lobby it's Memory Pairs (soloMemory below): your own board, two cards at a time,
// a pair stays up and two different ones turn back after a moment. Find every pair in as few tries
// as you can. Three sizes; the faces are a look you unlock. Score: the tries it took, per size.

import { loadSettings, applySetting, settingOf } from './options.js';
import { lookOf } from '../solo/games/looks.js';

// Only emoji from 2019 (Emoji 12) or older, so every TV and phone can show them
// (Windows 10, for one, stops at Emoji 12), and no two in a set that look
// alike (a memory game has to be fair).
export const THEMES = [
  { name: 'Animals', faces: ['🐶', '🐱', '🐭', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🐔', '🐧', '🦉', '🐙', '🦋', '🐢', '🦀', '🐬', '🦒', '🐘'] },
  { name: 'Food', faces: ['🍎', '🍌', '🍇', '🍓', '🍒', '🍍', '🥝', '🍉', '🍋', '🥕', '🌽', '🍕', '🍔', '🌭', '🍟', '🍩', '🍪', '🧁', '🍦', '🥨', '🧀', '🥐', '🍣', '🌮'] },
  { name: 'Sports', faces: ['⚽', '🏀', '🏈', '⚾', '🎾', '🏐', '🏉', '🎱', '🏓', '🏸', '🥊', '⛳', '🏹', '🎣', '🛹', '⛸️', '🎿', '🏆', '🥇', '🚴', '🏊', '🧗', '🤿', '🎳'] },
  { name: 'Things', faces: ['🚗', '🚲', '⛵', '✈️', '🚂', '🎸', '🎺', '🥁', '🎲', '🧩', '🎈', '🎁', '💡', '🔑', '⏰', '📷', '🔭', '☂️', '🧲', '⚓', '🧸', '✂️', '🖍️', '📚'] },
  { name: 'Faces', faces: ['😀', '😂', '😍', '😎', '🤔', '😴', '😱', '🥳', '😡', '🤢', '🤠', '🥶', '🥵', '😇', '🤓', '🤡', '👻', '👽', '🤖', '💩', '🎃', '😺', '🙈', '🤯'] },
  { name: 'Nature', faces: ['🌵', '🌻', '🌹', '🌷', '🍄', '🌲', '🌴', '🍁', '🍀', '🌸', '🌾', '🌱', '🌋', '🏔️', '🌊', '🔥', '❄️', '⚡', '🌈', '☀️', '🌙', '⭐', '☁️', '💧'] },
  { name: 'Space & travel', faces: ['🚀', '🛸', '🌍', '🪐', '☄️', '🌌', '🔭', '🛰️', '👨‍🚀', '🗺️', '🧭', '🏰', '🗽', '🗼', '🎡', '🎢', '⛺', '🏝️', '🚁', '🚤', '🚠', '🎠', '🌋', '🗿'] },
  { name: 'Ocean', faces: ['🦀', '🐋', '🦈', '🐠', '🐟', '🐡', '🦑', '🦞', '🦐', '🐚', '🐬', '🐊', '🦪', '🐧', '🦦', '⚓', '🏄', '🤿', '🛥️', '🚢', '⛱️', '🧜', '🌊', '🦩'] },
];

export const OPTIONS = {
  // Take turns on one board, or Race: the same cards on each phone, flipped at once (two phones).
  mode: ['turns', 'race'],
  cards: [16, 24, 36], // 4x4, 4x6, 6x6
  theme: [0, ...THEMES.map((_, i) => i + 1)], // 0: a mix of every theme
  turnSeconds: [20, 10, 30, 0], // 0: no timer, a turn waits for you
};
export const TIMING = { countdownMs: 2500, peekMs: 1300, matchMs: 700 };

/** 1 player: the board sizes ({ w, h }), each look's theme (THEMES), and how long two different cards stay up. */
export const SIZES = { small: { w: 4, h: 4 }, medium: { w: 6, h: 4 }, large: { w: 6, h: 6 } };
export const LOOK_THEMES = { animals: 'Animals', food: 'Food', sea: 'Ocean', space: 'Space & travel' };
export const PEEK_MS = 900;

/** Grid shape for a number of cards: [columns, rows]. */
export function gridOf(cards) {
  return cards === 16 ? [4, 4] : cards === 24 ? [6, 4] : [6, 6];
}

export class MemoryMatch {
  /** solo: the 1 player mode, Memory Pairs (see the top of this file). */
  constructor(ctx, rng = Math.random, { solo = false } = {}) {
    this.ctx = ctx;
    this.rng = rng;
    this.timer = null;
    this.solo = solo;
    if (solo) {
      const size = settingOf(ctx, 'size', 'small');
      this.size = Object.prototype.hasOwnProperty.call(SIZES, size) ? size : 'small';
      this.look = lookOf(ctx, 'memory-match');
      return;
    }
    this.settings = loadSettings(ctx, OPTIONS);
    this.starter = 0; // who goes first; swaps every match
  }

  /** The setup screen. */
  start() {
    if (this.solo) return this.startPairs();
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
    // Mixed: every theme's pictures, each once (a few appear in two themes).
    const pool = this.settings.theme === 0 ? [...new Set(THEMES.flatMap((t) => t.faces))] : THEMES[this.settings.theme - 1].faces;
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
    // Race keeps your board on your phone; a controller player only has the TV, so it's turns.
    this.race = this.settings.mode === 'race' && !this.ctx.players.some((p) => p && p.local);
    this.found = [new Set(), new Set()]; // Race: the cards each of you has paired
    this.mine = [[], []]; // Race: the cards each of you has face up right now
    this.timed('countdown', TIMING.countdownMs, 'startTurn');
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

  /**
   * Into `phase`, then the method named `then` after `ms` (null: no time limit). A name, not a
   * function, so a saved game keeps it (see resumed).
   */
  timed(phase, ms, then) {
    this.clearTimer();
    this.phase = phase;
    this.phaseEnds = ms === null ? null : this.ctx.now() + ms;
    this.onEnd = then;
    if (ms === null) return this.ctx.update();
    this.arm();
    this.ctx.update();
  }

  arm() {
    this.timer = this.ctx.setTimeout(() => {
      this.timer = null;
      this[this.onEnd]();
    }, Math.max(0, this.phaseEnds - this.ctx.now()));
  }

  /** Picked up after a restart (see RESUMES in index.js): the clock runs on from where it was. */
  resumed(downMs = 0) {
    this.timer = null;
    if (this.phaseEnds === null || this.phase === 'over') return;
    this.phaseEnds += downMs;
    this.arm();
  }

  startTurn() {
    this.flipped = [];
    if (this.race) return this.timed('race', null); // no turns and no clock: first to clear wins
    this.timed('turn', this.settings.turnSeconds ? this.settings.turnSeconds * 1000 : null, 'outOfTime');
  }

  /** Too slow: flip random cards for them. */
  outOfTime() {
    while (this.phase === 'turn') {
      const hidden = this.cards.map((c, i) => i).filter((i) => this.cards[i].owner === null && !this.flipped.includes(i));
      this.flip(this.turn, hidden[Math.floor(this.rng() * hidden.length)]);
    }
  }

  /** Race: your own flip on your own board. A mismatch stays up until your next flip. */
  raceFlip(slot, index) {
    const card = this.cards[index];
    const up = this.mine[slot];
    if (!card || this.found[slot].has(index)) return;
    if (up.includes(index) && up.length === 1) return; // already your first card
    if (up.length === 2) up.length = 0; // turn the last mismatch back (tapping one of them starts afresh with it)
    up.push(index);
    this.events.flips++;
    if (up.length === 2) {
      if (this.cards[up[0]].face === card.face) {
        up.forEach((i) => this.found[slot].add(i));
        up.length = 0;
        this.scores[slot]++;
        this.events.matches++;
        if (this.found[slot].size === this.cards.length) return this.finish(slot);
      } else this.events.misses++;
    }
    this.ctx.update();
  }

  flip(slot, index) {
    if (!Number.isInteger(index)) return; // a card's number (as text, it could pair a card with itself)
    if (this.phase === 'race') return this.raceFlip(slot, index);
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
      this.timed('match', TIMING.matchMs, 'afterPair');
    } else {
      this.events.misses++;
      // No pair: a moment to memorise them, then they turn back and the turn passes.
      this.timed('peek', TIMING.peekMs, 'afterMiss');
    }
  }

  /** A pair shown: the same player goes again, or that was the last pair. */
  afterPair() {
    if (this.cards.every((c) => c.owner !== null)) this.finish();
    else this.startTurn();
  }

  /** A miss shown: the cards turn back and the turn passes. */
  afterMiss() {
    this.turn = 1 - this.turn;
    this.startTurn();
  }

  /** The end: `first` cleared the board in a Race; otherwise most pairs wins. */
  finish(first) {
    this.clearTimer();
    this.flipped = [];
    const [a, b] = this.scores;
    this.winner = first !== undefined ? first : a === b ? null : a > b ? 0 : 1;
    this.draw = this.winner === null;
    this.phase = 'over';
    this.ctx.update();
  }

  // ---- 1 player: Memory Pairs ----------------------------------------------------------

  startPairs() {
    this.clearTimer();
    const { w, h } = SIZES[this.size];
    const theme = THEMES.find((t) => t.name === LOOK_THEMES[this.look]) || THEMES[0];
    const faces = this.shuffle(theme.faces.slice()).slice(0, (w * h) / 2);
    this.cards = this.shuffle(faces.concat(faces));
    this.matched = Array(this.cards.length).fill(false);
    this.up = []; // the one or two cards turned over right now
    this.tries = 0; // pairs of cards turned over
    this.streak = 0;
    this.bestStreak = 0; // pairs found in a row
    this.lastMiss = 0; // tries that didn't match, so the screens can shake
    this.startedAt = null; // the clock starts with the first card
    this.endedAt = null;
    this.phase = 'play';
    this.ctx.update();
  }

  /** Turn the two cards that didn't match back over. */
  hidePair() {
    this.clearTimer();
    this.up = [];
    this.ctx.update();
  }

  pairsFlip(i) {
    if (!Number.isInteger(i) || i < 0 || i >= this.cards.length || this.matched[i] || this.up.includes(i)) return;
    // A third card while two different ones still show: they turn back straight away.
    if (this.up.length === 2) {
      this.clearTimer();
      this.up = [];
    }
    if (this.startedAt === null) this.startedAt = this.ctx.now();
    this.up.push(i);
    if (this.up.length === 2) {
      this.tries++;
      const [a, b] = this.up;
      if (this.cards[a] === this.cards[b]) {
        this.matched[a] = this.matched[b] = true;
        this.up = [];
        this.streak++;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        if (this.matched.every(Boolean)) {
          this.endedAt = this.ctx.now();
          this.phase = 'over';
        }
      } else {
        this.streak = 0;
        this.lastMiss = this.tries;
        this.timer = this.ctx.setTimeout(() => this.hidePair(), PEEK_MS);
      }
    }
    this.ctx.update();
  }

  pairsView() {
    const { w, h } = SIZES[this.size];
    const elapsed = this.startedAt === null ? 0 : (this.endedAt !== null ? this.endedAt : this.ctx.now()) - this.startedAt;
    return {
      solo: true,
      look: this.look,
      phase: this.phase,
      w,
      h,
      // Only the cards that are face up show what they are.
      cards: this.cards.map((c, i) => (this.matched[i] || this.up.includes(i) ? c : null)),
      matched: this.matched,
      up: this.up,
      tries: this.tries,
      pairsLeft: this.matched.filter((m) => !m).length / 2,
      streak: this.streak,
      bestStreak: this.bestStreak,
      lastMiss: this.lastMiss,
      elapsed,
      score: this.phase === 'over' ? this.tries : null,
      variant: `${w}×${h}`,
    };
  }

  onInput(slot, input) {
    if (this.solo) {
      if (slot !== 0 || !input) return;
      if (input.type === 'rematch' && this.phase === 'over') return this.start();
      if (input.type === 'flip' && this.phase === 'play') this.pairsFlip(input.cell);
      return;
    }
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

  /** `viewer`: whose screen (null for the TV). In a Race each board is your own until the end. */
  view(viewer) {
    const playing = Boolean(this.cards);
    const racing = playing && this.race && this.phase !== 'over';
    // The TV shows a board in a Race only for a controller player (one took a dropped phone's seat).
    const local = this.ctx.players.findIndex((p) => p && p.local);
    const board = viewer === null ? (local === -1 ? null : local) : viewer;
    // The end of a Race: every face, coloured by who paired it (yours on your phone; the TV the winner's).
    const raceOwner = (i) => {
      if (viewer !== null) return this.found[viewer].has(i) ? viewer : null;
      return this.winner !== null && this.found[this.winner].has(i) ? this.winner : null;
    };
    const [cols, rows] = gridOf(this.settings.cards);
    return {
      phase: this.phase,
      settings: this.settings,
      options: OPTIONS,
      cols,
      rows,
      // Face-down cards don't reveal their face to anyone.
      cards: !playing
        ? null
        : racing
          ? this.cards.map((c, i) => {
            if (board === null) return { up: false };
            if (this.found[board].has(i)) return { face: c.face, owner: board, up: true };
            return this.mine[board].includes(i) ? { face: c.face, owner: null, up: true } : { up: false };
          })
          : this.race && this.phase === 'over'
            ? this.cards.map((c, i) => ({ face: c.face, owner: raceOwner(i), up: true }))
            : this.cards.map((c, i) => (c.owner !== null || this.flipped.includes(i) || this.phase === 'over' ? { face: c.face, owner: c.owner, up: true } : { up: false })),
      race: Boolean(this.race),
      flipped: playing ? this.flipped : [],
      turn: this.turn,
      scores: this.scores,
      pairs: this.settings.cards / 2,
      themeNames: THEMES.map((t) => t.name),
      winner: this.winner,
      draw: this.draw,
      lastMatch: this.lastMatch || null,
      events: this.events || null,
      timeLeftMs: this.phase === 'turn' && this.phaseEnds !== null ? Math.max(0, this.phaseEnds - this.ctx.now()) : 0,
      timed: this.settings.turnSeconds > 0 && !this.race,
      turnMs: this.settings.turnSeconds * 1000,
      countdown: this.phase === 'countdown' ? Math.ceil(Math.max(0, this.phaseEnds - this.ctx.now()) / 1000) : 0,
    };
  }

  hostView() {
    if (this.solo) return { ...this.pairsView(), player: this.ctx.player };
    return Object.assign(this.view(null), { players: this.ctx.players });
  }

  playerView(slot) {
    if (this.solo) return { ...this.pairsView(), you: 0 };
    return Object.assign(this.view(slot), { you: slot });
  }
}

/** The 1 player mode, Memory Pairs: played as a solo game (see server/solo/). */
export const soloMemory = {
  id: 'memory-match',
  name: 'Memory Pairs',
  tagline: 'Turn two cards over and find the pairs. Fewer tries is better.',
  category: 'brain',
  phone: true,
  music: 'thinking',
  score: { better: 'lower', unit: 'tries' },
  create: (ctx) => {
    const game = new MemoryMatch(ctx, ctx.rng, { solo: true });
    // (a solo game takes onInput(input) and playerView(): one player)
    return { start: () => game.start(), onInput: (input) => game.onInput(0, input), hostView: () => game.hostView(), playerView: () => game.playerView(0), game };
  },
};

export default {
  id: 'memory-match',
  handheld: true, // everything's on your phone: no need to watch the TV
  name: 'Memory Match',
  tagline: 'Take turns flipping two cards: find a pair and go again. Remember what your rival turned over. Most pairs wins. Or Race: your own board each, first to clear it.',
  music: 'thinking',
  create: (ctx) => new MemoryMatch(ctx),
};
