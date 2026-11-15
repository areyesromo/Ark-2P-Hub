/**
 * The computer opponent for Asteroid Duel (see `bot` in index.js). It turns to face where you'll
 * be when its shot gets there (the field wraps round), fires when lined up, keeps a fighting
 * distance, and swerves from rocks heading its way. Its aim wobbles a little each shot and it
 * reacts at human speed (bot-human.js).
 *   easy:   aims loosely, doesn't lead its shots, never swerves.
 *   normal: leads its shots, and swerves from rocks that are close.
 *   hard:   aims tight, and swerves early.
 */
import { FIELD, SHIP, BULLET } from './asteroid-duel.js';
import { reactionMs } from './bot-human.js';

// fires: it shoots once lined up within this share of your ship's width as it sees it (0: only when
// close to dead on); timed: lining up on its last look too, it times the press (a follow-through,
// this share of a fresh reaction).
const LEVEL = {
  easy: { aim: 0.16, lead: false, dodge: 0, fires: 0, timed: 0 },
  normal: { aim: 0.08, lead: true, dodge: 0.6, fires: 0.6, timed: 0.6 },
  hard: { aim: 0.04, lead: true, dodge: 1, fires: 0.75, timed: 0.6 },
};
const wrap = (v, size) => ((v % size) + size) % size;
const delta = (a, b, size) => wrap(a - b + size / 2, size) - size / 2;

export function asteroidDuelBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  const L = LEVEL[level];
  if (!view || !L || view.phase !== 'play' || !view.ships) return null;
  const me = view.ships[view.you];
  const foe = view.ships[1 - view.you];
  if (!me.alive) return null;
  const pace = reactionMs(level, rng);
  const stick = (ang, push) => ({ type: 'move', x: Math.cos(ang) * push, y: Math.sin(ang) * push, botDelayMs: pace });
  // A rock about to hit: swerve across its path, engine on.
  if (L.dodge) {
    for (const r of view.rocks) {
      const rx = delta(me.x, r.x, FIELD.w);
      const ry = delta(me.y, r.y, FIELD.h);
      const vx = r.vx - me.vx;
      const vy = r.vy - me.vy;
      const v2 = vx * vx + vy * vy || 1e-9;
      const t = (rx * vx + ry * vy) / v2;
      if (t < 0 || t > L.dodge) continue;
      if (Math.hypot(rx - vx * t, ry - vy * t) > r.r + SHIP.r + 0.3) continue;
      const side = rx * vy - ry * vx >= 0 ? 1 : -1;
      return stick(Math.atan2(-vx * side, vy * side), 1);
    }
  }
  memory.astroAiming = false;
  if (!foe.alive) return stick(me.angle, 0.3); // (wait for them to come back)
  // Where to shoot: where they'll be when the shot gets there.
  let dx = delta(foe.x, me.x, FIELD.w);
  let dy = delta(foe.y, me.y, FIELD.h);
  if (L.lead) {
    const t = Math.hypot(dx, dy) / BULLET.speed;
    dx += foe.vx * t;
    dy += foe.vy * t;
  }
  const d = Math.hypot(dx, dy);
  if (memory.astroAim === undefined || view.ready !== memory.astroReady) memory.astroAim = (rng() * 2 - 1) * L.aim; // (this shot's wobble)
  memory.astroReady = view.ready;
  const want = Math.atan2(dy, dx) + memory.astroAim;
  const off = Math.abs(Math.atan2(Math.sin(want - me.angle), Math.cos(want - me.angle)));
  const inRange = d < BULLET.speed * BULLET.lifeMs / 1000;
  // It fires once the shot would land: close to dead on, or (Normal, Hard) within part of your
  // ship's width from here, as a player fires when it looks lined up instead of waiting to be perfect.
  const width = Math.atan2(SHIP.r, d);
  const timed = memory.astroAiming && L.timed ? pace * L.timed : pace; // (a follow-through: it saw it coming)
  memory.astroAiming = true;
  if (off < Math.max(0.06, width * L.fires) && view.ready && inRange && !foe.shield) return { type: 'fire', botDelayMs: timed };
  // Close in when far, hold off when close (the engine only fires past SHIP.thrustFrom).
  const push = d > 6 ? 0.9 : d < 3 ? 0.3 : 0.35;
  return stick(want, push);
}
