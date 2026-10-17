// Bomb Squad modules: how each one is made, what the defuser sees, and the
// rules in the manual.
//
// Every bomb comes with its own rulebook (makeRulebook), so the crew can't
// learn the manual by heart: the wire and button rules, the strip digits,
// the symbol columns, the passwords, the Simon colours, the mazes and the
// switch settings are all dealt fresh. Each rule is one object holding both
// the sentence the manual shows and the code that checks it, so the two
// can't drift apart.
//
// The bomb's "edgework" (serial number, batteries) is printed on the bomb, so
// the defuser has to read it out for rules that depend on it.

export const MODULE_TYPES = ['wires', 'button', 'symbols', 'password', 'simon', 'maze', 'switches'];
const EASY_TYPES = ['wires', 'button', 'switches']; // small bombs pick from these

const VOWELS = 'AEIOU';
const ORDINALS = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth'];
const pick = (list, rng) => list[Math.floor(rng() * list.length)];
const shuffle = (list, rng) => {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

/** Serial number (6 characters, ends in a digit) and battery count. */
export function makeEdgework(rng) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXZ0123456789';
  let serial = '';
  for (let i = 0; i < 5; i++) serial += pick(chars, rng);
  serial += Math.floor(rng() * 10);
  return { serial, batteries: Math.floor(rng() * 5) };
}

const lastDigitOdd = (e) => Number(e.serial[e.serial.length - 1]) % 2 === 1;
const hasVowel = (e) => [...e.serial].some((c) => VOWELS.includes(c));

/** Conditions on the bomb's edgework, to make some rules depend on it. */
const EDGE_CONDITIONS = [
  { text: 'the serial number ends in an odd digit', test: lastDigitOdd },
  { text: 'the serial number ends in an even digit', test: (e) => !lastDigitOdd(e) },
  { text: 'there are 2 or more batteries', test: (e) => e.batteries >= 2 },
  { text: 'there are no batteries', test: (e) => e.batteries === 0 },
  { text: 'the serial number has a vowel (A E I O U)', test: hasVowel },
];

/** "If …, cut …." / "Otherwise, if …" / "Otherwise, …": a chain of rules as sentences. */
function sentence(i, cond, action) {
  if (!cond) return `Otherwise, ${action}.`;
  return `${i === 0 ? 'If' : 'Otherwise, if'} ${cond}, ${action}.`;
}

// ---- wires -----------------------------------------------------------------

export const WIRE_COLORS = ['red', 'blue', 'yellow', 'white', 'black'];
const count = (w, c) => w.filter((x) => x === c).length;

/** Wire conditions. `has` names a colour the condition guarantees is on the bomb (for "cut the last red wire"). */
function wireCondition(rng) {
  const c = pick(WIRE_COLORS, rng);
  const d = pick(WIRE_COLORS.filter((x) => x !== c), rng);
  return pick([
    { text: `there are no ${c} wires`, when: (w) => count(w, c) === 0 },
    { text: `there is more than one ${c} wire`, when: (w) => count(w, c) > 1, has: c },
    { text: `there is exactly one ${c} wire`, when: (w) => count(w, c) === 1, has: c, one: true },
    { text: `the first wire is ${c}`, when: (w) => w[0] === c, has: c },
    { text: `the last wire is ${c}`, when: (w) => w[w.length - 1] === c, has: c },
    { text: `there are more ${c} wires than ${d} wires`, when: (w) => count(w, c) > count(w, d), has: c },
  ], rng);
}

function wireAction(n, cond, rng) {
  const k = Math.floor(rng() * n);
  const options = [
    { text: `cut the ${ORDINALS[k]} wire`, cut: () => k },
    { text: 'cut the last wire', cut: (w) => w.length - 1 },
  ];
  if (cond && cond.has) {
    const c = cond.has;
    options.push({ text: `cut the last ${c} wire`, cut: (w) => w.lastIndexOf(c) });
    options.push(cond.one ? { text: `cut the ${c} wire`, cut: (w) => w.indexOf(c) } : { text: `cut the first ${c} wire`, cut: (w) => w.indexOf(c) });
  }
  return pick(options, rng);
}

