/**
 * The computer opponent for Party Board (see `bot` in index.js). On the board it plays like a
 * person who knows the game: it heads for the star (the way at a fork that gets there sooner),
 * buys it when it can, saves its coins for it, shops for items that help it get there, and uses
 * them when they pay off. In the minigame after each round it's the minigame player
 * (minis/bots.js).
 *   easy:   takes a random way at forks now and then, spends coins as it likes, and forgets items.
 *   normal: heads for the star, keeps enough for it, uses what it buys.
 *   hard:   the same, and steals your star or coins, or warps past you, when that's worth it.
 */
import { miniBot } from './minis/bots.js';

const THINK = { easy: [1200, 2600], normal: [900, 2000], hard: [800, 1600] };

/** Steps from space `from` to space `to` along the board (forks either way), or Infinity. */
function stepsTo(spaces, from, to) {
  const seen = new Map([[from, 0]]);
  const queue = [from];
  while (queue.length) {
    const i = queue.shift();
    if (i === to) return seen.get(i);
    for (const n of spaces[i].next) {
      if (!seen.has(n)) {
        seen.set(n, seen.get(i) + 1);
        queue.push(n);
      }
    }
  }
  return Infinity;
}

export function partyBoardBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  const T = THINK[level];
  if (!view || !T) return null;
  const me = view.you;
  if (view.phase === 'minigame') return view.mini ? miniBot(view.mini, level, rng, memory, 'round' + view.round) : null;
  const wait = T[0] + rng() * (T[1] - T[0]);
  if (view.phase === 'pick') {
    return view.pick && view.pick.picks[me] === null ? { type: 'pick', value: view.pick.options[Math.floor(rng() * view.pick.options.length)], botDelayMs: wait } : null;
  }
  const p = view.prompt;
  if (!p || p.slot !== me || !view.board) return null;
  const choose = (value) => ({ type: 'choose', value, botDelayMs: wait });
  const b = view.board;
  const mine = view.players[me];
  const theirs = view.players[1 - me];
  const toStar = (from) => stepsTo(b.spaces, from, b.star);
  switch (p.kind) {
    case 'roll':
    case 'slot':
      return { type: 'choose', value: p.options[0], botDelayMs: p.kind === 'slot' ? 500 + rng() * 900 : wait * 0.6 };
    case 'star':
      return choose(mine.coins >= b.starPrice ? 'yes' : 'no');
    case 'path': {
      // The way that gets to the star sooner (Easy: now and then just a way).
      const ways = p.extra.routes.map((r) => toStar(r[0]));
      if (level === 'easy' && rng() < 0.35) return choose(p.options[Math.floor(rng() * 2)]);
      return choose(ways[1] < ways[0] ? '1' : '0');
    }
    case 'shop': {
      const price = (id) => (view.items[id] ? view.items[id].price : Infinity);
      const can = p.options.filter((id) => id !== 'none');
      if (level === 'easy') return choose(can.length && rng() < 0.5 ? can[Math.floor(rng() * can.length)] : 'none');
      // Keep enough for the star (unless the item is the star thief), then the most useful it can afford.
      const want = level === 'hard' ? ['star-thief', 'double', 'mushroom', 'coin-thief', 'warp'] : ['double', 'mushroom', 'star-thief', 'warp', 'coin-thief'];
      const keep = b.starPrice;
      const pick = want.find((id) => can.includes(id) && (id === 'star-thief' ? theirs.stars > 0 : mine.coins - price(id) >= keep - 5));
      return choose(pick || 'none');
    }
    case 'item': {
      const has = (id) => p.options.includes(id);
      if (level === 'easy' && rng() < 0.5) return choose('none');
      if (has('star-thief')) return choose('star-thief');
      const dist = toStar(mine.space);
      if (level === 'hard' && has('warp') && toStar(theirs.space) + 3 < dist) return choose('warp');
      if (has('coin-thief') && theirs.coins >= 6) return choose('coin-thief');
      // Extra steps when the star's further than one die gets you (dice are 1-10).
      if (has('double') && dist > 6 && dist < 22) return choose('double');
      if (has('mushroom') && dist > 4 && dist < 14) return choose('mushroom');
      return choose('none');
    }
    default:
      return choose(p.options.includes('none') ? 'none' : p.options[0]);
  }
}
