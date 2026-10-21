import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../public/games/kart-race/racers.js';

const R = globalThis.ArkKartRacers;
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} vs ${b}`);

test('roster: 12 racers, unique ids, every type has an m and an f with equal stats totalling 12', () => {
  assert.equal(R.RACERS.length, 12);
  assert.equal(new Set(R.RACERS.map((r) => r.id)).size, 12);
  for (const type of Object.keys(R.TYPES)) {
    const pair = R.RACERS.filter((r) => r.type === type);
    assert.deepEqual(pair.map((r) => r.gender).sort(), ['f', 'm'], type);
    assert.deepEqual(pair[0].stats, pair[1].stats, type);
    const s = pair[0].stats;
    assert.equal(s.speed + s.accel + s.handling + s.weight, 12, type);
  }
});

test('tyres: five, standard first; unknown ids fall back to the defaults', () => {
  assert.equal(R.TYRES.length, 5);
  assert.equal(R.TYRES[0].id, 'standard');
  assert.equal(R.racer('nope').id, 'dash');
  assert.equal(R.tyre('nope').id, 'standard');
  assert.deepEqual(R.DEFAULT_RACERS, ['dash', 'dot']);
  assert.equal(R.racer('daisy').id, 'dot', "Daisy's new name (phones may still remember the old one)");
  assert.equal(R.racer('dot').name, 'Dot');
  assert.equal(R.DEFAULT_TYRE, 'standard');
});

test("physics: all-3s on Standard is today's kart", () => {
  const p = R.physics('dash', 'standard');
  const want = { maxSpeed: 8.5, boostSpeed: 12.5, accel: 9, turnRate: 2.8, grip: 1.2, weight: 1, grassSpeed: 3.2 };
  assert.deepEqual(Object.keys(p).sort(), Object.keys(want).sort());
  for (const k of Object.keys(want)) near(p[k], want[k], k);
});

test('stats: tyres shift stats', () => {
  assert.deepEqual(R.stats('rex', 'slicks'), { speed: 6, accel: 2, handling: 1, weight: 3 });
  assert.ok(R.physics('rex', 'slicks').maxSpeed > R.physics('rex', 'standard').maxSpeed);
});

test('monster tyres halve the grass slowdown', () => {
  const p = R.physics('dash', 'monster');
  near(p.maxSpeed - p.grassSpeed, (8.5 - 3.35) / 2, 'grass loss');
});

test('art: every racer has a portrait file; sprites, where listed, exist too', async () => {
  const { existsSync } = await import('node:fs');
  const file = (p) => new URL('../public' + p, import.meta.url);
  for (const r of R.RACERS) {
    assert.ok(existsSync(file(r.portrait)), r.portrait);
    if (r.sprite) assert.ok(existsSync(file(r.sprite)), r.sprite);
  }
  assert.ok(R.RACERS.every((r) => r.sprite), 'every racer has a kart picture');
});

test('art: kart pictures are 256 px tall with a see-through background; each has an empty twin for 3D', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const file = (p) => new URL('../public' + p, import.meta.url);
  for (const r of R.RACERS) {
    const empty = r.sprite.replace('/karts/', '/karts/empty/');
    assert.ok(existsSync(file(empty)), `${r.id}: empty kart`);
    for (const p of [r.sprite, empty]) {
      const b = readFileSync(file(p));
      assert.equal(b.toString('ascii', 12, 16), 'VP8X', `${p}: extended WebP`);
      assert.ok(b[20] & 0x10, `${p}: has alpha`);
      assert.equal(b.readUIntLE(27, 3) + 1, 256, `${p}: 256 tall`);
    }
  }
});

test('art: karts are drawn 1.75 long on the TV, and two side by side still fit across the road', async () => {
  const { TRACK_WIDTH } = await import('../server/games/kart-race.js');
  const { readFileSync } = await import('node:fs');
  assert.equal(R.KART_LEN, 1.75);
  for (const r of R.RACERS) {
    const b = readFileSync(new URL('../public' + r.sprite, import.meta.url));
    const wide = (R.KART_LEN * (b.readUIntLE(24, 3) + 1)) / (b.readUIntLE(27, 3) + 1);
    assert.ok(2 * wide < TRACK_WIDTH, `${r.id}: ${wide.toFixed(2)} wide`);
  }
});