/** Three rules and a catch-all for each number of wires. */
function makeWireRules(rng) {
  const out = {};
  for (let n = 3; n <= 6; n++) {
    const rules = [];
    const used = new Set();
    while (rules.length < 3) {
      const cond = wireCondition(rng);
      if (used.has(cond.text)) continue;
      used.add(cond.text);
      // Now and then the rule also depends on the edgework.
      const edge = rng() < 0.35 ? pick(EDGE_CONDITIONS, rng) : null;
      const action = wireAction(n, cond, rng);
      const text = edge ? `${edge.text} and ${cond.text}` : cond.text;
      rules.push({
        text: sentence(rules.length, text, action.text),
        when: edge ? (w, e) => edge.test(e) && cond.when(w) : (w) => cond.when(w),
        cut: action.cut,
      });
    }
    const last = wireAction(n, null, rng);
    rules.push({ text: sentence(3, null, last.text), when: () => true, cut: last.cut });
    out[n] = rules;
  }
  return out;
}

export function wireAnswer(rb, wires, edge) {
  return rb.wires[wires.length].find((r) => r.when(wires, edge)).cut(wires, edge);
}

function makeWires(rb, rng) {
  const n = 3 + Math.floor(rng() * 4);
  return { type: 'wires', wires: Array.from({ length: n }, () => pick(WIRE_COLORS, rng)), cut: [] };
}

// ---- the button ------------------------------------------------------------

export const BUTTON_COLORS = ['red', 'blue', 'yellow', 'white'];
export const BUTTON_LABELS = ['ABORT', 'HOLD', 'PRESS', 'DETONATE'];
export const STRIP_COLORS = ['blue', 'yellow', 'red', 'white'];
export const HOLD_MS = 700; // pressed longer than this is a hold (the strip lights up)

function buttonCondition(rng) {
  const c = pick(BUTTON_COLORS, rng);
  const l = pick(BUTTON_LABELS, rng);
  const e = pick(EDGE_CONDITIONS, rng);
  return pick([
    { text: `the button is ${c} and says ${l}`, when: (b) => b.color === c && b.label === l },
    { text: `the button is ${c}`, when: (b) => b.color === c },
    { text: `the button says ${l}`, when: (b) => b.label === l },
    { text: `${e.text} and the button says ${l}`, when: (b, edge) => e.test(edge) && b.label === l },
    { text: `${e.text} and the button is ${c}`, when: (b, edge) => e.test(edge) && b.color === c },
  ], rng);
}

function makeButtonRules(rng) {
  const rules = [];
  const used = new Set();
  while (rules.length < 4) {
    const cond = buttonCondition(rng);
    if (used.has(cond.text)) continue;
    used.add(cond.text);
    const act = rng() < 0.5 ? 'tap' : 'hold';
    rules.push({ text: sentence(rules.length, cond.text, `${act} it`), when: cond.when, act });
  }
  const act = rng() < 0.6 ? 'hold' : 'tap';
  rules.push({ text: sentence(4, null, `${act} it`), when: () => true, act });
  return rules;
}

export function buttonAction(rb, b, edge) {
  return rb.button.find((r) => r.when(b, edge)).act;
}

