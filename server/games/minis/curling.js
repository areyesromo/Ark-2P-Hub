// Curling (3D on the TV): two stones each, taken in turn, slid down the ice at the house (the
// target) at the far end. Swipe to throw: the angle aims, the speed is the power, a curve in it
// puts curl on the stone (it bends, more as it slows). While your stone slides, SWEEP (tap fast or
// shake) and it slows less, so it carries further. Stones knock each other about; one that hits the
// side boards or slides past the back line is out. Once all four are thrown, the stone nearest the
// middle of the house (the button) wins.
//
// Seen from above in metres: x across the sheet (0 in the middle), z down it from where you throw.
export const SHEET = { half: 1.1, button: 28, house: 1.8, back: 32 };
export const STONE_R = 0.145;
export const STONES = 2; // each
export const THROW = { minSpeed: 4.5, maxSpeed: 7.3, maxAngle: 0.04 };
export const ICE = { decel: 0.8, swept: 0.8, sweepMs: 300, curl: 0.12 };
export const TICK_MS = 50;
const SUB = 5; // physics steps a tick

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const r3 = (n) => Math.round(n * 1000) / 1000;

export default {
  id: 'curling', kind: 'party', look: '3d', name: 'Curling', order: 'SLIDE AND SWEEP!', howTo: 'Swipe to throw (curve it for curl), then tap SWEEP to carry it further. Nearest the middle wins', durationMs: 50000,
  create(api) {
    let stones = []; // { slot, x, z, vx, vz, spin, moving }
    const thrown = [0, 0];
    let turn = 0;
    let phase = 'aim'; // 'aim' | 'sliding' | 'done'
    const sweptAt = [-Infinity, -Infinity];
    let timer = null;
    let done = false;

    function finish() {
      if (done) return;
      done = true;
      if (timer) api.clearTimeout(timer);
      phase = 'done';
      // The stone nearest the button (in the house or not), if any are left.
      const d = (s) => Math.hypot(s.x, s.z - SHEET.button);
      const near = stones.slice().sort((a, b) => d(a) - d(b));
      const winner = !near.length ? null : near.length > 1 && Math.abs(d(near[0]) - d(near[1])) < 1e-6 && near[0].slot !== near[1].slot ? null : near[0].slot;
      api.end({ winner });
    }

    function tick() {
      timer = null;
      const now = api.elapsed();
      const dt = TICK_MS / 1000 / SUB;
      for (let k = 0; k < SUB; k++) {
        for (const s of stones) {
          if (!s.moving) continue;
          const v = Math.hypot(s.vx, s.vz);
          // Sweeping (the thrower's, while it keeps going) and the ice's drag.
          const swept = now - sweptAt[s.slot] < ICE.sweepMs && s.thrownBy === s.slot && s.live;
          const slow = ICE.decel * (swept ? ICE.swept : 1) * dt;
          if (v <= slow) {
            s.vx = s.vz = 0;
            s.moving = false;
            continue;
          }
          s.vx *= (v - slow) / v;
          s.vz *= (v - slow) / v;
          // Curl: sideways, more as it slows.
          if (s.spin) s.vx += (s.spin * ICE.curl * dt) / (0.5 + v);
          s.x += s.vx * dt;
          s.z += s.vz * dt;
        }
        // Stone on stone: equal weights, a little bounce lost.
        for (let i = 0; i < stones.length; i++) {
          for (let j = i + 1; j < stones.length; j++) {
            const a = stones[i];
            const b = stones[j];
            const dx = b.x - a.x;
            const dz = b.z - a.z;
            const d = Math.hypot(dx, dz);
            if (d >= 2 * STONE_R || d === 0) continue;
            const nx = dx / d;
            const nz = dz / d;
            const push = (2 * STONE_R - d) / 2;
            a.x -= nx * push;
            a.z -= nz * push;
            b.x += nx * push;
            b.z += nz * push;
            const rel = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
            if (rel <= 0) continue;
            const j2 = rel * 0.95;
            a.vx -= j2 * nx;
            a.vz -= j2 * nz;
            b.vx += j2 * nx;
            b.vz += j2 * nz;
            a.moving = b.moving = true;
            a.live = b.live = false; // (a stone that's been hit, or hit one, is past sweeping)
          }
        }
        // Into the boards or past the back line: out.
        stones = stones.filter((s) => Math.abs(s.x) <= SHEET.half - STONE_R && s.z <= SHEET.back);
      }
      if (stones.some((s) => s.moving)) {
        timer = api.setTimeout(tick, TICK_MS);
        return api.update();
      }
      // All still: the next throw, or the end.
      if (thrown[0] + thrown[1] >= 2 * STONES) return finish();
      turn = 1 - turn;
      phase = 'aim';
      api.update();
    }

    return {
      start() {},
      onInput(slot, input) {
        if (done || (slot !== 0 && slot !== 1)) return;
        if (input.type === 'sweep') {
          if (phase === 'sliding' && slot === turn) sweptAt[slot] = api.elapsed();
          return;
        }
        if (input.type !== 'throw' || phase !== 'aim' || slot !== turn || thrown[slot] >= STONES) return;
        if (![input.aim, input.power, input.curl].every(num)) return;
        const speed = THROW.minSpeed + (THROW.maxSpeed - THROW.minSpeed) * clamp(input.power, 0, 1);
        const a = clamp(input.aim, -1, 1) * THROW.maxAngle;
        stones.push({ slot, thrownBy: slot, live: true, x: 0, z: 0, vx: Math.sin(a) * speed, vz: Math.cos(a) * speed, spin: clamp(input.curl, -1, 1), moving: true });
        thrown[slot]++;
        phase = 'sliding';
        if (!timer) timer = api.setTimeout(tick, TICK_MS);
        api.update();
      },
      onTimeUp: finish,
      view: () => ({
        phase, turn, thrown, stonesEach: STONES, sheet: SHEET, stoneR: STONE_R,
        moving: stones.some((s) => s.moving),
        stones: stones.map((s) => ({ slot: s.slot, x: r3(s.x), z: r3(s.z), moving: s.moving })),
        sweeping: [0, 1].map((s) => api.elapsed() - sweptAt[s] < ICE.sweepMs),
      }),
      debugStones(list) {
        stones = list.map((s) => ({ ...s, thrownBy: s.slot, live: false, vx: 0, vz: 0, spin: 0, moving: false }));
      },
      debugFinish: finish,
    };
  },
};
