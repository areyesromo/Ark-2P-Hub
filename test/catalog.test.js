import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { catalog, CATALOG, IDEAS_MARK, guide, GUIDE } from '../tools/games-catalog.mjs';
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

test('the setup screen\'s 📖 How to play is the README\'s rules for every game (run `node tools/games-catalog.mjs` after changing them)', () => {
  assert.equal(fs.readFileSync(GUIDE, 'utf8').replace(/\r\n/g, '\n'), guide());
  const g = JSON.parse(guide());
  for (const game of listGames()) {
    assert.ok(g[game.id] && g[game.id].rules, game.id + ': its row in the README games table');
    assert.ok(!/[<>]script/i.test(JSON.stringify(g[game.id])));
  }
});

test('every game has a short line for its lobby card (the full description is on its setup screen)', () => {
  for (const game of listGames()) {
    assert.ok(game.blurb && game.blurb !== game.tagline, game.id + ': a line in server/games/blurbs.js');
    assert.ok(game.blurb.length <= 50, game.id + ': ' + game.blurb.length + ' letters');
  }
});

test('every game has a picture for its setup screen\'s preview (run `node tools/game-previews.mjs <id>` for a new one)', () => {
  for (const game of listGames()) {
    const file = `public/games/${game.id}/preview.jpg`;
    assert.ok(fs.existsSync(file), file);
    const size = fs.statSync(file).size;
    assert.ok(size > 2000 && size < 200 * 1024, file + ': ' + size + ' bytes');
  }
});
