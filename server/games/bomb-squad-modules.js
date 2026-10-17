// Bomb Squad modules: how each one is made, what the defuser sees, and the
// rules in the manual. Each rule is one object holding both the sentence the
// manual shows and the code that checks it, so the two can't drift apart.
//
// The bomb's "edgework" (serial number, batteries) is printed on the bomb, so
// the defuser has to read it out for rules that depend on it.

export const MODULE_TYPES = ['wires', 'button', 'symbols', 'password'];

const VOWELS = 'AEIOU';
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

// ---- wires -----------------------------------------------------------------

export const WIRE_COLORS = ['red', 'blue', 'yellow', 'white', 'black'];
const count = (w, c) => w.filter((x) => x === c).length;
const lastOf = (w, c) => w.lastIndexOf(c);

/** Rules by number of wires, checked top to bottom: the first that applies says which wire to cut (0-based). */
export const WIRE_RULES = {
  3: [
    { text: 'If there are no blue wires, cut the second wire.', when: (w) => count(w, 'blue') === 0, cut: () => 1 },
    { text: 'Otherwise, if the first wire is red, cut the last wire.', when: (w) => w[0] === 'red', cut: (w) => w.length - 1 },
    { text: 'Otherwise, if there is more than one white wire, cut the last white wire.', when: (w) => count(w, 'white') > 1, cut: (w) => lastOf(w, 'white') },
    { text: 'Otherwise, cut the first wire.', when: () => true, cut: () => 0 },
  ],
  4: [
    { text: 'If the serial number ends in an even digit and there is more than one yellow wire, cut the last yellow wire.', when: (w, e) => !lastDigitOdd(e) && count(w, 'yellow') > 1, cut: (w) => lastOf(w, 'yellow') },
    { text: 'Otherwise, if the last wire is black, cut the second wire.', when: (w) => w[w.length - 1] === 'black', cut: () => 1 },
    { text: 'Otherwise, if there are no red wires, cut the third wire.', when: (w) => count(w, 'red') === 0, cut: () => 2 },
    { text: 'Otherwise, cut the last wire.', when: () => true, cut: (w) => w.length - 1 },
  ],
  5: [
    { text: 'If there are 2 or more batteries and the first wire is white, cut the fourth wire.', when: (w, e) => e.batteries >= 2 && w[0] === 'white', cut: () => 3 },
    { text: 'Otherwise, if there is exactly one black wire, cut the black wire.', when: (w) => count(w, 'black') === 1, cut: (w) => w.indexOf('black') },
    { text: 'Otherwise, if there are more blue wires than red wires, cut the first wire.', when: (w) => count(w, 'blue') > count(w, 'red'), cut: () => 0 },
    { text: 'Otherwise, cut the third wire.', when: () => true, cut: () => 2 },
  ],
  6: [
    { text: 'If there are no yellow wires and the serial number has a vowel (A E I O U), cut the fifth wire.', when: (w, e) => count(w, 'yellow') === 0 && hasVowel(e), cut: () => 4 },
    { text: 'Otherwise, if there is exactly one red wire, cut the red wire.', when: (w) => count(w, 'red') === 1, cut: (w) => w.indexOf('red') },
    { text: 'Otherwise, if the last wire is white or blue, cut the second wire.', when: (w) => ['white', 'blue'].includes(w[w.length - 1]), cut: () => 1 },
    { text: 'Otherwise, cut the last wire.', when: () => true, cut: (w) => w.length - 1 },
  ],
};

export function wireAnswer(wires, edge) {
  return WIRE_RULES[wires.length].find((r) => r.when(wires, edge)).cut(wires, edge);
}

function makeWires(rng) {
  const n = 3 + Math.floor(rng() * 4);
  return { type: 'wires', wires: Array.from({ length: n }, () => pick(WIRE_COLORS, rng)), cut: [] };
}

// ---- the button ------------------------------------------------------------

export const BUTTON_COLORS = ['red', 'blue', 'yellow', 'white'];
export const BUTTON_LABELS = ['ABORT', 'HOLD', 'PRESS', 'DETONATE'];
export const STRIP_COLORS = ['blue', 'yellow', 'red', 'white'];
export const HOLD_MS = 700; // pressed longer than this is a hold (the strip lights up)

export const BUTTON_RULES = [
  { text: 'If the button is red and says ABORT, tap it (press and let go right away).', when: (b) => b.color === 'red' && b.label === 'ABORT', act: 'tap' },
  { text: 'Otherwise, if there are 2 or more batteries and the button says PRESS, tap it.', when: (b, e) => e.batteries >= 2 && b.label === 'PRESS', act: 'tap' },
  { text: 'Otherwise, if the button is yellow, hold it.', when: (b) => b.color === 'yellow', act: 'hold' },
  { text: 'Otherwise, if the button says DETONATE and the serial number ends in an odd digit, tap it.', when: (b, e) => b.label === 'DETONATE' && lastDigitOdd(e), act: 'tap' },
  { text: 'Otherwise, hold it.', when: () => true, act: 'hold' },
];