/** The timer as the bomb shows it: m:ss, counting whole seconds up. */
export function clockText(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function makeButton(rb, rng) {
  return { type: 'button', color: pick(BUTTON_COLORS, rng), label: pick(BUTTON_LABELS, rng), strip: pick(STRIP_COLORS, rng), pressedAt: null };
}

// ---- symbols -----------------------------------------------------------------
// Four symbols on the bomb. Exactly one column of the manual has all four:
// press them in the order they appear in that column, top to bottom.
// Plain Greek and Cyrillic letters and common signs, so every phone shows them.

export const SYMBOLS = [
  'Ω', 'Ж', '★', 'λ', '¶', '♠', '§', 'Ψ', 'Ћ', 'ζ', '©', '♣', 'Ѣ', '¿', '♪', 'ξ', '∂',
  '☆', 'Ю', 'ϑ', 'Б', '∞', 'Ф', 'Я', 'Д', 'Ш', 'π', 'Σ', '♥', '♦', '¥', 'Δ', 'Θ', 'φ',
];

/** Six columns of seven; no two share more than three symbols, so any four pick out one column. */
function makeSymbolColumns(rng) {
  for (;;) {
    const cols = [];
    let tries = 0;
    while (cols.length < 6 && tries++ < 200) {
      const col = shuffle(SYMBOLS, rng).slice(0, 7);
      if (cols.every((c) => c.filter((s) => col.includes(s)).length <= 3)) cols.push(col);
    }
    if (cols.length === 6) return cols;
  }
}

function makeSymbols(rb, rng) {
  const col = pick(rb.symbols, rng);
  return { type: 'symbols', symbols: shuffle(col, rng).slice(0, 4), pressed: [] };
}

/** The order to press the symbols in: indexes into module.symbols. */
export function symbolOrder(rb, symbols) {
  const col = rb.symbols.find((c) => symbols.every((s) => c.includes(s)));
  return symbols.map((s, i) => i).sort((a, b) => col.indexOf(symbols[a]) - col.indexOf(symbols[b]));
}

// ---- password ----------------------------------------------------------------
// Five letter wheels. Exactly one setting spells a word from this bomb's list.

export const WORDS = [
  'apple', 'beach', 'brick', 'chair', 'cloud', 'dance', 'dream', 'eagle', 'flame', 'frost',
  'ghost', 'grape', 'heart', 'honey', 'igloo', 'jelly', 'juice', 'knife', 'koala', 'laser',
  'lemon', 'magic', 'mango', 'night', 'noble', 'ocean', 'piano', 'queen', 'river', 'snake',
  'tiger', 'unity', 'voice', 'whale', 'zebra', 'amber', 'bread', 'candy', 'daisy', 'earth',
  'feast', 'globe', 'horse', 'index', 'joker', 'kayak', 'llama', 'medal', 'nurse', 'olive',
  'pearl', 'quilt', 'robot', 'salad', 'table', 'uncle', 'vapor', 'waltz', 'yacht', 'zesty',
  'blaze', 'crane', 'drift', 'ember', 'fable', 'giant', 'hatch', 'ivory', 'jumbo', 'karma',
  'lunar', 'mossy', 'nacho', 'orbit', 'pixel', 'quack', 'radar', 'storm', 'toast', 'viper',
];
export const PASSWORD_COUNT = 30;
export const WHEEL_SIZE = 5;

function makePassword(rb, rng) {
  const ABC = 'abcdefghijklmnopqrstuvwxyz';
  for (;;) {
    const word = pick(rb.passwords, rng);
    const wheels = [...word].map((ch) => {
      const others = shuffle([...ABC].filter((c) => c !== ch), rng).slice(0, WHEEL_SIZE - 1);
      return shuffle([ch, ...others], rng);
    });
    const spellable = rb.passwords.filter((p) => [...p].every((ch, i) => wheels[i].includes(ch)));
    if (spellable.length === 1) return { type: 'password', word, wheels, at: wheels.map(() => Math.floor(rng() * WHEEL_SIZE)) };
  }
}

export const passwordShown = (m) => m.wheels.map((w, i) => w[m.at[i]]).join('');

// ---- Simon -------------------------------------------------------------------
// Four coloured pads. The bomb flashes a sequence, one more colour each stage.
// For each flash, press the colour the manual's table gives: it depends on
// whether the serial has a vowel and on the strikes so far.

export const SIMON_COLORS = ['red', 'blue', 'green', 'yellow'];

/** table[vowel ? 1 : 0][strikes (0-2)][flash colour] -> colour to press. */
function makeSimonTable(rng) {
  return [0, 1].map(() => [0, 1, 2].map(() => {
    const to = shuffle(SIMON_COLORS, rng);
    return Object.fromEntries(SIMON_COLORS.map((c, i) => [c, to[i]]));
  }));
}

function makeSimon(rb, rng) {
  const stages = 3 + (rng() < 0.5 ? 1 : 0);
  return { type: 'simon', sequence: Array.from({ length: stages }, () => pick(SIMON_COLORS, rng)), stage: 1, entered: [] };
}

export function simonPress(rb, edge, strikes, flash) {
  return rb.simon[hasVowel(edge) ? 1 : 0][Math.min(2, strikes)][flash];
}

// ---- maze --------------------------------------------------------------------
// A 6×6 grid. The defuser sees two green markers, their light (●) and the
// target (▲), but not the walls. The markers say which of the manual's mazes
// it is; the expert reads the way out. Bumping a wall is a strike.

export const MAZE_SIZE = 6;
export const MAZE_COUNT = 6;
const DIRS = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] };

