// Coin Grab: run around the field grabbing coins before they fade. Touch a
// 💣 and you're stunned for a moment. Most coins wins.
export const TICK_MS = 50;
export const SPEED = 0.6; // field widths per second
export const GRAB_R = 0.07;
export const STUN_MS = 1500;
export const SPAWN_MS = 700;
export const ITEM_MS = 4000;
export const BOMB_CHANCE = 0.2;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export default {
  id: 'coin-grab', kind: 'party', look: '2d', name: 'Coin Grab', order: 'GRAB THE COINS!', howTo: 'Move (joystick / stick) to grab coins, dodge the bombs', durationMs: 30000,
  create(api) {
    const players = [{ x: 0.25, y: 0.5 }, { x: 0.75, y: 0.5 }].map((p) => ({ ...p, vx: 0, vy: 0, stunUntil: 0 }));
    const coins = [0, 0];
    let items = [];
    let nextId = 1;
    const add = (it) => items.push({ id: nextId++, born: api.now(), ...it });

    function spawn() {
      add({ x: Math.round((0.08 + api.rng() * 0.84) * 1000) / 1000, y: Math.round((0.1 + api.rng() * 0.8) * 1000) / 1000, bomb: api.rng() < BOMB_CHANCE });
      api.setTimeout(spawn, SPAWN_MS);
    }

    function tick() {
      const now = api.now();
      const step = (SPEED * TICK_MS) / 1000;
      players.forEach((p, slot) => {
        if (now >= p.stunUntil) {
          p.x = clamp(p.x + p.vx * step, 0.03, 0.97);
          p.y = clamp(p.y + p.vy * step, 0.05, 0.95);
        }
        items = items.filter((it) => {
          if (Math.hypot(it.x - p.x, it.y - p.y) > GRAB_R) return true;
          if (it.bomb) p.stunUntil = now + STUN_MS;
          else coins[slot]++;
          return false;
        });
      });
      items = items.filter((it) => now - it.born < ITEM_MS);
      api.update();
      api.setTimeout(tick, TICK_MS);
    }

    return {
      start() {
        api.setTimeout(spawn, SPAWN_MS);
        api.setTimeout(tick, TICK_MS);
      },
      onInput(slot, input) {
        if (input.type !== 'move' || (slot !== 0 && slot !== 1)) return;
        let { x, y } = input;
        if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
        const d = Math.hypot(x, y);
        if (d > 1) {
          x /= d;
          y /= d;
        }
        players[slot].vx = x;
        players[slot].vy = y;
      },
      /** Tests only: put an item down. */
      debugItem: (it) => add(it),
      onTimeUp: () => api.end({ winner: coins[0] === coins[1] ? null : coins[0] > coins[1] ? 0 : 1 }),
      view: () => ({
        players: players.map((p) => ({ x: Math.round(p.x * 1000) / 1000, y: Math.round(p.y * 1000) / 1000, stunned: api.now() < p.stunUntil })),
        items: items.map((it) => ({ id: it.id, x: it.x, y: it.y, bomb: it.bomb, age: api.now() - it.born })),
        coins,
        life: ITEM_MS,
      }),
    };
  },
};
