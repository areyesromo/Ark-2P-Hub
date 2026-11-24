// Mastermind. The hub picks a secret code of coloured pegs (a colour can come up
// more than once). Guess it: after each guess you're told how many pegs are the
// right colour in the right place (black), and how many more are a right colour
// in the wrong place (white), not which ones. Crack it in ten guesses.
// Score: the guesses it took (fewer is better), per level; not cracking it
// doesn't count.

import { settingOf } from './options.js';

export const LEVELS = {
  easy: { name: 'Easy', pegs: 4, colours: 6 },
  normal: { name: 'Normal', pegs: 4, colours: 8 },
  hard: { name: 'Hard', pegs: 5, colours: 8 },
};
export const MAX_GUESSES = 10;

/** How a guess did: { exact: right colour and place, colour: right colour, wrong place }. */
export function rate(code, guess) {
  let exact = 0;
  const inCode = {};
  const inGuess = {};
  code.forEach((c, i) => {
    if (c === guess[i]) exact++;
    inCode[c] = (inCode[c] || 0) + 1;
    inGuess[guess[i]] = (inGuess[guess[i]] || 0) + 1;
  });
  // For each colour, as many as are in both; the ones already counted as exact aren't counted twice.
  let both = 0;
  for (const c of Object.keys(inCode)) both += Math.min(inCode[c], inGuess[c] || 0);
  return { exact, colour: both - exact };
}

export class Mastermind {
  constructor(ctx, rng = Math.random) {
    this.ctx = ctx;
    this.rng = rng;
    const level = settingOf(ctx, 'level', 'easy');
    this.level = Object.prototype.hasOwnProperty.call(LEVELS, level) ? level : 'easy';
  }

  start() {
    const { pegs, colours } = LEVELS[this.level];
    this.code = Array.from({ length: pegs }, () => Math.floor(this.rng() * colours));
    this.guesses = []; // { pegs, exact, colour }
    this.won = false;
    this.phase = 'play';
    this.ctx.update();
  }

  onInput(input) {
    if (input.type === 'rematch' && this.phase === 'over') return this.start();
    if (this.phase !== 'play' || input.type !== 'guess') return;
    const { pegs, colours } = LEVELS[this.level];
    const g = input.pegs;
    if (!Array.isArray(g) || g.length !== pegs || !g.every((c) => Number.isInteger(c) && c >= 0 && c < colours)) return;
    const r = rate(this.code, g);
    this.guesses.push({ pegs: g.slice(), ...r });
    if (r.exact === pegs) {
      this.won = true;
      this.phase = 'over';
    } else if (this.guesses.length >= MAX_GUESSES) this.phase = 'over';
    this.ctx.update();
  }

  view() {
    const over = this.phase === 'over';
    return {
      phase: this.phase,
      pegs: LEVELS[this.level].pegs,
      colours: LEVELS[this.level].colours,
      maxGuesses: MAX_GUESSES,
      guesses: this.guesses,
      // The code only once the run is over.
      code: over ? this.code : null,
      won: this.won,
      score: over && this.won ? this.guesses.length : null,
      variant: LEVELS[this.level].name,
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
  id: 'mastermind-1p',
  name: 'Mastermind 1P',
  tagline: 'Crack the secret colour code. Black: right colour, right place. White: right colour, wrong place.',
  category: 'puzzle',
  phone: true,
  score: { better: 'lower', unit: 'tries' },
  create: (ctx) => new Mastermind(ctx, ctx.rng),
};