/** A perfect maze (one way between any two cells), carved depth-first. right[y][x] / down[y][x]: a wall there. */
function carveMaze(rng) {
  const N = MAZE_SIZE;
  const right = Array.from({ length: N }, () => Array(N).fill(true));
  const down = Array.from({ length: N }, () => Array(N).fill(true));
  const seen = Array.from({ length: N }, () => Array(N).fill(false));
  const stack = [[Math.floor(rng() * N), Math.floor(rng() * N)]];
  seen[stack[0][1]][stack[0][0]] = true;
  while (stack.length) {
    const [x, y] = stack[stack.length - 1];
    const next = shuffle(Object.values(DIRS), rng).map(([dx, dy]) => [x + dx, y + dy]).find(([nx, ny]) => nx >= 0 && ny >= 0 && nx < N && ny < N && !seen[ny][nx]);
    if (!next) {
      stack.pop();
      continue;
    }
    const [nx, ny] = next;
    if (nx > x) right[y][x] = false;
    if (nx < x) right[y][nx] = false;
    if (ny > y) down[y][x] = false;
    if (ny < y) down[ny][x] = false;
    seen[ny][nx] = true;
    stack.push(next);
  }
  return { right, down };
}

/** Six mazes, each with two marker cells no other maze uses. */
function makeMazes(rng) {
  const cells = shuffle(Array.from({ length: MAZE_SIZE * MAZE_SIZE }, (_, i) => [i % MAZE_SIZE, Math.floor(i / MAZE_SIZE)]), rng);
  return Array.from({ length: MAZE_COUNT }, (_, i) => ({ ...carveMaze(rng), markers: [cells[2 * i], cells[2 * i + 1]] }));
}

export function mazeBlocked(maze, x, y, dir) {
  const [dx, dy] = DIRS[dir];
  const nx = x + dx;
  const ny = y + dy;
  if (nx < 0 || ny < 0 || nx >= MAZE_SIZE || ny >= MAZE_SIZE) return true;
  if (dx === 1) return maze.right[y][x];
  if (dx === -1) return maze.right[y][nx];
  if (dy === 1) return maze.down[y][x];
  return maze.down[ny][x];
}

/** The moves from (x, y) to the goal, shortest first (it's a perfect maze, so there's only one way). */
export function mazeRoute(maze, from, to) {
  const key = (p) => p[0] + ',' + p[1];
  const prev = new Map([[key(from), null]]);
  const queue = [from];
  while (queue.length) {
    const p = queue.shift();
    if (key(p) === key(to)) break;
    for (const dir of Object.keys(DIRS)) {
      if (mazeBlocked(maze, p[0], p[1], dir)) continue;
      const n = [p[0] + DIRS[dir][0], p[1] + DIRS[dir][1]];
      if (prev.has(key(n))) continue;
      prev.set(key(n), [p, dir]);
      queue.push(n);
    }
  }
  const moves = [];
  for (let k = key(to); prev.get(k); k = key(prev.get(k)[0])) moves.unshift(prev.get(k)[1]);
  return moves;
}

