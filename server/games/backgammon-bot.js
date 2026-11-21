/**
 * The computer for Backgammon (see `bot` in index.js). It plays out every way of using its roll
 * and keeps the position it likes best:
 *   easy:   the race, hitting you and making points, but leaves its checkers lying about; one roll
 *           in seven just any legal play. Never doubles; always takes.
 *   normal: also builds points in its home, keeps checkers together and counts a lone checker's
 *           risk. Doubles when well ahead in the race; drops when far behind.
 *   hard:   counts the rolls that would hit each lone checker, values a wall of points (a prime)
 *           and your checkers on the bar against its home; sharper with the cube.
 */
import { singleMoves, applyMove, pips } from './backgammon.js';

// Of the 36 rolls, how many hit a checker this far away (directly, or with both dice).
const SHOTS = [0, 11, 12, 14, 15, 15, 17, 6, 6, 5, 3, 2, 3, 0, 0, 1, 1, 0, 1, 0, 1, 0, 0, 0, 1];

const mine = (points, i, s) => (s === 0 ? points[i] > 0 : points[i] < 0);
const cnt = (points, i) => Math.abs(points[i]);
/** A point counted from `s`'s side: 1 is deepest in its home, 24 its furthest. */
const own = (i, s) => (s === 0 ? i + 1 : 24 - i);

/** Every end position of the roll (as many dice as can be used), with the moves that make it. */
function plays(st, s, dice) {
  const out = new Map();
  let best = 0;
  const walk = (cur, left, path) => {
    let moved = false;
    for (const d of [...new Set(left)]) {
      for (const m of singleMoves(cur, s, d)) {
        moved = true;
        const i = left.indexOf(d);
        walk(applyMove(cur, s, m), left.slice(0, i).concat(left.slice(i + 1)), path.concat([m]));
      }
    }
    if (!moved) {
      if (path.length < best) return;
      if (path.length > best) { best = path.length; out.clear(); }
      const key = cur.points.join() + '|' + cur.bar + '|' + cur.off;
      if (!out.has(key)) out.set(key, { st: cur, path });
    }
  };
  walk(st, dice, []);
  let list = [...out.values()];
  // (only one die usable, two different: the bigger one if it can be)
  if (best === 1 && dice.length === 2 && dice[0] !== dice[1]) {
    const big = Math.max(...dice);
    if (list.some((p) => p.path[0].die === big)) list = list.filter((p) => p.path[0].die === big);
  }
  return list;
}

/** Whether the two sides have passed each other (a pure race: nothing left to hit). */
function race(st) {
  if (st.bar[0] || st.bar[1]) return false;
  let lowest1 = 24;
  let highest0 = -1;
  for (let i = 0; i < 24; i++) {
    if (st.points[i] > 0) highest0 = Math.max(highest0, i);
    if (st.points[i] < 0) lowest1 = Math.min(lowest1, i);
  }
  return highest0 < lowest1;
}

/** How good this position is for `s`. */
export function evaluate(st, s, level) {
  const o = 1 - s;
  let score = (pips(st, o) - pips(st, s)) * 1.0 + st.off[s] * 2;
  if (race(st)) return score;
  // Points made, most of all in its home; a wall of them in a row.
  let run = 0;
  let bestRun = 0;
  for (let p = 1; p <= 24; p++) {
    const i = s === 0 ? p - 1 : 24 - p;
    const made = mine(st.points, i, s) && cnt(st.points, i) >= 2;
    if (made) {
      score += p <= 6 ? 5 : p <= 9 ? 3 : 1;
      run++;
      bestRun = Math.max(bestRun, run);
    } else run = 0;
  }
  score += bestRun >= 3 ? (bestRun - 2) * (level === 'hard' ? 6 : 3) : 0;
  // Its home board makes your checkers on the bar count for more.
  let homeMade = 0;
  for (let p = 1; p <= 6; p++) { const i = s === 0 ? p - 1 : 24 - p; if (mine(st.points, i, s) && cnt(st.points, i) >= 2) homeMade++; }
  score += st.bar[o] * (6 + homeMade * (level === 'hard' ? 3 : 2));
  // Its lone checkers: what they'd cost if hit, by how likely that is.
  for (let i = 0; i < 24; i++) {
    if (!mine(st.points, i, s) || cnt(st.points, i) !== 1) continue;
    const progress = 25 - own(i, s); // (pips lost if it's sent back)
    let shots;
    if (level === 'hard') {
      shots = 0;
      const seen = new Set();
      for (let j = 0; j < 24; j++) {
        if (!mine(st.points, j, o)) continue;
        const d = s === 0 ? i - j : j - i; // (the other moves the opposite way)
        if (d > 0 && d < SHOTS.length && !seen.has(d)) { seen.add(d); shots += SHOTS[d]; }
      }
      if (st.bar[o]) { const d = s === 0 ? i + 1 : 24 - i; if (d < SHOTS.length && !seen.has(d)) shots += SHOTS[d]; }
      shots = Math.min(36, shots);
    } else {
      shots = 12;
    }
    score -= level === 'easy' ? 0.5 : (shots / 36) * progress * 0.7 + 1; // (Easy leaves them lying about)
  }
  return score;
}

/** Whether `s` should double, or take a double, from this position (by the race and the board). */
function standing(st, s) {
  const mineP = pips(st, s);
  const theirs = pips(st, 1 - s);
  return (theirs - mineP) / Math.max(1, mineP);
}

export function backgammonBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  if (!view || !['easy', 'normal', 'hard'].includes(level)) return null;
  const s = view.you;
  const st = { points: view.points, bar: view.bar, off: view.off };
  const pace = (ms) => ms + rng() * ms * 0.6;
  if (view.phase === 'offer' && view.offer && view.offer.by !== s) {
    const lead = standing(st, s);
    const drop = level !== 'easy' && lead < (level === 'hard' ? -0.22 : -0.28) && race(st);
    return { type: drop ? 'drop' : 'take', botDelayMs: pace(1500) };
  }
  if (view.turn !== s) return null;
  if (view.phase === 'roll') {
    if (view.canDouble && level !== 'easy') {
      const lead = standing(st, s);
      if (lead > (level === 'hard' ? 0.1 : 0.14) && (race(st) || lead > 0.2)) return { type: 'double', botDelayMs: pace(1200) };
    }
    return { type: 'roll', botDelayMs: pace(900) };
  }
  if (view.phase !== 'move') return null;
  if (view.canDone) return { type: 'done', botDelayMs: pace(600) };
  if (!view.legal.length) return null;
  const key = view.game + ':' + view.points.join() + view.bar + view.dice.join();
  if (memory.key !== key) {
    const options = plays(st, s, view.dice);
    let pick;
    if (level === 'easy' && rng() < 0.15) pick = options[Math.floor(rng() * options.length)];
    else {
      let best = -Infinity;
      for (const p of options) {
        const v = evaluate(p.st, s, level) + rng() * 0.01;
        if (v > best) { best = v; pick = p; }
      }
    }
    memory.key = key;
    memory.next = pick ? pick.path[0] : null;
  }
  const m = memory.next;
  if (!m || !view.legal.some((x) => x.from === m.from && x.to === m.to)) {
    const any = view.legal[Math.floor(rng() * view.legal.length)];
    return { type: 'move', from: any.from, to: any.to, botDelayMs: pace(800) };
  }
  return { type: 'move', from: m.from, to: m.to, botDelayMs: pace(800), botFor: key };
}
