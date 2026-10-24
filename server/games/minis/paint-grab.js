// Paint Grab (3D on the TV): a floor of tiles. Every tile you drive over turns your colour, your
// rival's too; a tile you're both standing on stays whoever's it was. Now and then a paint bucket
// turns up: grab it to splash the 3 x 3 tiles around it. Most tiles in your colour at time up wins.
export const COLS = 12;
export const ROWS = 8;
export const SPEED = 3.5; // tiles a second
export const BUCKET_MS = 5000; // a bucket turns up this often (if there isn't one)
export const BUCKET_LIFE_MS = 6000;
export const TICK_MS = 50;
const DURATION_MS = 30000;
const EDGE = 0.3; // how close to the edge of the floor you can go

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r2 = (v) => Math.round(v * 100) / 100;

export default {
  id: 'paint-grab', kind: 'party', look: '3d', name: 'Paint Grab', order: 'PAINT THE FLOOR!', howTo: 'Move (joystick / stick) to paint the tiles your colour. Grab the paint buckets for a big splash!', durationMs: DURATION_MS,
  create(api) {
    // Opposite corners of the middle, mirrored through the centre.
    const players = [{ x: 2.5, y: 3.5 }, { x: COLS - 2.5, y: ROWS - 3.5 }].map((p) => ({ ...p, vx: 0, vy: 0 }));
    const tiles = Array(COLS * ROWS).fill('.');
    let bucket = null; // { id, c, r, until }
    let buckets = 0;
    let nextBucket = BUCKET_MS;
    let splash = null; // the latest bucket grabbed: { n, slot, c, r }
    let done = false;
    let shown = '';

    const tileOf = (p) => [Math.floor(p.x), Math.floor(p.y)];
    const counts = () => [0, 1].map((s) => tiles.filter((t) => t === String(s)).length);

    function paint() {
      const [a, b] = players.map(tileOf);
      const same = a[0] === b[0] && a[1] === b[1];
      if (same) return; // both on it: it stays as it was, and nobody grabs a bucket there
      [a, b].forEach(([c, r], slot) => {
        tiles[r * COLS + c] = String(slot);
        if (bucket && bucket.c === c && bucket.r === r) {
          for (let dc = -1; dc <= 1; dc++) {
            for (let dr = -1; dr <= 1; dr++) {
              const cc = c + dc;
              const rr = r + dr;
              if (cc >= 0 && cc < COLS && rr >= 0 && rr < ROWS) tiles[rr * COLS + cc] = String(slot);
            }
          }
          splash = { n: bucket.id, slot, c, r };
          bucket = null;
        }
      });
    }

    function spawnBucket(now) {
      // Somewhere not right next to either of you (a few tries; else anywhere).
      let c = 0;
      let r = 0;
      for (let i = 0; i < 10; i++) {
        c = Math.floor(api.rng() * COLS);
        r = Math.floor(api.rng() * ROWS);
        if (players.every((p) => Math.max(Math.abs(Math.floor(p.x) - c), Math.abs(Math.floor(p.y) - r)) > 1)) break;
      }
      bucket = { id: ++buckets, c, r, until: now + BUCKET_LIFE_MS };
    }

    function view() {
      return {
        cols: COLS, rows: ROWS,
        tiles: tiles.join(''),
        players: players.map((p) => ({ x: r2(p.x), y: r2(p.y) })),
        bucket: bucket && { id: bucket.id, c: bucket.c, r: bucket.r },
        splash,
        counts: counts(),
      };
    }

    function tick() {
      if (done) return;
      const now = api.elapsed();
      const step = (SPEED * TICK_MS) / 1000;
      players.forEach((p) => {
        p.x = clamp(p.x + p.vx * step, EDGE, COLS - EDGE);
        p.y = clamp(p.y + p.vy * step, EDGE, ROWS - EDGE);
      });
      if (bucket && now >= bucket.until) bucket = null;
      if (now >= nextBucket) {
        nextBucket += BUCKET_MS;
        if (!bucket) spawnBucket(now);
      }
      paint();
      const key = JSON.stringify(view());
      if (key !== shown) {
        shown = key;
        api.update();
      }
      api.setTimeout(tick, TICK_MS);
    }

    return {
      start() { api.setTimeout(tick, TICK_MS); },
      onInput(slot, input) {
        if (done || (slot !== 0 && slot !== 1) || input.type !== 'move') return;
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
      onTimeUp() {
        if (done) return;
        done = true;
        const [a, b] = counts();
        api.end({ winner: a === b ? null : a > b ? 0 : 1 });
      },
      /** Tests only: place a player. */
      debugPlace: (slot, p) => Object.assign(players[slot], p),
      /** Tests only: put a bucket down. */
      debugBucket: ({ c, r }) => { bucket = { id: ++buckets, c, r, until: api.elapsed() + BUCKET_LIFE_MS }; },
      view,
    };
  },
};
