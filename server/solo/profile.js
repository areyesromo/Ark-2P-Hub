// A player's stats page: what they've played and how it's going, worked out from the
// runs the hub keeps. Runs are only kept for the latest MAX_RUNS (see stats.js), and
// there's no record of how long a run took, so this is counts and bests, not hours.

const DAY = 86400000;
const isDaily = (variant) => /^Daily /.test(variant || '');
const better = (a, b, how) => (how === 'lower' ? a < b : a > b);

/**
 * runs: one player's finished runs, oldest first ({ at, game, variant, score, better, unit }).
 * names: gameId -> display name. now: a timestamp. days: how many days the activity chart shows.
 * Returns { runs, games, activeDays, favourites, records, recordCount, activity }.
 */
export function profileFor({ runs, names, now, days = 14 }) {
  const byGame = new Map();
  const bests = new Map(); // game + variant -> best so far, to spot each new personal record
  const records = [];
  let recordCount = 0;
  for (const r of runs) {
    const g = byGame.get(r.game) || { game: r.game, plays: 0, last: 0, boards: new Map() };
    g.plays++;
    g.last = Math.max(g.last, r.at || 0);
    byGame.set(r.game, g);
    // Each day's daily challenge is its own table, so it can't hold a "best" or a record.
    if (isDaily(r.variant)) continue;
    const variant = r.variant || '';
    const board = g.boards.get(variant) || { variant, plays: 0, best: null, unit: r.unit, better: r.better };
    board.plays++;
    board.unit = r.unit;
    if (board.best === null || better(r.score, board.best, r.better)) board.best = r.score;
    g.boards.set(variant, board);
    const id = r.game + '\u0000' + variant;
    if (!bests.has(id) || better(r.score, bests.get(id), r.better)) {
      // The very first run on a board isn't a record, just a start.
      if (bests.has(id)) {
        recordCount++;
        records.push({ at: r.at, game: r.game, gameName: names[r.game] || r.game, variant, score: r.score, unit: r.unit, was: bests.get(id) });
      }
      bests.set(id, r.score);
    }
  }
  const favourites = [...byGame.values()]
    .sort((a, b) => b.plays - a.plays || b.last - a.last)
    .slice(0, 5)
    .map((g) => {
      // Shown with the board they play most.
      const board = [...g.boards.values()].sort((a, b) => b.plays - a.plays)[0] || null;
      return { game: g.game, gameName: names[g.game] || g.game, plays: g.plays, last: g.last, board };
    });
  const today = Math.floor(now / DAY);
  const counts = new Map();
  for (const r of runs) {
    const d = Math.floor((r.at || 0) / DAY);
    counts.set(d, (counts.get(d) || 0) + 1);
  }
  const activity = Array.from({ length: days }, (_, i) => {
    const d = today - (days - 1 - i);
    return { day: new Date(d * DAY).toISOString().slice(0, 10), runs: counts.get(d) || 0 };
  });
  return {
    runs: runs.length,
    games: byGame.size,
    activeDays: counts.size,
    favourites,
    records: records.slice(-8).reverse(),
    recordCount,
    activity,
  };
}
