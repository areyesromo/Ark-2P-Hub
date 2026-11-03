// Lobby labels: 📱 No TV needed (a game you can play on the phones alone) and 🤸 Motion (one you
// can play by tilting or moving the phone).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { listGames } from '../server/games/index.js';

test('📱 No TV needed: the games with a handheld mode', () => {
  const handheld = listGames().filter((g) => g.handheld).map((g) => g.id).sort();
  assert.deepEqual(handheld, ['dice-party']);
});

test('🤸 Motion: every game whose phone controls can use tilt or movement', () => {
  const motion = listGames().filter((g) => g.motion).map((g) => g.id).sort();
  assert.deepEqual(motion, ['asteroid-duel', 'kart-race', 'kart-race-3d', 'kitchen-rush', 'marble-maze', 'micro-mayhem', 'party-board', 'party-minis', 'sumo', 'tanks']);
  // ...and every game whose phone renderer loads the tilt, motion or move-pad helpers is labelled.
  const usesMotion = (id) => {
    const f = 'public/games/' + id + '/player.js';
    return fs.existsSync(f) && /tilt\.js|motion\.js|move-pad\.js|loadRenderer\('player', '(kart-race)'\)/.test(fs.readFileSync(f, 'utf8'));
  };
  for (const g of listGames()) if (usesMotion(g.id)) assert.ok(g.motion, g.id + ' uses motion but has no label');
});

test('the labels are booleans on every game', () => {
  for (const g of listGames()) {
    assert.equal(typeof g.handheld, 'boolean', g.id);
    assert.equal(typeof g.motion, 'boolean', g.id);
  }
});