function makeMaze(rb, rng) {
  const index = Math.floor(rng() * rb.mazes.length);
  const maze = rb.mazes[index];
  for (;;) {
    const at = [Math.floor(rng() * MAZE_SIZE), Math.floor(rng() * MAZE_SIZE)];
    const goal = [Math.floor(rng() * MAZE_SIZE), Math.floor(rng() * MAZE_SIZE)];
    if (mazeRoute(maze, at, goal).length >= 5) return { type: 'maze', index, at, goal };
  }
}

export const MAZE_DIRS = Object.keys(DIRS);
export const mazeStep = (at, dir) => [at[0] + DIRS[dir][0], at[1] + DIRS[dir][1]];

// ---- switches ----------------------------------------------------------------
// Five switches, each under a coloured light. The manual's table says which
// way each should point, by its light colour and whether it's an odd- or
// even-numbered switch. Set them all, then press CHECK.

export const SWITCH_COLORS = ['red', 'green', 'blue', 'yellow'];
export const SWITCH_COUNT = 5;

/** table[colour] = [up for odd-numbered switches?, up for even-numbered switches?] */
function makeSwitchTable(rng) {
  return Object.fromEntries(SWITCH_COLORS.map((c) => [c, [rng() < 0.5, rng() < 0.5]]));
}

export function switchTarget(rb, lights) {
  return lights.map((c, i) => rb.switches[c][i % 2 === 0 ? 0 : 1]); // switch 1 is odd-numbered
}

function makeSwitches(rb, rng) {
  const lights = Array.from({ length: SWITCH_COUNT }, () => pick(SWITCH_COLORS, rng));
  const target = switchTarget(rb, lights);
  for (;;) {
    const up = lights.map(() => rng() < 0.5);
    if (up.some((u, i) => u !== target[i])) return { type: 'switches', lights, up };
  }
}

// ---- a whole bomb -------------------------------------------------------------

/** This bomb's rulebook: every module's rules, dealt fresh. */
export function makeRulebook(rng) {
  const code = Array.from({ length: 3 }, () => pick('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', rng)).join('');
  const digits = shuffle([1, 2, 3, 4, 5], rng);
  return {
    edition: code,
    wires: makeWireRules(rng),
    button: makeButtonRules(rng),
    strip: Object.fromEntries(STRIP_COLORS.map((c, i) => [c, digits[i]])),
    symbols: makeSymbolColumns(rng),
    passwords: shuffle(WORDS, rng).slice(0, PASSWORD_COUNT).sort(),
    simon: makeSimonTable(rng),
    mazes: makeMazes(rng),
    switches: makeSwitchTable(rng),
  };
}

const MAKERS = { wires: makeWires, button: makeButton, symbols: makeSymbols, password: makePassword, simon: makeSimon, maze: makeMaze, switches: makeSwitches };

/** `n` modules, each a different type (small bombs stick to the simpler ones). */
export function makeModules(rb, n, rng) {
  const types = n <= 2 ? shuffle(EASY_TYPES, rng).slice(0, n) : shuffle(MODULE_TYPES, rng).slice(0, n);
  return types.map((t) => ({ ...MAKERS[t](rb, rng), solved: false }));
}

/** The manual for a rulebook, as plain data for the expert's phone (the pages for `types`). */
export function manualOf(rb, types) {
  const pages = {
    wires: () => Object.fromEntries(Object.entries(rb.wires).map(([n, rules]) => [n, rules.map((r) => r.text)])),
    button: () => ({ rules: rb.button.map((r) => r.text), strip: rb.strip }),
    symbols: () => rb.symbols,
    password: () => rb.passwords,
    simon: () => rb.simon,
    maze: () => rb.mazes,
    switches: () => rb.switches,
  };
  const out = { edition: rb.edition };
  for (const t of types) out[t] = pages[t]();
  return out;
}
