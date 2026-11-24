// A solo game (see ./games/index.js) as a game of this hub. The hub's games take
// onInput(slot, input) and playerView(slot); a solo game has one player, so the room picks
// whose game it is (ctx.soloSlot: whoever started it), that seat plays, and the other one
// (if anyone's in it) watches. The game itself is untouched: the solo bits it needs
// (ctx.player, achievements(), best(), daily) are added to the room's ctx here.

import { seeded } from './rng.js';

export function soloGame(def) {
  return {
    id: def.id,
    name: def.name,
    tagline: def.tagline,
    category: def.category,
    music: def.music,
    score: def.score,
    solo: true,
    base: def,
    // The daily challenge (ctx.challenge) is played as it's dealt: no setup screen.
    create: (ctx) => new SoloSeat(ctx, ctx.challenge ? def.base || def : def),
  };
}

class SoloSeat {
  constructor(ctx, def) {
    this.ctx = ctx;
    const inner = Object.create(ctx);
    Object.defineProperty(inner, 'player', {
      get() {
        const p = ctx.players[ctx.soloSlot] || {};
        return { name: p.name || 'Player', local: Boolean(p.local) };
      },
    });
    inner.achievements = () => ctx.solo.achievements();
    inner.best = (variant) => ctx.solo.best(variant);
    inner.daily = ctx.solo.daily;
    if (ctx.challenge) {
      // Everyone gets the same deal today: the day's settings, and randomness seeded by the day.
      inner.settings = ctx.challenge.settings;
      inner.rng = seeded(ctx.challenge.seed);
      inner.challenge = true;
    }
    this.game = def.create(inner);
  }

  start() {
    this.game.start();
  }

  onInput(slot, input) {
    if (slot === this.ctx.soloSlot) this.game.onInput(input);
  }

  /** Who's in the seats, and whose game it is: the screens show the player's name and the watcher. */
  seats() {
    return { players: this.ctx.players, soloSlot: this.ctx.soloSlot };
  }

  hostView() {
    return { ...this.game.hostView(), ...this.seats() };
  }

  playerView(slot) {
    if (slot === this.ctx.soloSlot) return { ...this.game.playerView(), ...this.seats(), you: slot };
    // The other seat watches: the game's phase and, at the end, the score (nothing to tap).
    const v = this.game.hostView();
    return { phase: v.phase === 'setup' ? 'waiting' : v.phase, watching: true, score: v.phase === 'over' ? v.score : null, variant: v.variant, ...this.seats(), you: slot };
  }
}
