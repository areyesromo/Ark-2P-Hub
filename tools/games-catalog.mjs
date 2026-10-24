// games-catalog.mjs: write docs/GAMES.md, every game and minigame in the hub with what it is and
// its files, so new ideas don't repeat what's there. The ideas list at the bottom is hand-written
// and kept when the file is regenerated.
//   node tools/games-catalog.mjs          (test/catalog.test.js fails when the file is out of date)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listGames } from '../server/games/index.js';
import { MICROS, PARTIES } from '../server/games/minis/index.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CATALOG = path.join(ROOT, 'docs', 'GAMES.md');
export const IDEAS_MARK = '<!-- ideas: hand-written below this line, kept when the file is regenerated -->';
const CATEGORY = { competitive: '⚔️ Competitive', board: '🎲 Dice & Board', casual: '🤝 Co-op & casual' };
// Helper files a game uses that don't start with its id.
const EXTRA = {
  'draw-duel': ['server/games/draw-shapes.js', 'server/games/shape-library.js'],
  'sketch-guess': ['server/games/sketch-words.js'],
  'anagram-duel': ['server/games/anagram-words.js'],
  'party-board': ['server/games/board/', 'public/games/minis/'],
  'party-minis': ['server/games/minis/', 'public/games/minis/'],
  'micro-mayhem': ['server/games/minis/', 'public/games/minis/'],
};

const exists = (rel) => fs.existsSync(path.join(ROOT, rel));
const ls = (dir) => (exists(dir) ? fs.readdirSync(path.join(ROOT, dir)).sort() : []);
const code = (list) => list.map((f) => '`' + f + '`').join(', ');

/** Test files that import `module` (a path under server/games/). */
function testsFor(module) {
  return ls('test').filter((f) => f.endsWith('.test.js') && fs.readFileSync(path.join(ROOT, 'test', f), 'utf8').includes(module)).map((f) => 'test/' + f);
}

function gameFiles(id, ids) {
  // `<id>.js` and `<id>-*.js`, unless the file is another game's (`party-board` isn't `party`'s).
  const mine = (f, g) => f === g + '.js' || (f.startsWith(g + '-') && f.endsWith('.js'));
  const server = ls('server/games').filter((f) => mine(f, id) && !ids.some((g) => g.length > id.length && mine(f, g))).map((f) => 'server/games/' + f);
  const pub = exists('public/games/' + id) ? ['public/games/' + id + '/'] : [];
  return server.concat(EXTRA[id] || [], pub, testsFor('games/' + id + '.js'));
}

function miniFiles(id) {
  const out = ['server/games/minis/' + id + '.js'];
  if (exists('public/games/minis/' + id + '.js')) out.push('public/games/minis/' + id + '.js');
  return out.concat(testsFor('minis/' + id + '.js'));
}

const cell = (s) => String(s).replace(/\|/g, '\\|').replace(/\n/g, ' ');

/** The generated part of the catalog (everything above the ideas). */
export function generated() {
  const games = listGames();
  const lines = [
    '# Ark 2P Hub: game catalog',
    '',
    'Every game and minigame in the hub, what it is and where its code lives. **Check here before adding',
    'a game**, so it doesn\'t repeat one we have; add new ideas to the list at the bottom.',
    '',
    'The tables are generated from the code: run `node tools/games-catalog.mjs` after adding or',
    'renaming a game or minigame (`test/catalog.test.js` fails until you do). A game is a module in',
    '`server/games/` listed in `server/games/index.js`, with its TV and phone screens in',
    '`public/games/<id>/`; a minigame is a module in `server/games/minis/` listed in',
    '`server/games/minis/index.js`, with its screens in `public/games/minis/<id>.js`.',
    '',
    `## Games (${games.length})`,
  ];
  for (const cat of Object.keys(CATEGORY)) {
    const list = games.filter((g) => g.category === cat);
    lines.push('', `### ${CATEGORY[cat]} (${list.length})`, '', '| Game | id | What it is | Files |', '| --- | --- | --- | --- |');
    for (const g of list) lines.push(`| ${cell(g.name)} | \`${g.id}\` | ${cell(g.tagline)} | ${code(gameFiles(g.id, games.map((x) => x.id)))} |`);
  }
  const minis = [...MICROS.map((m) => ['micro', m]), ...PARTIES.map((m) => ['party', m])];
  lines.push(
    '',
    `## Minigames (${minis.length})`,
    '',
    'Micro minigames (a few seconds each) play in **Micro Mayhem**; party minigames (up to about 30 s)',
    'play in **Party Minigames** and after every round of **Party Board**. 3D ones use three.js.',
    '',
    '| Minigame | id | Kind | Look | How to play | Files |',
    '| --- | --- | --- | --- | --- | --- |',
  );
  for (const [kind, m] of minis) lines.push(`| ${cell(m.name)} | \`${m.id}\` | ${kind} | ${(m.look || '2d').toUpperCase()} | ${cell(m.howTo)} | ${code(miniFiles(m.id))} |`);
  lines.push('', '## Ideas (not built yet)', '');
  return lines.join('\n');
}

const DEFAULT_IDEAS = '\n_None yet._\n';

/** The whole catalog: the generated part plus the ideas kept from `previous` (if any). */
export function catalog(previous) {
  const at = previous ? previous.indexOf(IDEAS_MARK) : -1;
  const ideas = at === -1 ? DEFAULT_IDEAS : previous.slice(at + IDEAS_MARK.length);
  return generated() + IDEAS_MARK + ideas;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const before = exists('docs/GAMES.md') ? fs.readFileSync(CATALOG, 'utf8') : '';
  fs.writeFileSync(CATALOG, catalog(before));
  console.log('wrote docs/GAMES.md');
}
