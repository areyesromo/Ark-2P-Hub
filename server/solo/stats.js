import fs from 'node:fs';
import path from 'node:path';
import { longestStreak } from './achievements.js';

export const MAX_RUNS = 5000; // oldest are dropped beyond this
const RECENT = 30;
const TOP = 10;

/** Players are matched by name, ignoring case and surrounding spaces. */
export const nameKey = (name) => String(name || '').trim().toLowerCase();

/** True when score a beats score b ('higher' or 'lower' is better). */
export const beats = (a, b, better) => (better === 'lower' ? a < b : a > b);

const sameBoard = (r, game, variant) => r.game === game && (r.variant || '') === (variant || '');

/**
 * Every finished run and the bests built from it, kept in stats.json in the
 * data folder (a Docker volume, so it survives updates).
 *
 * A run:
 *   { at, game, gameName, player, score, variant, better: 'higher' | 'lower', unit }
 *
 * variant splits the bests of one game (a difficulty, a board size): a 9×9
 * Minesweeper time doesn't compete with a 16×16 one.
 *
 * achievements: what each player has unlocked, nameKey -> { id: when } (see achievements.js).
 *
 * dailies remembers each player's go at a daily puzzle (Word Guess's word of
 * the day), so it can be played once a day: 'game|YYYY-MM-DD|name' -> what the game saved.
 */
export class Stats {
  constructor(dataDir) {
    this.file = dataDir ? path.join(dataDir, 'solo-stats.json') : null;
    const data = this.load();
    this.runs = Array.isArray(data.runs) ? data.runs : [];
    this.dailies = data.dailies && typeof data.dailies === 'object' ? data.dailies : {};
    this.achievements = data.achievements && typeof data.achievements === 'object' ? data.achievements : {};
    this.version = 0; // goes up on every change, so callers can cache what they looked up
  }

  load() {
    if (!this.file) return {};
    try {
      return JSON.parse(fs.readFileSync(this.file, 'utf8')) || {};
    } catch {
      return {};
    }
  }

