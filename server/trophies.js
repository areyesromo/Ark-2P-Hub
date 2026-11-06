import fs from 'node:fs';
import path from 'node:path';
import { nameKey } from './stats.js';

/**
 * Trophies: achievements each player collects (by name), kept in trophies.json in the data folder.
 * Each is checked when a game ends, from that game's result and the player's history (stats.js)
 * and practice against the computer (practice.js).
 *
 * A check gets `e`, for one player: { game, category, view, slot, won, draw, bot (the computer's
 * level, or null), title (a best-of tournament they just won: { bestOf }), played (Set of game ids
 * they've finished, people or the computer), winsVsPeople, wonVsPeople (Set of game ids),
 * bestRivalWins, hardWins (Set of game ids beaten on Hard), allGames, botGames (the head-to-head
 * games the computer plays) }.
 */
const stars = (e) => Number(e.view.stars) || 0;
const perfect = (e) => Number(e.view.maxStars) > 0 && stars(e) === Number(e.view.maxStars);

export const TROPHIES = [
  // Exploring
  { id: 'first-game', icon: '🎮', name: 'Game on', how: 'Finish a game', test: () => true },
  { id: 'explorer', icon: '🧭', name: 'Explorer', how: 'Play 10 different games', test: (e) => e.played.size >= 10 },
  { id: 'globetrotter', icon: '🗺️', name: 'Globetrotter', how: 'Play 25 different games', test: (e) => e.played.size >= 25 },
  { id: 'seen-it-all', icon: '🌍', name: 'Seen it all', how: 'Play every game', test: (e) => e.played.size >= e.allGames },
  // Against each other
  { id: 'first-win', icon: '🥇', name: 'First win', how: 'Win a game against a person', test: (e) => !e.bot && e.won },
  { id: 'clean-sweep', icon: '🧹', name: 'Clean sweep', how: 'Win a game against a person without them scoring', test: (e) => !e.bot && e.won && Array.isArray(e.view.scores) && e.view.scores[e.slot] > 0 && e.view.scores[1 - e.slot] === 0 },
  { id: 'all-rounder', icon: '🎯', name: 'All-rounder', how: 'Win 10 different games against people', test: (e) => e.wonVsPeople.size >= 10 },
  { id: 'veteran', icon: '🏅', name: 'Veteran', how: 'Win 50 games against people', test: (e) => e.winsVsPeople >= 50 },
  { id: 'nemesis', icon: '⚔️', name: 'Nemesis', how: 'Win 10 games against the same rival', test: (e) => e.bestRivalWins >= 10 },
  { id: 'champion', icon: '🏆', name: 'Champion', how: 'Win a best-of-7 tournament', test: (e) => Boolean(e.title && e.title.bestOf >= 7) },
  // Feats
  { id: 'cup-winner', icon: '🏁', name: 'Cup winner', how: 'Win a Kart Race cup', test: (e) => e.game.startsWith('kart-race') && e.won && e.view.cup === true },
  { id: 'party-king', icon: '🎉', name: 'Party king', how: 'Win a Party Board', test: (e) => e.game === 'party-board' && e.won },
  { id: 'untouchable', icon: '🔥', name: 'Untouchable', how: 'Win Micro Mayhem without losing a life', test: (e) => e.game === 'micro-mayhem' && e.won && Array.isArray(e.view.lives) && e.view.lives[e.slot] === e.view.startLives },
  { id: 'wardenbreaker', icon: '🗿', name: 'Wardenbreaker', how: 'Beat the Stone Warden in Dungeon Duo', test: (e) => e.game === 'dungeon-duo' && e.view.won === true },
  { id: 'flawless-quest', icon: '✨', name: 'Flawless quest', how: 'Every star in Dungeon Duo', test: (e) => e.game === 'dungeon-duo' && e.view.won === true && perfect(e) },
  { id: 'head-chef', icon: '👨‍🍳', name: 'Head chef', how: 'Three stars in Kitchen Rush\'s Rush Hour', test: (e) => e.game === 'kitchen-rush' && e.view.kitchen === 'Rush Hour' && stars(e) >= 3 },
  { id: 'dragon-slayer', icon: '🐉', name: 'Dragon slayer', how: 'A perfect nine-star Trivia Quest', test: (e) => e.game === 'trivia-quest' && stars(e) >= 9 },
  { id: 'marble-master', icon: '🎱', name: 'Marble master', how: 'All five mazes with every star', test: (e) => e.game === 'marble-maze' && stars(e) >= 15 },
  { id: 'cool-head', icon: '💣', name: 'Cool head', how: 'Every star on five bombs in Bomb Squad', test: (e) => e.game === 'bomb-squad' && Number(e.view.maxStars) >= 15 && perfect(e) },
  { id: 'on-the-same-page', icon: '🧠', name: 'On the same page', how: 'Every star in a game of Mind Meld', test: (e) => e.game === 'mind-meld' && perfect(e) },
  // Practice against the computer
  { id: 'sparring', icon: '🤖', name: 'Sparring partner', how: 'Beat the computer', test: (e) => Boolean(e.bot) && e.won },
  { id: 'machine-breaker', icon: '🦾', name: 'Machine breaker', how: 'Beat the computer on Hard', test: (e) => e.bot === 'hard' && e.won },
  { id: 'man-vs-machine', icon: '🔩', name: 'Man vs machine', how: 'Beat the Hard computer in 10 different games', test: (e) => e.hardWins.size >= 10 },
  { id: 'unbeatable', icon: '👑', name: 'Unbeatable', how: 'Beat the Hard computer in every game it plays against you', test: (e) => e.botGames.length > 0 && e.botGames.every((g) => e.hardWins.has(g)) },
  { id: 'dream-team', icon: '🤝', name: 'Dream team', how: 'Every star in a co-op game with the computer as your teammate', test: (e) => Boolean(e.bot) && e.category === 'casual' && perfect(e) },
];

