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
// Games whose score is what you've got left (lives, dice), not points: the loser always ends on 0.
const LEFT_SCORES = new Set(['micro-mayhem', 'liars-dice', 'tower-duel']);
/** A lookup keyed by player names: no inherited keys, so a player called "constructor" is just a name. */
const table = () => Object.create(null);
const perfect = (e) => Number(e.view.maxStars) > 0 && stars(e) === Number(e.view.maxStars);

export const TROPHIES = [
  // Exploring
  { id: 'first-game', icon: '🎮', name: 'Game on', how: 'Finish a game', test: () => true },
  { id: 'explorer', icon: '🧭', name: 'Explorer', how: 'Play 10 different games', test: (e) => e.played.size >= 10 },
  { id: 'globetrotter', icon: '🗺️', name: 'Globetrotter', how: 'Play 25 different games', test: (e) => e.played.size >= 25 },
  { id: 'seen-it-all', icon: '🌍', name: 'Seen it all', how: 'Play every game', test: (e) => e.played.size >= e.allGames },
  // Against each other
  { id: 'first-win', icon: '🥇', name: 'First win', how: 'Win a game against a person', test: (e) => !e.bot && e.won },
  { id: 'clean-sweep', icon: '🧹', name: 'Clean sweep', how: 'Win a game against a person without them scoring', test: (e) => !e.bot && e.won && !LEFT_SCORES.has(e.game) && Array.isArray(e.view.scores) && e.view.scores[e.slot] > 0 && e.view.scores[1 - e.slot] === 0 },
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
  { id: 'turkey', icon: '🦃', name: 'Turkey', how: 'Three strikes in a row in Bowling', test: (e) => e.game === 'ten-pin' && Array.isArray(e.view.bestStreak) && e.view.bestStreak[e.slot] >= 3 },
  { id: 'perfect-game', icon: '🎳', name: 'Perfect game', how: 'Bowl a 300 (twelve strikes in a row)', test: (e) => e.game === 'ten-pin' && e.view.frames === 10 && Array.isArray(e.view.perfect) && e.view.perfect[e.slot] === true },
  { id: 'on-the-same-page', icon: '🧠', name: 'On the same page', how: 'Every star in a game of Mind Meld', test: (e) => e.game === 'mind-meld' && perfect(e) },
  // Practice against the computer
  { id: 'sparring', icon: '🤖', name: 'Sparring partner', how: 'Beat the computer', test: (e) => Boolean(e.bot) && e.won },
  { id: 'machine-breaker', icon: '🦾', name: 'Machine breaker', how: 'Beat the computer on Hard', test: (e) => e.bot === 'hard' && e.won },
  { id: 'man-vs-machine', icon: '🔩', name: 'Man vs machine', how: 'Beat the Hard computer in 10 different games', test: (e) => e.hardWins.size >= 10 },
  { id: 'unbeatable', icon: '👑', name: 'Unbeatable', how: 'Beat the Hard computer in every game it plays against you', test: (e) => e.botGames.length > 0 && e.botGames.every((g) => e.hardWins.has(g)) },
  { id: 'dream-team', icon: '🤝', name: 'Dream team', how: 'Every star in a co-op game with the computer as your teammate', test: (e) => Boolean(e.bot) && e.category === 'casual' && perfect(e) },
];

/**
 * What a check needs about a player (see TROPHIES): their match history (stats.js keeps only the
 * last 2000 matches, so the trophies keep their own tally too, and the two are merged) and their
 * practice records.
 */
export function contextFor(name, { stats = null, practice = null, trophies = null } = {}) {
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
  const tally = trophies ? trophies.tallyFor(name) : null;
  if (tally) {
    tally.played.forEach((g) => played.add(g));
    tally.won.forEach((g) => wonVsPeople.add(g));
    winsVsPeople = Math.max(winsVsPeople, tally.wins);
    for (const [rival, n] of Object.entries(tally.rivals)) rivals.set(rival, Math.max(rivals.get(rival) || 0, n));
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
    const out = table();
    if (!this.file) return out;
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      // (only well-formed entries: a hand-edited or half-written file doesn't trip the checks)
      for (const [k, p] of Object.entries((data && data.players) || {})) {
        if (!p || typeof p !== 'object') continue;
        out[k] = this.entry(String(p.name || k), p);
      }
    } catch {
      // (unreadable: start afresh, as stats.json does)
    }
    return out;
  }

  /** A player's entry, from what was saved (or blank). */
  entry(name, p = {}) {
    const got = table();
    for (const [id, at] of Object.entries(p.got && typeof p.got === 'object' ? p.got : {})) if (Number.isFinite(at)) got[id] = at;
    const t = p.tally && typeof p.tally === 'object' ? p.tally : {};
    const rivals = table();
    for (const [k, n] of Object.entries(t.rivals && typeof t.rivals === 'object' ? t.rivals : {})) if (Number.isFinite(n)) rivals[k] = n;
    return {
      name,
      got,
      tally: { played: Array.isArray(t.played) ? t.played.slice() : [], won: Array.isArray(t.won) ? t.won.slice() : [], wins: Number(t.wins) || 0, rivals },
    };
  }

  /** The player's entry, made if new. */
  player(name) {
    const k = nameKey(name);
    if (!this.players[k]) this.players[k] = this.entry(name);
    this.players[k].name = name; // latest spelling wins
    return this.players[k];
  }

  /** Count a game a person played against a person (won: and won it, against `rival`). */
  note(name, { game, won = false, rival = null }) {
    if (!nameKey(name) || typeof game !== 'string') return;
    const t = this.player(name).tally;
    if (!t.played.includes(game)) t.played.push(game);
    if (!won) return;
    t.wins++;
    if (!t.won.includes(game)) t.won.push(game);
    const r = nameKey(rival);
    if (r) t.rivals[r] = (t.rivals[r] || 0) + 1;
  }

  /** A player's own tally (see note), or null. */
  tallyFor(name) {
    const p = this.players[nameKey(name)];
    return p ? p.tally : null;
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
    if (!nameKey(name)) return [];
    const p = this.player(name);
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
    this.players = table();
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
