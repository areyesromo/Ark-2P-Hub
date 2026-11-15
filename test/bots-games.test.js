// Every game with a computer opponent, except the slow ones (bots-games-*.test.js): it plays a
// whole game against itself at every level, and in an action game Hard beats Easy.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BOT_GAMES, HEAVY, gameTests } from './helpers-bots.js';

const heavy = Object.values(HEAVY).flat();

test('the slow games split off into their own files are all real games with a computer', () => {
  for (const id of heavy) assert.ok(BOT_GAMES.includes(id), id);
});

gameTests(BOT_GAMES.filter((id) => !heavy.includes(id)));
