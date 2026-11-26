// Poker hands for Heads-up Hold'em: the best five of seven cards, as a number that sorts hands
// (bigger is better), and its name. Cards are '10H', 'AS', 'QD' and so on.

export const RANKS = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
export const SUITS = ['S', 'H', 'D', 'C'];
export const CATEGORIES = ['High card', 'Pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush'];

export const rankOf = (card) => RANKS.indexOf(card.slice(0, -1)) + 2; // 2 … 14
export const suitOf = (card) => card.slice(-1);

export function deck() {
  const out = [];
  for (const s of SUITS) for (const r of RANKS) out.push(r + s);
  return out;
}

/** The highest straight in a set of ranks (5 … 14), or 0. An ace also counts low (A-2-3-4-5). */
function straightTop(ranks) {
  const has = new Set(ranks);
  if (has.has(14)) has.add(1);
  for (let top = 14; top >= 5; top--) {
    let ok = true;
    for (let k = 0; k < 5 && ok; k++) if (!has.has(top - k)) ok = false;
    if (ok) return top;
  }
  return 0;
}

/** A score from a category and up to five deciding ranks (each 2 … 14): bigger is better. */
const score = (cat, ranks) => ranks.slice(0, 5).reduce((s, r) => s * 15 + r, cat) * 15 ** (5 - Math.min(5, ranks.length));

/** The best five-card hand among the cards given (five to seven): { score, category, name }. */
export function evaluate(cards) {
  const ranks = cards.map(rankOf);
  const bySuit = {};
  for (const c of cards) (bySuit[suitOf(c)] = bySuit[suitOf(c)] || []).push(rankOf(c));
  const flushSuit = Object.keys(bySuit).find((s) => bySuit[s].length >= 5);
  if (flushSuit) {
    const top = straightTop(bySuit[flushSuit]);
    if (top) return result(8, [top]);
  }
  const counts = new Map();
  for (const r of ranks) counts.set(r, (counts.get(r) || 0) + 1);
  // Ranks grouped: the biggest groups first, then the higher rank.
  const groups = [...counts].sort((a, b) => b[1] - a[1] || b[0] - a[0]);
  const desc = [...new Set(ranks)].sort((a, b) => b - a);
  const kickers = (skip, n) => desc.filter((r) => !skip.includes(r)).slice(0, n);
  if (groups[0][1] === 4) return result(7, [groups[0][0], ...kickers([groups[0][0]], 1)]);
  if (groups[0][1] === 3 && groups[1] && groups[1][1] >= 2) return result(6, [groups[0][0], groups[1][0]]);
  if (flushSuit) return result(5, bySuit[flushSuit].sort((a, b) => b - a).slice(0, 5));
  const top = straightTop(ranks);
  if (top) return result(4, [top]);
  if (groups[0][1] === 3) return result(3, [groups[0][0], ...kickers([groups[0][0]], 2)]);
  if (groups[0][1] === 2 && groups[1] && groups[1][1] === 2) return result(2, [groups[0][0], groups[1][0], ...kickers([groups[0][0], groups[1][0]], 1)]);
  if (groups[0][1] === 2) return result(1, [groups[0][0], ...kickers([groups[0][0]], 3)]);
  return result(0, desc.slice(0, 5));
}

const NAMES = { 2: 'Twos', 3: 'Threes', 4: 'Fours', 5: 'Fives', 6: 'Sixes', 7: 'Sevens', 8: 'Eights', 9: 'Nines', 10: 'Tens', 11: 'Jacks', 12: 'Queens', 13: 'Kings', 14: 'Aces' };
const HIGH = { 11: 'Jack', 12: 'Queen', 13: 'King', 14: 'Ace' };
const one = (r) => HIGH[r] || String(r);

function result(category, ranks) {
  let name = CATEGORIES[category];
  if (category === 1) name = 'Pair of ' + NAMES[ranks[0]];
  else if (category === 2) name = 'Two pair, ' + NAMES[ranks[0]] + ' and ' + NAMES[ranks[1]];
  else if (category === 3) name = 'Three ' + NAMES[ranks[0]];
  else if (category === 4) name = one(ranks[0]) + '-high straight';
  else if (category === 6) name = NAMES[ranks[0]] + ' full of ' + NAMES[ranks[1]];
  else if (category === 7) name = 'Four ' + NAMES[ranks[0]];
  else if (category === 8) name = ranks[0] === 14 ? 'Royal flush' : one(ranks[0]) + '-high straight flush';
  else if (category === 0) name = one(ranks[0]) + ' high';
  else if (category === 5) name = one(ranks[0]) + '-high flush';
  return { score: score(category, ranks), category, name };
}

/**
 * How often `hole` beats a random hand by the river, from `board` (0 to 5 cards known): about, by
 * playing it out `sims` times. A tie counts half. (The computer's sense of how good its cards are.)
 */
export function equity(hole, board, sims, rng) {
  const known = new Set([...hole, ...board]);
  const rest = deck().filter((c) => !known.has(c));
  let won = 0;
  for (let k = 0; k < sims; k++) {
    // A partial shuffle: just the cards needed off the top.
    const need = 2 + (5 - board.length);
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(rng() * (rest.length - i));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }
    const theirs = [rest[0], rest[1]];
    const full = board.concat(rest.slice(2, need));
    const a = evaluate(hole.concat(full)).score;
    const b = evaluate(theirs.concat(full)).score;
    won += a > b ? 1 : a === b ? 0.5 : 0;
  }
  return won / sims;
}
