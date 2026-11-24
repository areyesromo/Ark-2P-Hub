// A player's collection: everything a game keeps locked until it's earned (Helicopter
// Cave's maps and vehicles, the looks, Sokoban's levels), open or still locked, and how
// to open it. Built from each game's own setup spec (see `lock` in games/options.js), so a
// new unlockable shows up here without anything added to this file.

import { SOLO_GAMES } from './games/index.js';
import { lockedFor } from './games/options.js';

const getGame = (id) => SOLO_GAMES.find((g) => g.id === id) || null;
const listGames = () => SOLO_GAMES;
const own = (obj, key) => Boolean(obj) && Object.prototype.hasOwnProperty.call(obj, key);

/**
 * The groups of unlockables for a player: [{ game, gameName, rows: [{ key, title, items }] }].
 * have: the player's achievements ({ id: when }); bestOf(game, variant, better): their best, or null.
 * An item is { value, label, open, how }, how being "Fly 100 m to unlock" while it's locked.
 */
export function collectionFor({ have, bestOf }) {
  const groups = [];
  for (const { id } of listGames()) {
    const def = getGame(id);
    const rows = Object.entries(def.spec || {}).filter(([, s]) => s.lock);
    if (!rows.length) continue;
    const ctx = { achievements: () => have, best: (variant) => bestOf(id, variant, def.score.better) };
    const locked = lockedFor(ctx, def.spec);
    // Only what's there to unlock: the first choice and the ones a new player finds locked
    // (Dog Park's random parks, say, are open to everyone, so they're not part of a collection).
    const fresh = lockedFor({ achievements: () => ({}), best: () => null }, def.spec);
    groups.push({
      game: id,
      gameName: def.name,
      rows: rows.map(([key, s]) => ({
        key,
        title: s.title,
        items: s.values.filter((value, i) => i === 0 || own(fresh[key], value)).map((value) => {
          const how = own(locked[key], value) ? locked[key][value] : null;
          return { value, label: s.label(value), open: how === null, how };
        }),
      })),
    });
  }
  return groups;
}

/** How many items are open, and how many there are. */
export function countOpen(groups) {
  let got = 0;
  let total = 0;
  for (const g of groups) for (const r of g.rows) for (const i of r.items) {
    total++;
    if (i.open) got++;
  }
  return { got, total };
}
