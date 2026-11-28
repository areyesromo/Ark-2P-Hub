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
const CATEGORY = { competitive: '⚔️ Competitive', board: '🎲 Dice & Board', casual: '🤝 Co-op & casual', arcade: '👤 Solo: 🕹️ Arcade', puzzle: '👤 Solo: 🧩 Puzzle', brain: '👤 Solo: 🧠 Brain' };
// Helper files a game uses that don't start with its id.
const EXTRA = {
  'draw-duel': ['server/games/draw-shapes.js', 'server/games/shape-library.js'],
  'sketch-guess': ['server/games/sketch-words.js'],
  'anagram-duel': ['server/games/anagram-words.js'],
  'five-letters': ['server/games/anagram-words.js'],
  'trivia-quest': ['server/games/quiz.js', 'server/games/quiz-questions.js', 'public/games/quiz/style.css'],
  'party-board': ['server/games/board/', 'public/games/minis/'],
  'party-minis': ['server/games/minis/', 'public/games/minis/'],
  'micro-mayhem': ['server/games/minis/', 'public/games/minis/'],
  'kart-race-3d': ['server/games/kart-race.js', 'server/games/kart-items.js', 'server/games/kart-tracks-3d.js', 'public/games/kart-race/'],
  'air-hockey': ['server/games/hand.js'],
  pong: ['server/games/hand.js'],
  'brick-duel': ['server/games/hand.js'],
  holdem: ['public/games/blackjack/table.js', 'public/games/blackjack/style.css'],
  speed: ['public/games/blackjack/table.js', 'public/games/blackjack/style.css'],
  cribbage: ['public/games/blackjack/table.js', 'public/games/blackjack/style.css'],
  'video-poker': ['server/games/holdem-hands.js', 'public/games/blackjack/table.js', 'public/games/blackjack/style.css'],
  'go-fish': ['public/games/blackjack/table.js', 'public/games/blackjack/style.css'],
  spades: ['public/games/blackjack/table.js', 'public/games/blackjack/style.css'],
  hearts: ['public/games/spades/style.css', 'public/games/blackjack/table.js', 'public/games/blackjack/style.css'],
  'red-dog': ['server/games/holdem-hands.js', 'public/games/blackjack/table.js', 'public/games/blackjack/style.css'],
  baccarat: ['public/games/blackjack/table.js', 'public/games/blackjack/style.css'],
  'which-box': ['server/games/guess-bots.js'],
  'shut-the-box': ['public/shared/dice.js', 'public/shared/dice.css'],
  farkle: ['public/shared/dice.js', 'public/shared/dice.css'],
  'snakes-ladders': ['public/shared/dice.js', 'public/shared/dice.css'],
  'odd-even': ['server/games/guess-bots.js'],
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
  const solo = ls('server/solo/games').filter((f) => mine(f, id) && !ids.some((g) => g.length > id.length && mine(f, g))).map((f) => 'server/solo/games/' + f);
  const pub = exists('public/games/' + id) ? ['public/games/' + id + '/'] : [];
  return server.concat(solo, EXTRA[id] || [], pub, testsFor('games/' + id + '.js'));
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

// ---- the game guide: each game's rules, controller buttons and settings, from README.md ----
// The setup screen's 📖 How to play shows them (public/shared/game-guide.json), so the rules are
// written once, for players, in the README's tables.
export const GUIDE = path.join(ROOT, 'public', 'shared', 'game-guide.json');

/** README markdown (one table cell) as safe HTML: bold, code and links' text; nothing else. */
function cellHtml(md) {
  return md
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\\\|/g, '|')
    .trim();
}

/** The rows of the README table under the heading line that matches `head` (cells split on |). */
function tableRows(lines, start, end) {
  const rows = [];
  for (let i = start; i < end; i++) {
    const l = lines[i];
    if (!l.startsWith('|') || /^\|\s*-/.test(l) || /^\| Game \|/.test(l)) continue;
    rows.push(l.slice(1, -1).split(/(?<!\\)\|/).map((c) => c.trim()));
  }
  return rows;
}

export function guide() {
  const lines = fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8').replace(/\r\n/g, '\n').split('\n');
  const at = (re) => lines.findIndex((l) => re.test(l));
  const games = listGames();
  // A game for both modes (two entries, one id): its 1 player rows go under 'solo:<id>'.
  const both = new Set(games.filter((g) => g.solo && games.some((o) => o.id === g.id && !o.solo)).map((g) => g.id));
  const keyOf = (g) => (g.solo && both.has(g.id) ? 'solo:' + g.id : g.id);
  // Names: the 1v1 game's own, and for a game in both modes "<name> (1 player)" for its 1 player one
  // (the rows in the README's 👤 Solo section are 1 player rows whatever they're called).
  const byName = new Map();
  for (const g of games.filter((x) => x.solo)) byName.set(g.name.toLowerCase(), keyOf(g));
  for (const g of games.filter((x) => !x.solo)) byName.set(g.name.toLowerCase(), keyOf(g));
  const soloName = new Map(games.filter((x) => x.solo).map((g) => [g.name.toLowerCase(), keyOf(g)]));
  for (const g of games.filter((x) => x.solo && both.has(x.id))) byName.set(g.name.toLowerCase() + ' (1 player)', keyOf(g));
  // A cell names one game ("Dots and Boxes") or several ("Reaction Duel, Rock Paper Scissors").
  const idsIn = (cell, solo) => {
    const plain = cell.replace(/\*\*/g, '').trim().toLowerCase();
    const names = solo ? new Map([...byName, ...soloName]) : byName;
    if (names.has(plain)) return [names.get(plain)];
    return plain.split(/,| and /).map((n) => names.get(n.trim())).filter(Boolean);
  };
  const out = Object.fromEntries(games.map((g) => [keyOf(g), {}]));
  const put = (rows, key, pick, solo = false) => rows.forEach((r) => idsIn(r[0], solo).forEach((id) => { if (!out[id][key]) out[id][key] = pick(r); }));
  // How it plays (the three game tables), the setup screen's settings, the controller buttons.
  const gamesAt = at(/^## Games/);
  const settingAt = lines.findIndex((l, i) => i > gamesAt && /^\| Game \| Setting/.test(l));
  const controlsAt = at(/^## Controllers/);
  const next = (i) => { const j = lines.findIndex((l, k) => k > i && /^## /.test(l)); return j === -1 ? lines.length : j; };
  const soloAt = lines.findIndex((l, i) => i > gamesAt && /^### 👤 Solo/.test(l));
  put(tableRows(lines, gamesAt, soloAt === -1 ? settingAt : soloAt), 'rules', (r) => cellHtml(r[1]));
  if (soloAt !== -1) put(tableRows(lines, soloAt, settingAt), 'rules', (r) => cellHtml(r[1]), true);
  put(tableRows(lines, settingAt, next(gamesAt)), 'settings', (r) => cellHtml(r[1]));
  put(tableRows(lines, controlsAt, next(controlsAt)), 'controls', (r) => cellHtml(r[1]) + (r[2] ? ' · ' + cellHtml(r[2]) : ''));
  return JSON.stringify(out, null, 1) + '\n';
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  fs.writeFileSync(GUIDE, guide());
  const before = exists('docs/GAMES.md') ? fs.readFileSync(CATALOG, 'utf8') : '';
  fs.writeFileSync(CATALOG, catalog(before));
  console.log('wrote docs/GAMES.md');
}
