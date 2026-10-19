// Party Minigames: a Mario Party-style playlist of 20-40 second head-to-head
// minigames (balloon pumping, hot potato, quick draw...). Win a minigame to
// score; first to 3 wins. The minigames live in server/games/minis/.

import { MiniGame } from './minis/runner.js';
import { PARTIES } from './minis/index.js';
import { settingOf } from './options.js';

export const WINS = 3;
/** Which minigames a match picks from: every one, only the 2D / 3D ones, or one minigame's id (to practise it). */
export const STYLES = ['mix', '2d', '3d'];

export function poolFor(pool, style, players = []) {
  // A phone-only minigame (Bowling Bash: you swipe) never comes up with a controller seated.
  if (players.some((p) => p && p.local)) pool = pool.filter((m) => !m.phoneOnly);
  const one = pool.filter((m) => m.id === style);
  if (one.length) return one;
  const picked = style === '2d' || style === '3d' ? pool.filter((m) => m.look === style) : pool;
  return picked.length ? picked : pool;
}

export class PartyMinis extends MiniGame {
  constructor(ctx, pool = PARTIES, rng = Math.random) {
    super(ctx, poolFor(pool, settingOf(ctx, 'style', 'mix'), ctx.players), rng);
    this.target = settingOf(ctx, 'wins', WINS);
  }

  reset() {
    this.wins = [0, 0];
    this.scores = this.wins;
  }

  score(result) {
    if (result.winner === 0 || result.winner === 1) this.wins[result.winner]++;
    if (this.wins.includes(this.target)) this.winner = this.wins[0] === this.target ? 0 : 1;
  }

  isOver() {
    return this.winner !== null;
  }

  extraView() {
    return { wins: this.wins, target: this.target };
  }
}

export default {
  id: 'party-minis',
  name: 'Party Minigames',
  category: 'competitive',
  music: 'casual',
  tagline: 'Mario Party-style showdowns: pump a balloon till it pops, pass the hot potato, out-draw your rival, repeat the glowing path. Win a minigame to score; first to 3 takes it.',
  create: (ctx) => new PartyMinis(ctx),
};
