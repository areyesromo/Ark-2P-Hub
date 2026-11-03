// Lobby labels: 📱 No TV needed (a game you can play on the phones alone) and 🤸 Motion (one you
// can play by tilting or moving the phone).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { listGames } from '../server/games/index.js';

test('📱 No TV needed: the games whose phones show everything (Dice Party with its Handheld screen)', () => {
  const handheld = listGames().filter((g) => g.handheld).map((g) => g.id).sort();
  assert.deepEqual(handheld, [
    'air-hockey', 'anagram-duel', 'battleship', 'bomb-squad', 'checkers', 'connect-four', 'crazy-eights', 'dice-party',
    'dots-boxes', 'draw-duel', 'fake-out', 'liars-dice', 'mancala', 'memory-match', 'mind-meld', 'mini-golf', 'quiz',
    'reaction-duel', 'rock-paper-scissors', 'sketch-guess', 'trivia-quest', 'word-hunt', 'word-race',
  ]);
});

test('🤸 Motion: every game whose phone controls can use tilt or movement', () => {
  const motion = listGames().filter((g) => g.motion).map((g) => g.id).sort();
  assert.deepEqual(motion, ['asteroid-duel', 'dungeon-duo', 'kart-race', 'kart-race-3d', 'kitchen-rush', 'marble-maze', 'micro-mayhem', 'party-board', 'party-minis', 'sumo', 'tanks']);
  // ...and every game whose phone renderer loads the tilt, motion or move-pad helpers is labelled,
  // directly or through a script it loads (the minigames' mini.js) or a renderer it borrows.
  const MOTION = /\/(tilt|motion|move-pad)\.js/;
  const loads = (file, seen = new Set()) => {
    if (seen.has(file) || !fs.existsSync(file)) return false;
    seen.add(file);
    const src = fs.readFileSync(file, 'utf8');
    if (MOTION.test(src)) return true;
    const scripts = [...src.matchAll(/loadScript\('\/(games\/[^']+\.js)'\)/g)].map((m) => 'public/' + m[1]);
    const borrowed = [...src.matchAll(/loadRenderer\('player', '([^']+)'\)/g)].map((m) => 'public/games/' + m[1] + '/player.js');
    return scripts.concat(borrowed).some((f) => loads(f, seen));
  };
  const usesMotion = (id) => loads('public/games/' + id + '/player.js');
  for (const id of ['party-minis', 'micro-mayhem', 'kart-race-3d']) assert.ok(usesMotion(id), id + ' found through what it loads');
  for (const g of listGames()) if (usesMotion(g.id)) assert.ok(g.motion, g.id + ' uses motion but has no label');
});

test('the labels are booleans on every game', () => {
  for (const g of listGames()) {
    assert.equal(typeof g.handheld, 'boolean', g.id);
    assert.equal(typeof g.motion, 'boolean', g.id);
  }
});
