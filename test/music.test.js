// The TV's background music composer (public/host/music.js), run in Node.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { listGames, MUSIC_MOODS } from '../server/games/index.js';

function loadMusic() {
  const window = {};
  vm.runInNewContext(fs.readFileSync('public/host/music.js', 'utf8'), { window, setInterval, clearInterval, setTimeout, Math });
  return window.ArkMusic;
}

const INSTRUMENTS = ['kick', 'snare', 'hat', 'bass', 'pad', 'stab', 'arp', 'pluck', 'lead'];
const melody = (bar) => JSON.stringify(bar.filter((n) => n.inst === 'lead'));

test('every mood composes sensible bars: notes on the grid, in range, known instruments', () => {
  const M = loadMusic();
  assert.deepEqual(Array.from(M.moods).sort(), ['action', 'casual', 'lobby', 'thinking']); // (from the vm's realm)
  for (const mood of M.moods) {
    for (let bar = 0; bar < 16; bar++) {
      const notes = M.compose(mood, bar, 42);
      assert.ok(notes.length > 4, `${mood} bar ${bar} has notes`);
      for (const n of notes) {
        assert.ok(INSTRUMENTS.includes(n.inst), n.inst);
        assert.ok(Number.isInteger(n.step) && n.step >= 0 && n.step < 16);
        assert.ok(n.len > 0 && n.vel > 0 && n.vel <= 1);
        if (n.midi !== undefined) assert.ok(n.midi >= 24 && n.midi <= 100, `${mood} ${n.inst} midi ${n.midi}`);
      }
      assert.ok(notes.some((n) => n.inst === 'kick'), 'a beat');
      assert.ok(notes.some((n) => n.inst === 'bass'), 'a bass line');
    }
  }
  assert.equal(M.compose('no such mood', 0, 1).length, 0);
});

test('melodies: the same seed replays, bars 4-7 echo bars 0-3, each 8-bar phrase is new', () => {
  const M = loadMusic();
  for (const mood of M.moods) {
    assert.equal(JSON.stringify(M.compose(mood, 3, 7)), JSON.stringify(M.compose(mood, 3, 7)), 'deterministic');
    for (let bar = 0; bar < 4; bar++) assert.equal(melody(M.compose(mood, bar + 4, 7)), melody(M.compose(mood, bar, 7)), `${mood} echo`);
    const first = [0, 1, 2, 3].map((b) => melody(M.compose(mood, b, 7))).join();
    const next = [8, 9, 10, 11].map((b) => melody(M.compose(mood, b, 7))).join();
    const other = [0, 1, 2, 3].map((b) => melody(M.compose(mood, b, 8))).join();
    assert.notEqual(next, first, `${mood}: a new phrase every 8 bars`);
    assert.notEqual(other, first, `${mood}: a new seed, a new tune`);
  }
});

test('every game asks for a mood the TV can play', () => {
  const M = loadMusic();
  for (const mood of MUSIC_MOODS) assert.ok(M.moods.includes(mood), mood);
  for (const g of listGames()) assert.ok(MUSIC_MOODS.includes(g.music), `${g.id}: ${g.music}`);
  const mood = Object.fromEntries(listGames().map((g) => [g.id, g.music]));
  assert.equal(mood.pong, 'action');
  assert.equal(mood.quiz, 'thinking');
  assert.equal(mood['sketch-guess'], 'casual');
});
