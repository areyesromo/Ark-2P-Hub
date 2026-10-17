// Micro Mayhem: WarioWare-style micro-games, 3-5 seconds each, both players
// at once. Fail one and you lose a life; every 5 micros the speed goes up.
// Last one with lives wins; both out on the same micro is sudden death.
// The micro-games themselves live in server/games/minis/.

import { MiniGame } from './minis/runner.js';
import { MICROS } from './minis/index.js';
import { settingOf } from './options.js';

export const LIVES = 3;
export const LEVEL_EVERY = 5;
export const SCALE_STEP = 0.85;
export const SCALE_MIN = 0.45;

export class MicroMayhem extends MiniGame {
  constructor(ctx, pool = MICROS, rng = Math.random) {
    super(ctx, pool, rng);
    this.startLives = settingOf(ctx, 'lives', LIVES);
    this.startLevel = settingOf(ctx, 'pace', 'normal') === 'fast' ? 3 : 1;
  }

  reset() {
    this.lives = [this.startLives, this.startLives];
    this.scores = this.lives;
    this.suddenDeath = false;
  }

  get level() {
    return this.startLevel + Math.floor((this.count || 0) / LEVEL_EVERY);
  }

  scale() {
    return Math.max(SCALE_MIN, Math.round(SCALE_STEP ** (this.level - 1) * 1000) / 1000);
  }

  score(result) {
    result.pass.forEach((ok, slot) => {
      if (!ok) this.lives[slot] = Math.max(0, this.lives[slot] - 1);
    });
    if (this.lives[0] === 0 && this.lives[1] === 0) {
      this.suddenDeath = true;
      this.lives[0] = this.lives[1] = 1;
    } else if (this.lives.includes(0)) {
      this.winner = this.lives[0] === 0 ? 1 : 0;
    }
  }

  isOver() {
    return this.winner !== null;
  }

  extraView() {
    return { lives: this.lives, startLives: this.startLives, level: this.level, suddenDeath: this.suddenDeath };
  }
}

export default {
  id: 'micro-mayhem',
  name: 'Micro Mayhem',
  category: 'competitive',
  music: 'action',
  tagline: 'Tiny games, three seconds each, both of you at once: TAP IT! STOP IT! SHAKE IT! Fail one and lose a life. It keeps getting faster; last one standing wins.',
  create: (ctx) => new MicroMayhem(ctx),
};
