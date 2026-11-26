/**
 * The computer for Go Fish (see `bot` in index.js). It sees its own hand and hears every ask, like
 * you. What the other asked for, they hold (until they hand it over); what they said "go fish" to,
 * they don't (until they draw again).
 *   easy:   mostly chases its odd cards (a single seven: "any sevens?"), and forgets what it heard.
 *   normal: asks for a rank it knows they hold, else the one it has most of.
 *   hard:   as Normal, but it asks for the rank most likely to make a book now (from how many of
 *           each are still unseen, and in their hand or the pond), never one they've just denied.
 */
export function goFishBot(view, level, rng = Math.random) {
  if (!view || view.phase !== 'play' || view.turn !== view.you || !view.hand || !view.hand.length) return null;
  if (!['easy', 'normal', 'hard'].includes(level)) return null;
  const me = view.you;
  const mine = {};
  for (const c of view.hand) { const r = c.slice(0, -1); mine[r] = (mine[r] || 0) + 1; }
  const ranks = Object.keys(mine);
  const pace = { botDelayMs: 1300 + rng() * 1500, botFor: 'a' + view.n };
  if (level === 'easy') {
    // It chases its odd cards (the ones it holds fewest of), and forgets what it heard.
    const low = ranks.slice().sort((a, b) => mine[a] - mine[b] || rng() - 0.5);
    return { type: 'ask', rank: rng() < 0.7 ? low[0] : ranks[Math.floor(rng() * ranks.length)], ...pace };
  }
  // What the log says about their hand.
  const has = new Set();
  const lacks = new Set();
  for (const e of view.log) {
    if (e.by !== me) {
      if (e.rank) has.add(e.rank); // they asked for it: they hold it
      if (e.got) lacks.delete(e.rank);
      if (e.fished) lacks.clear(); // they drew: anything's possible again
    } else if (e.rank) {
      has.delete(e.rank); // we took them all (or they had none)
      if (!e.got) lacks.add(e.rank);
    }
  }
  for (const r of [...view.books[0], ...view.books[1]]) { has.delete(r); lacks.delete(r); }
  const known = ranks.filter((r) => has.has(r));
  if (known.length) return { type: 'ask', rank: known.sort((a, b) => mine[b] - mine[a])[0], ...pace };
  if (level === 'hard') {
    // The ask most likely to make a book (never one they've just denied).
    const h = view.handCounts[1 - me];
    const unseen = h + view.pond;
    // Books are what count: the chance their hand holds every copy we're missing (a book now),
    // with a little for any hit at all.
    const chance = (r) => {
      if (lacks.has(r) || !unseen) return 0;
      const k = 4 - mine[r];
      let all = 1; // the chance all k copies are among their h cards
      for (let i = 0; i < k; i++) all *= Math.max(0, h - i) / (unseen - i);
      let miss = 1; // the chance none is
      for (let i = 0; i < h; i++) miss *= Math.max(0, unseen - k - i) / (unseen - i);
      return all + 0.05 * (1 - miss);
    };
    const best = ranks.slice().sort((a, b) => chance(b) - chance(a) || mine[b] - mine[a])[0];
    return { type: 'ask', rank: best, ...pace };
  }
  const pool = ranks.slice().sort((a, b) => mine[b] - mine[a] || rng() - 0.5);
  return { type: 'ask', rank: pool[0], ...pace };
}
