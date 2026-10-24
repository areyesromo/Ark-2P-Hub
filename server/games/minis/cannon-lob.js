// Cannon Lob: a cannon each, a wall between you and a tower of 3 blocks on each side of it. Aim,
// hold FIRE to charge and let go to lob a shot over the wall; each hit on your rival's tower
// knocks a block off. The wind (the flag on the TV) changes every few seconds and blows every shot
// the same way. Knock off all three to win; at time up, more blocks knocked wins.
// One shot in the air at a time each, then a short reload. Your own shots pass your own tower.
// The charge counts from when FIRE was pressed and let go on the phone, not when they arrived
// (a press can't claim to be more than LAG_MS older than when it reached us). Hold FIRE through
// the reload and the charge starts as soon as you're loaded.
import { plausibleT } from './runner.js';

export const TICK_MS = 50;
export const FIELD = { w: 100, h: 60 }; // y is up, the ground is y = 0
export const CANNON_X = [8, 92];
export const CANNON_Y = 3;
export const WALL = { x: 50, w: 4, h: 18 };
export const TOWER_X = [30, 70]; // each player's own tower (the rival aims at it)
export const BLOCK_W = 6;
export const BLOCK_H = 5;
export const BLOCKS = 3;
export const ANGLE = { min: 15, max: 80, start: 45 };
export const AIM_SPEED = 50; // degrees a second with the stick held over
export const CHARGE_MS = 1200; // held this long: full power
export const SPEED = { min: 20, max: 62 }; // units a second, no charge to full charge
export const GRAVITY = 40;
export const WIND_MAX = 8; // units a second², either way
export const WIND_MS = 6000;
export const RELOAD_MS = 1000; // after your shot lands
const LAG_MS = 300; // the most a phone's press time may be older than its arrival
const SHOT_R = 1.2;
const STEPS = 5; // physics steps a tick, so a fast shot can't skip through the wall
const SHOW_MS = 600; // how long the TV shows where the last shot landed
const DURATION_MS = 40000;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r1 = (v) => Math.round(v * 10) / 10;
/** Whether a shot at (x, y) touches the box from x0 to x1, the ground up to h. */
const touches = (x, y, x0, x1, h) => Math.hypot(x - clamp(x, x0, x1), y - clamp(y, 0, h)) <= SHOT_R;

