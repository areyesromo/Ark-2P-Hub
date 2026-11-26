/**
 * The computer for Baccarat (see `bot` in index.js). Every bet loses a little on average (the Tie
 * a lot: it pays 8 to 1 but comes up about one coup in ten), so the match is won by betting wisely
 * against the other player, not against the house.
 *   easy:   follows hunches: Player or Banker, the Tie now and then, small amounts.
 *   normal: bets the Banker (the best odds) or rides a streak; small when ahead, bigger when behind.
 *   hard:   plays you, not the house. You both bet on the same coup, so when it's ahead it bets
 *           what you usually bet (whatever happens, you both win or lose alike), and when it's
 *           behind it bets the other way, enough to catch up (and a Tie when it needs a miracle).
 */
import { MIN_BET } from './baccarat.js';

const pace = (rng) => 1300 + rng() * 2200;
const fit = (x, max) => Math.max(MIN_BET, Math.min(max, Math.round(x / MIN_BET) * MIN_BET));

/** What the other player usually bets: their most common side, and a typical amount. */
function habit(history, them) {
  const bets = history.map((h) => h.bets[them]).filter((b) => b && b !== 'out');
  if (!bets.length) return { side: 'banker', amount: 100 };
  const count = { player: 0, banker: 0, tie: 0 };
  bets.forEach((b, i) => { count[b.side] += 1 + i / bets.length; }); // (recent ones count more)
  const side = Object.keys(count).sort((a, b) => count[b] - count[a])[0];
  const amounts = bets.map((b) => b.amount).sort((a, b) => a - b);
  return { side, amount: amounts[Math.floor(amounts.length / 2)] };
}

export function baccaratBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'bet' || view.locked[view.you] || !['easy', 'normal', 'hard'].includes(level)) return null;
  const me = view.you;
  const max = view.maxBets[me];
  const bet = (side, amount) => ({ type: 'bet', side, amount: fit(amount, max), botDelayMs: pace(rng), botFor: 'c' + view.coup });
  if (level === 'easy') {
    const r = rng();
    return bet(r < 0.1 ? 'tie' : r < 0.55 ? 'player' : 'banker', 25 + Math.floor(rng() * 4) * 25);
  }
  if (level === 'normal') {
    // The Banker mostly; now and then it rides a streak of Player wins.
    const last = view.history.slice(-2).map((h) => h.winner);
    const side = last.length === 2 && last.every((w) => w === 'player') ? 'player' : 'banker';
    return bet(side, view.chips[me] > view.chips[1 - me] ? 50 : 200); // (careful when ahead)
  }
  const lead = view.chips[me] - view.chips[1 - me];
  const left = view.coups - view.coup + 1; // this coup and those after it
  const them = habit(view.history, 1 - me);
  if (lead > 0) return bet(them.side === 'tie' ? 'banker' : them.side, them.amount); // ahead: shadow them
  const need = -lead + MIN_BET;
  // Far behind with little time: a Tie pays 8 to 1.
  if (left <= 2 && need > (max + them.amount) * 1.1) return bet('tie', need / 8 + MIN_BET);
  // Behind: the other side to theirs, so each coup swings the gap by both bets.
  const side = them.side === 'player' ? 'banker' : 'player';
  return bet(side, Math.max(them.amount, need / left));
}