/** Holding: a strip next to the button lights up. Let go when the timer shows this digit anywhere. */
export const STRIP_DIGITS = { blue: 4, yellow: 5, red: 2, white: 1 };

export function buttonAction(b, edge) {
  return BUTTON_RULES.find((r) => r.when(b, edge)).act;
}

/** The timer as the bomb shows it: m:ss, counting whole seconds up. */
export function clockText(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
}

function makeButton(rng) {
  return { type: 'button', color: pick(BUTTON_COLORS, rng), label: pick(BUTTON_LABELS, rng), strip: pick(STRIP_COLORS, rng), pressedAt: null };
}

// ---- symbols -----------------------------------------------------------------
// Four symbols on the bomb. Exactly one column of the manual has all four:
// press them in the order they appear in that column, top to bottom.
// Plain Greek and Cyrillic letters and common signs, so every phone shows them.

export const SYMBOL_COLUMNS = [
  ['Ω', 'Ж', '★', 'λ', '¶', '♠', '§'],
  ['Ψ', '★', 'Ћ', 'ζ', '©', 'Ω', '♣'],
  ['Ѣ', '¿', 'Ж', '♪', 'ξ', 'Ћ', '∂'],
  ['☆', 'Ю', '♣', '¿', 'Ψ', 'ϑ', '♠'],
  ['Б', 'ϑ', '§', 'Ѣ', 'Ю', '∞', 'λ'],
  ['∂', '☆', 'Ф', '¶', '∞', 'ζ', 'Б'],
];

function makeSymbols(rng) {
  for (;;) {
    const col = Math.floor(rng() * SYMBOL_COLUMNS.length);
    const four = shuffle(SYMBOL_COLUMNS[col], rng).slice(0, 4);
    const fits = SYMBOL_COLUMNS.filter((c) => four.every((s) => c.includes(s)));
    if (fits.length === 1) return { type: 'symbols', symbols: four, pressed: [] };
  }
}

/** The order to press the symbols in: indexes into module.symbols. */
export function symbolOrder(symbols) {
  const col = SYMBOL_COLUMNS.find((c) => symbols.every((s) => c.includes(s)));
  return symbols.map((s, i) => i).sort((a, b) => col.indexOf(symbols[a]) - col.indexOf(symbols[b]));
}

// ---- password ----------------------------------------------------------------
// Five letter wheels. Exactly one setting spells a word from the manual.

export const PASSWORDS = [
  'apple', 'beach', 'brick', 'chair', 'cloud', 'dance', 'dream', 'eagle', 'flame', 'frost',
  'ghost', 'grape', 'heart', 'honey', 'igloo', 'jelly', 'juice', 'knife', 'koala', 'laser',
  'lemon', 'magic', 'mango', 'night', 'noble', 'ocean', 'piano', 'queen', 'river', 'snake',
  'tiger', 'unity', 'voice', 'whale', 'zebra',
];
export const WHEEL_SIZE = 5;

function makePassword(rng) {
  const ABC = 'abcdefghijklmnopqrstuvwxyz';
  for (;;) {
    const word = pick(PASSWORDS, rng);
    const wheels = [...word].map((ch) => {
      const others = shuffle([...ABC].filter((c) => c !== ch), rng).slice(0, WHEEL_SIZE - 1);
      return shuffle([ch, ...others], rng);
    });
    const spellable = PASSWORDS.filter((p) => [...p].every((ch, i) => wheels[i].includes(ch)));
    if (spellable.length === 1) return { type: 'password', word, wheels, at: wheels.map(() => Math.floor(rng() * WHEEL_SIZE)) };
  }
}

export const passwordShown = (m) => m.wheels.map((w, i) => w[m.at[i]]).join('');

// ---- a whole bomb -------------------------------------------------------------

const MAKERS = { wires: makeWires, button: makeButton, symbols: makeSymbols, password: makePassword };

/** `n` modules, each a different type (wires and the button first on small bombs). */
export function makeModules(n, rng) {
  const types = n <= 2 ? MODULE_TYPES.slice(0, n) : shuffle(MODULE_TYPES, rng).slice(0, n);
  return types.map((t) => ({ ...MAKERS[t](rng), solved: false }));
}

/** The manual: every module's rules, as text. */
export function manual() {
  return {
    wires: Object.fromEntries(Object.entries(WIRE_RULES).map(([n, rules]) => [n, rules.map((r) => r.text)])),
    button: BUTTON_RULES.map((r) => r.text),
    strip: STRIP_DIGITS,
    symbols: SYMBOL_COLUMNS,
    passwords: PASSWORDS,
  };
}
