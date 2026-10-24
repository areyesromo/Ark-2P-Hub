// Laser Dodge: the same lasers sweep across both lanes. A low beam is jumped, a high one ducked
// under; each flashes a warning first, and they come faster as it goes on. A hit costs a life
// (one per beam); out of lives, your rival wins. At time up, more lives wins.
export const TICK_MS = 25;
export const LIVES = 3;
export const JUMP_MS = 600;
export const HIT_MS = 250; // how long a beam is live
export const WARN_MS = [1000, 550]; // warning before a beam, from the start to the end
export const GAP_MS = [1700, 800]; // between beams, from the start to the end
const DURATION_MS = 40000;

const lerp = (range, k) => range[0] + (range[1] - range[0]) * Math.min(1, k);

export default {
  id: 'laser-dodge', kind: 'party', look: '2d', name: 'Laser Dodge', order: 'DODGE THE LASERS!', howTo: 'Low beam: JUMP (A). High beam: hold DUCK (B)', durationMs: DURATION_MS,
  create(api) {
    // The whole run of beams, one list for both: { id, at, warn, kind }, in minigame time
    // (api.elapsed(); api.now() is the room's clock).
    const beams = [];
    for (let at = 1500, id = 1; at < DURATION_MS; id++) {
      const k = at / DURATION_MS;
      beams.push({ id, at: Math.round(at), warn: Math.round(lerp(WARN_MS, k)), kind: api.rng() < 0.5 ? 'low' : 'high' });
      at += lerp(GAP_MS, k) * (0.85 + api.rng() * 0.3);
    }
    const players = [0, 1].map(() => ({ lives: LIVES, airUntil: 0, duck: false, hitBy: 0, hitAt: -Infinity }));
    let done = false;

    function tick() {
      if (done) return;
      const now = api.elapsed();
      for (const b of beams) {
        if (now < b.at || now >= b.at + HIT_MS) continue;
        players.forEach((p) => {
          if (p.lives === 0 || p.hitBy === b.id) return;
          const safe = b.kind === 'low' ? now < p.airUntil : p.duck && now >= p.airUntil;
          if (!safe) {
            p.lives--;
            p.hitBy = b.id;
            p.hitAt = now;
          }
        });
      }
      const out = players.map((p) => p.lives === 0);
      if (out[0] || out[1]) {
        done = true;
        return api.end({ winner: out[0] && out[1] ? null : out[0] ? 1 : 0 });
      }
      api.update();
      api.setTimeout(tick, TICK_MS);
    }

    return {
      start() {
        api.setTimeout(tick, TICK_MS);
      },
      onInput(slot, input) {
        if (done || (slot !== 0 && slot !== 1)) return;
        const p = players[slot];
        const now = api.elapsed();
        if (input.type === 'jump') {
          if (p.duck || now < p.airUntil) return; // no jumping from a duck, or in the air
          p.airUntil = now + JUMP_MS;
        } else if (input.type === 'duck' && typeof input.on === 'boolean') {
          p.duck = input.on;
        } else {
          return;
        }
        api.update();
      },
      onTimeUp() {
        const [a, b] = players;
        api.end({ winner: a.lives === b.lives ? null : a.lives > b.lives ? 0 : 1 });
      },
      view: () => {
        const now = api.elapsed();
        return {
          lives: LIVES,
          // The beams being warned about or live: inMs counts down to the beam, then goes negative.
          beams: beams.filter((b) => now >= b.at - b.warn && now < b.at + HIT_MS).map((b) => ({ id: b.id, kind: b.kind, inMs: b.at - now })),
          players: players.map((p) => ({ lives: p.lives, air: now < p.airUntil, duck: p.duck, hit: now - p.hitAt < 600 })),
        };
      },
    };
  },
};