export default {
  id: 'cannon-lob', kind: 'party', look: '2d', name: 'Cannon Lob', order: 'KNOCK IT DOWN!', howTo: 'Drag to aim (stick up / down), hold FIRE (A) to charge, let go to lob it over the wall. Watch the wind!', durationMs: DURATION_MS,
  create(api) {
    // The wind for each WIND_MS stretch, the same for both of you.
    let winds = [...Array(Math.ceil(DURATION_MS / WIND_MS) + 2)].map(() => Math.round((api.rng() * 2 - 1) * WIND_MAX));
    const towers = [0, 1].map(() => ({ blocks: BLOCKS }));
    const knocked = [0, 0];
    const cannons = [0, 1].map(() => ({ angle: ANGLE.start, turn: 0, chargeAt: null, held: false, readyAt: 0 }));
    let shots = []; // { id, slot, x, y, vx, vy }
    let nextId = 1;
    let last = null; // where the latest shot ended: { n, slot, kind: 'hit' | 'wall' | 'ground', x, y, at }
    let landed = 0;
    let done = false;
    let shown = '';

    const wind = (now) => winds[Math.min(winds.length - 1, Math.floor(now / WIND_MS))];
    const busy = (slot) => shots.some((s) => s.slot === slot);
    const ready = (slot, now) => !busy(slot) && now >= cannons[slot].readyAt;

    function end(winner) {
      if (done) return;
      done = true;
      api.end({ winner });
    }

    function launch(slot, power) {
      const c = cannons[slot];
      const dir = slot === 0 ? 1 : -1;
      const a = (c.angle * Math.PI) / 180;
      const v = SPEED.min + (SPEED.max - SPEED.min) * power;
      shots.push({ id: nextId++, slot, x: CANNON_X[slot] + dir * 3 * Math.cos(a), y: CANNON_Y + 3 * Math.sin(a), vx: dir * v * Math.cos(a), vy: v * Math.sin(a) });
    }

    /** Moves one shot a little; returns how it ended, or null while it's still flying. */
    function step(s, dt, w) {
      s.vx += w * dt;
      s.vy -= GRAVITY * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      if (touches(s.x, s.y, WALL.x - WALL.w / 2, WALL.x + WALL.w / 2, WALL.h)) return 'wall';
      const t = towers[1 - s.slot];
      const tx = TOWER_X[1 - s.slot];
      if (t.blocks > 0 && touches(s.x, s.y, tx - BLOCK_W / 2, tx + BLOCK_W / 2, t.blocks * BLOCK_H)) return 'hit';
      if (s.y <= 0) return 'ground';
      if (s.x < -10 || s.x > FIELD.w + 10) return 'ground';
      return null;
    }

    function tick() {
      if (done) return;
      const now = api.elapsed();
      const dt = TICK_MS / 1000;
      cannons.forEach((c, slot) => {
        if (c.turn) c.angle = clamp(c.angle + c.turn * AIM_SPEED * dt, ANGLE.min, ANGLE.max);
        if (c.held && c.chargeAt === null && ready(slot, now)) c.chargeAt = now; // held through the reload
      });
      const w = wind(now);
      shots = shots.filter((s) => {
        for (let i = 0; i < STEPS; i++) {
          const kind = step(s, dt / STEPS, w);
          if (!kind) continue;
          last = { n: ++landed, slot: s.slot, kind, x: r1(s.x), y: r1(Math.max(0, s.y)), at: now };
          cannons[s.slot].readyAt = now + RELOAD_MS;
          if (kind === 'hit') {
            towers[1 - s.slot].blocks--;
            knocked[s.slot]++;
          }
          return false;
        }
        return true;
      });
      if (knocked.some((k) => k >= BLOCKS)) {
        api.update();
        const [a, b] = knocked.map((k) => k >= BLOCKS);
        return end(a && b ? null : a ? 0 : 1);
      }
      // Sent only when something on screen changed (a shot moving, an aim, the wind, a reload).
      const v = view();
      const key = JSON.stringify([v.shots, v.cannons, v.wind, v.last && v.last.n]);
      if (key !== shown) {
        shown = key;
        api.update();
      }
      api.setTimeout(tick, TICK_MS);
    }

    function view() {
      const now = api.elapsed();
      return {
        field: FIELD, wall: WALL, block: { w: BLOCK_W, h: BLOCK_H }, blocks: BLOCKS,
        towers: towers.map((t, i) => ({ x: TOWER_X[i], blocks: t.blocks })),
        cannons: cannons.map((c, i) => ({
          x: CANNON_X[i], y: CANNON_Y, angle: Math.round(c.angle),
          charging: c.chargeAt !== null, ready: ready(i, now),
        })),
        chargeMs: CHARGE_MS, angleMin: ANGLE.min, angleMax: ANGLE.max,
        shots: shots.map((s) => ({ id: s.id, slot: s.slot, x: r1(s.x), y: r1(s.y), vx: r1(s.vx), vy: r1(s.vy) })),
        wind: wind(now),
        knocked,
        last: last && now - last.at < SHOW_MS ? { n: last.n, slot: last.slot, kind: last.kind, x: last.x, y: last.y } : null,
      };
    }

    return {
      start() { api.setTimeout(tick, TICK_MS); },
      onInput(slot, input) {
        if (done || (slot !== 0 && slot !== 1)) return;
        const c = cannons[slot];
        const now = api.elapsed();
        if (input.type === 'aim') {
          if (!Number.isInteger(input.angle) || input.angle < ANGLE.min || input.angle > ANGLE.max) return;
          c.angle = input.angle;
          return; // the tick sends it, once
        } else if (input.type === 'turn') {
          if (typeof input.v !== 'number' || !Number.isFinite(input.v)) return;
          c.turn = clamp(input.v, -1, 1);
          return; // the tick moves it
        } else if (input.type === 'charge') {
          if (c.held) return;
          c.held = true;
          if (!ready(slot, now)) return; // starts when loaded, if still held
          c.chargeAt = Math.max(plausibleT(input.t, now), now - LAG_MS, c.readyAt);
        } else if (input.type === 'fire') {
          c.held = false;
          if (c.chargeAt === null) return;
          const held = plausibleT(input.t, now) - c.chargeAt;
          c.chargeAt = null;
          if (ready(slot, now)) launch(slot, clamp(held / CHARGE_MS, 0, 1));
        } else {
          return;
        }
        api.update();
      },
      onTimeUp: () => end(knocked[0] === knocked[1] ? null : knocked[0] > knocked[1] ? 0 : 1),
      /** Tests only: a shot of `slot`'s, already in the air. */
      debugShot: (slot, s) => shots.push({ id: nextId++, slot, ...s }),
      /** Tests only: the same wind all game. */
      debugWind: (w) => { winds = winds.map(() => w); },
      view,
    };
  },
};