/** What a check needs about a player, from their history and practice records (see TROPHIES). */
export function contextFor(name, { stats = null, practice = null } = {}) {
  const k = nameKey(name);
  const played = new Set();
  const wonVsPeople = new Set();
  let winsVsPeople = 0;
  const rivals = new Map();
  for (const m of stats ? stats.matches : []) {
    const i = m.players.map(nameKey).indexOf(k);
    if (i === -1) continue;
    played.add(m.game);
    if (m.category !== 'casual' && m.winner === i) {
      winsVsPeople++;
      wonVsPeople.add(m.game);
      const rival = nameKey(m.players[1 - i]);
      rivals.set(rival, (rivals.get(rival) || 0) + 1);
    }
  }
  const hardWins = new Set();
  for (const [game, levels] of Object.entries(practice ? practice.recordsFor(name) : {})) {
    played.add(game);
    if (levels.hard && levels.hard.wins > 0) hardWins.add(game);
  }
  return { played, wonVsPeople, winsVsPeople, bestRivalWins: Math.max(0, ...rivals.values()), hardWins };
}

/** Each player's trophies: nameKey -> { name, got: { trophyId -> when } }, in trophies.json. */
export class Trophies {
  constructor(dataDir) {
    this.file = dataDir ? path.join(dataDir, 'trophies.json') : null;
    this.players = this.load();
  }

  load() {
    if (!this.file) return {};
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      return data && typeof data.players === 'object' && data.players ? data.players : {};
    } catch {
      return {};
    }
  }

  save() {
    if (!this.file) return;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ players: this.players }));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('Could not save trophies:', err.message);
    }
  }

  /** The trophies `name` has just earned with this result (e: see TROPHIES), saved; [] if none. */
  check(name, e) {
    const k = nameKey(name);
    if (!k) return [];
    const p = (this.players[k] = this.players[k] || { name, got: {} });
    p.name = name;
    const fresh = TROPHIES.filter((t) => !p.got[t.id] && safeTest(t, e));
    if (!fresh.length) return [];
    const at = Date.now();
    for (const t of fresh) p.got[t.id] = at;
    this.save();
    return fresh.map(({ id, icon, name: title }) => ({ id, icon, name: title }));
  }

  /** One player's trophies, every one listed (locked ones with how to earn them). */
  forName(name) {
    const p = this.players[nameKey(name)];
    const got = p ? p.got : {};
    return {
      name: p ? p.name : name,
      count: Object.keys(got).filter((id) => TROPHIES.some((t) => t.id === id)).length,
      total: TROPHIES.length,
      trophies: TROPHIES.map(({ id, icon, name: title, how }) => ({ id, icon, name: title, how, at: got[id] || null })),
    };
  }

  /** Everyone with a trophy, most first: [{ name, count, icons }]. */
  summary() {
    return Object.values(this.players)
      .map((p) => {
        const got = TROPHIES.filter((t) => p.got[t.id]);
        return { name: p.name, count: got.length, icons: got.map((t) => t.icon) };
      })
      .filter((p) => p.count)
      .sort((a, b) => b.count - a.count);
  }

  reset() {
    this.players = {};
    this.save();
  }
}

/** (a check that trips over an odd view is just not earned) */
function safeTest(t, e) {
  try {
    return Boolean(t.test(e));
  } catch {
    return false;
  }
}