  save() {
    if (!this.file) return;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ runs: this.runs, dailies: this.dailies, achievements: this.achievements }));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('Could not save the score history:', err.message);
    }
  }

  /**
   * Add a run. Returns how it went: the player's best before it, whether it
   * beat that, and where it ranks among every run of that game and variant
   * (1 = the best on this hub).
   */
  record(run) {
    const entry = { at: Date.now(), ...run, variant: run.variant || '' };
    const best = this.bestFor(entry.game, entry.variant, entry.player, entry.better);
    const rank = 1 + this.runs.filter((r) => sameBoard(r, entry.game, entry.variant) && beats(r.score, entry.score, entry.better)).length;
    this.runs.push(entry);
    this.version++;
    if (this.runs.length > MAX_RUNS) this.runs.splice(0, this.runs.length - MAX_RUNS);
    this.save();
    return { score: entry.score, best, newBest: best === null || beats(entry.score, best, entry.better), rank };
  }

  reset() {
    this.runs = [];
    this.dailies = {};
    this.achievements = {};
    this.version++;
    this.save();
  }

  /** The achievements a player has: { id: when unlocked }. */
  achievementsOf(name) {
    return this.achievements[nameKey(name)] || {};
  }

  /** Mark achievements unlocked for a player (ids already there keep their date). */
  unlock(name, ids) {
    if (!ids.length) return;
    const k = nameKey(name);
    const mine = this.achievements[k] || (this.achievements[k] = {});
    const at = Date.now();
    for (const id of ids) if (!mine[id]) mine[id] = at;
    this.save();
  }

  /**
   * A player's record, for achievements: runs finished, games scored in,
   * personal bests set (each time a run beat their best), the longest run of
   * days played in a row, days today's word was found (Word Guess), daily
   * challenges played, and how many tables they're top of.
   */
  historyOf(name) {
    const key = nameKey(name);
    const mine = this.runs.filter((r) => nameKey(r.player) === key);
    const best = new Map();
    let bests = 0;
    for (const r of mine) {
      const id = r.game + '\u0000' + (r.variant || '');
      if (!best.has(id) || beats(r.score, best.get(id), r.better)) {
        bests++;
        best.set(id, r.score);
      }
    }
    const top = new Map(); // board -> best score anyone has
    for (const r of this.runs) {
      const id = r.game + '\u0000' + (r.variant || '');
      if (!top.has(id) || beats(r.score, top.get(id), r.better)) top.set(id, r.score);
    }
    let topSpots = 0;
    for (const [id, score] of best) if (top.get(id) === score) topSpots++;
    const days = new Set(mine.filter((r) => r.game === 'word-guess' && r.variant === 'Daily').map((r) => Math.floor(r.at / 86400000)));
    return {
      runs: mine.length,
      games: new Set(mine.map((r) => r.game)).size,
      bests,
      topSpots,
      streak: longestStreak(mine.map((r) => r.at)),
      dailyWords: days.size,
      dailyChallenges: Object.keys(this.dailies).filter((k) => k.startsWith('daily|') && k.endsWith('|' + key)).length,
    };
  }

  /**
   * The days a player took part in the daily challenge: Map of 'YYYY-MM-DD' -> { game, score },
   * score null for a go they started and didn't finish. Taken from the saved goes (which are only
   * kept for a couple of months) and from the finished runs (which are kept much longer).
   */
  dailyDaysOf(name) {
    const key = nameKey(name);
    const out = new Map();
    for (const k of Object.keys(this.dailies)) {
      const m = /^daily\|(\d{4}-\d{2}-\d{2})\|(.*)$/.exec(k);
      if (m && m[2] === key) out.set(m[1], { game: this.dailies[k].game, score: this.dailies[k].score === undefined ? null : this.dailies[k].score });
    }
    for (const r of this.runs) {
      const m = /^Daily (\d{4}-\d{2}-\d{2})$/.exec(r.variant || '');
      if (m && nameKey(r.player) === key && r.score !== null && r.score !== undefined) out.set(m[1], { game: r.game, score: r.score });
    }
    return out;
  }

  /** A player's go at a game's daily puzzle (day: 'YYYY-MM-DD'), or null. */
  getDaily(game, day, name) {
    return this.dailies[`${game}|${day}|${nameKey(name)}`] || null;
  }

  setDaily(game, day, name, data) {
    this.dailies[`${game}|${day}|${nameKey(name)}`] = data;
    // Only the last few weeks matter: drop older days so the file doesn't grow forever.
    const cutoff = new Date(Date.now() - 60 * 86400000).toISOString().slice(0, 10);
    for (const key of Object.keys(this.dailies)) if (key.split('|')[1] < cutoff) delete this.dailies[key];
    this.save();
  }

  /** A player's best score in a game and variant, or null. */
  bestFor(game, variant, name, better = 'higher') {
    const key = nameKey(name);
    let best = null;
    for (const r of this.runs) {
      if (sameBoard(r, game, variant) && nameKey(r.player) === key && (best === null || beats(r.score, best, better))) best = r.score;
    }
    return best;
  }

  /**
   * A player's best in each game, for the lobby cards: gameId -> { score, variant, unit, better },
   * in the variant they played last (daily challenges aside: each day is its own table).
   */
  bestsOf(name) {
    const key = nameKey(name);
    const lastVariant = {};
    for (const r of this.runs) if (nameKey(r.player) === key && !String(r.variant || '').startsWith('Daily ')) lastVariant[r.game] = r.variant || '';
    const out = {};
    for (const [game, variant] of Object.entries(lastVariant)) {
      const r = this.runs.findLast((x) => x.game === game); // the latest, in case the game changed its unit
      out[game] = { score: this.bestFor(game, variant, name, r.better), variant, unit: r.unit, better: r.better };
    }
    return out;
  }

  /** gameId -> when it was last finished. */
  lastPlayed() {
    const out = {};
    for (const r of this.runs) out[r.game] = Math.max(out[r.game] || 0, r.at || 0);
    return out;
  }

  /** Names seen in the history, most recent first (for controller players to pick from). */
  knownNames(limit = 12) {
    const seen = new Map();
    for (let i = this.runs.length - 1; i >= 0 && seen.size < limit; i--) {
      const k = nameKey(this.runs[i].player);
      if (k && !seen.has(k)) seen.set(k, this.runs[i].player);
    }
    return [...seen.values()];
  }

  /**
   * For /stats/: each game and variant's top 10 (one row per player, their best),
   * the most active players and the latest runs.
   */
  leaderboard() {
    const boards = new Map();
    const players = new Map();
    for (const r of this.runs) {
      const id = r.game + '\u0000' + (r.variant || '');
      if (!boards.has(id)) boards.set(id, { game: r.game, gameName: r.gameName, variant: r.variant || '', better: r.better, unit: r.unit, runs: 0, bests: new Map() });
      const b = boards.get(id);
      b.runs++;
      b.unit = r.unit; // the latest run's, in case a game changed how it shows its score
      b.gameName = r.gameName;
      const k = nameKey(r.player);
      const cur = b.bests.get(k);
      if (!cur || beats(r.score, cur.score, r.better)) b.bests.set(k, { name: r.player, score: r.score, at: r.at });
      if (!players.has(k)) players.set(k, { name: r.player, runs: 0, games: new Set(), last: 0 });
      const p = players.get(k);
      p.runs++;
      p.games.add(r.game);
      p.last = Math.max(p.last, r.at || 0);
    }
    const games = [...boards.values()]
      .map(({ bests, ...b }) => ({
        ...b,
        top: [...bests.values()].sort((x, y) => (beats(x.score, y.score, b.better) ? -1 : beats(y.score, x.score, b.better) ? 1 : x.at - y.at)).slice(0, TOP),
      }))
      .sort((x, y) => y.runs - x.runs);
    return {
      total: this.runs.length,
      games,
      players: [...players.values()].map((p) => ({ name: p.name, runs: p.runs, games: p.games.size, last: p.last, achievements: Object.keys(this.achievementsOf(p.name)).length })).sort((a, b) => b.runs - a.runs),
      recent: this.runs.slice(-RECENT).reverse(),
    };
  }
}
