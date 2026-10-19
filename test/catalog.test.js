import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { catalog, CATALOG, IDEAS_MARK } from '../tools/games-catalog.mjs';
import { listGames } from '../server/games/index.js';
import { MICROS, PARTIES } from '../server/games/minis/index.js';

const text = fs.readFileSync(CATALOG, 'utf8').replace(/\r\n/g, '\n'); // a Windows checkout may add CRs

test('docs/GAMES.md lists every game and minigame (run `node tools/games-catalog.mjs` after adding one)', () => {
  assert.equal(text, catalog(text));
  for (const g of listGames()) assert.ok(text.includes('`' + g.id + '`'), g.id);
  for (const m of [...MICROS, ...PARTIES]) assert.ok(text.includes('`' + m.id + '`'), m.id);
});

test('docs/GAMES.md: no idea has the name of a game or minigame we already have', () => {
  const have = new Set([...listGames(), ...MICROS, ...PARTIES].map((g) => g.name.toLowerCase()));
  const ideas = [...text.slice(text.indexOf(IDEAS_MARK)).matchAll(/^- \*\*(.+?)\*\*/gm)].map((m) => m[1]);
  assert.ok(ideas.length > 0);
  for (const name of ideas) assert.ok(!have.has(name.toLowerCase()), `"${name}" is built: move it out of the ideas`);
});
