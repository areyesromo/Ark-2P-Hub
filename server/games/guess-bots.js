/**
 * The computer for Which Box and Odd or Even (see `bot` in index.js): guessing games, so it reads
 * your habits from the rounds so far (all of them are shown at each reveal).
 *   easy:   has a habit of its own, like a person (the middle box; three fingers), and doesn't read yours.
 *   normal: plays against what you do most often.
 *   hard:   punishes a strong habit outright; otherwise it thinks one step ahead: it works out what
 *           someone reading its own habits would expect of it, and plays against that.
 */
const pace = (rng) => 1000 + rng() * 2200;

/** The option you're most likely to pick, from your past picks (later ones count more); null if none. */
function likely(list, options, rng) {
  if (!list.length) return null;
  const w = new Map(options.map((o) => [o, 0]));
  list.forEach((o, i) => { if (w.has(o)) w.set(o, w.get(o) + 1 + i / list.length); });
  let best = null;
  for (const [o, n] of w) if (best === null || n > w.get(best) || (n === w.get(best) && rng() < 0.5)) best = o;
  return w.get(best) > 0 ? best : null;
}

/** The share of the most common option in a list (how strong a habit is). */
const habit = (list) => {
  if (list.length < 3) return 0;
  const c = {};
  for (const o of list) c[o] = (c[o] || 0) + 1;
  return Math.max(...Object.values(c)) / list.length;
};

export function whichBoxBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'pick' || view.mine !== null || !['easy', 'normal', 'hard'].includes(level)) return null;
  const me = view.you;
  const hiding = view.hider === me;
  const random = () => Math.floor(rng() * 3);
  const move = (box) => ({ type: 'pick', box, botDelayMs: pace(rng), botFor: 'r' + view.round });
  const otherThan = (b) => { const o = [0, 1, 2].filter((x) => x !== b); return o[Math.floor(rng() * 2)]; };
  if (level === 'easy') return move(rng() < 0.5 ? 1 : random()); // (it likes the middle box)
  // Past picks in the roles now: theirs (they seek when we hide) and ours.
  const mine = view.history.filter((h) => (hiding ? h.hider === me : h.hider !== me));
  const theirs = mine.map((h) => (hiding ? h.sought : h.hid)).filter((x) => x !== null);
  const ours = mine.map((h) => (hiding ? h.hid : h.sought)).filter((x) => x !== null);
  if (level === 'normal') {
    const guess = likely(theirs, [0, 1, 2], rng);
    if (guess === null) return move(random());
    return move(hiding ? otherThan(guess) : guess); // hide away from where they look; seek where they hide
  }
  // Hard: a strong habit of theirs, punished; else one step ahead of someone reading our habits.
  if (habit(theirs) >= 0.45) {
    const guess = likely(theirs, [0, 1, 2], rng);
    return move(hiding ? otherThan(guess) : guess);
  }
  const read = likely(ours, [0, 1, 2], rng); // what they'd expect of us
  if (read === null || rng() < 0.15) return move(random());
  // Seeking: they hide away from where they think we look, so look elsewhere too. Hiding: they look
  // where we usually hide, so hide elsewhere.
  return move(otherThan(read));
}

export function oddEvenBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'pick' || view.mine !== null || !['easy', 'normal', 'hard'].includes(level)) return null;
  const me = view.you;
  const imOdd = view.odd === me;
  const move = (fingers) => ({ type: 'pick', fingers, botDelayMs: pace(rng), botFor: 'r' + view.round });
  const any = () => 1 + Math.floor(rng() * 5);
  const ofParity = (p) => { const pool = [1, 2, 3, 4, 5].filter((n) => n % 2 === p); return pool[Math.floor(rng() * pool.length)]; };
  if (level === 'easy') return move(rng() < 0.45 ? 3 : any()); // (it likes three)
  // Past rounds with the same roles as now (who's Odd).
  const same = view.history.filter((h) => h.odd === view.odd);
  const theirs = same.map((h) => h.picks[1 - me]).filter((x) => x !== null).map((n) => n % 2);
  const ours = same.map((h) => h.picks[me]).filter((x) => x !== null).map((n) => n % 2);
  // To win: when Odd, the other parity to theirs; when Even, the same.
  const beat = (theirParity) => (imOdd ? 1 - theirParity : theirParity);
  if (level === 'normal' || habit(theirs) >= 0.6) {
    const guess = likely(theirs, [0, 1], rng);
    return move(guess === null ? any() : ofParity(beat(guess)));
  }
  // Hard: one step ahead of someone reading our parity. They expect `read` from us and pick to beat
  // it (when they're Odd, the other parity; when Even, the same), so we beat that.
  const read = likely(ours, [0, 1], rng);
  if (read === null || rng() < 0.15) return move(any());
  const theyPlay = imOdd ? read : 1 - read;
  return move(ofParity(beat(theyPlay)));
}
