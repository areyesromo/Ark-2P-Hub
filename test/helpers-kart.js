// Kart Race test helpers: a Kart Race 3D race with six computer racers (karts 2-7), before the
// 8-kart Cup's own setup existed, and placing karts on the road.
import { pointAt, TIMING } from '../server/games/kart-race.js';
import { KartRace3D } from '../server/games/kart-race-3d.js';
import { fakeCtx } from './helpers.js';

const CPU_RACERS = ['rex', 'zip', 'swift', 'boulder', 'rascal', 'roxy'];

/** Kart Race 3D with six computer racers at `level` added to the two players. */
export class Field3D extends KartRace3D {
  constructor(ctx, rng, level = 'normal') {
    super(ctx, rng);
    this.level = level;
  }
  entrants() {
    if (this.battle) return super.entrants();
    return super.entrants().concat(CPU_RACERS.map((racer) => ({ racer, tyre: 'standard', cpu: { level: this.level, sway: 0 } })));
  }
  /** As the Cup's first race: the computers in front, the players on the back row. */
  gridOrder(n) {
    return n === 8 ? [2, 3, 4, 5, 6, 7, 0, 1] : super.gridOrder(n);
  }
}

/** Setup, both ready, lights out: a race of eight on big track `track` (1-5). */
export function race8({ track = 2, level = 'normal', laps = 3, items = 0 } = {}) {
  const ctx = fakeCtx();
  const game = new Field3D(ctx, () => 0.5, level);
  game.start();
  for (const [key, value] of Object.entries({ track, laps, items })) game.onInput(0, { type: 'setting', key, value });
  game.onInput(0, { type: 'go' });
  game.onInput(1, { type: 'go' });
  ctx.advance(TIMING.countdownMs + 50);
  return { ctx, game };
}

/** Put kart i at fraction p of the lap, `off` right of the middle, stopped. */
export function placeAt(game, i, p, off = 0, laps = 0) {
  const at = pointAt(game.track, p, off);
  const n = game.track.line.length;
  Object.assign(game.karts[i], { x: at.x, y: at.y, angle: at.angle, speed: 0, progress: p, laps, seg: Math.round(p * n) % n });
}
