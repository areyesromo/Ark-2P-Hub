import fs from 'node:fs';
import path from 'node:path';
import { nameKey } from './stats.js';

export const LEVELS = ['easy', 'normal', 'hard'];
/** A lookup keyed by names or ids: no inherited keys (a player called "constructor" is just a name). */
const table = () => Object.create(null);

/**
 * Practice against the computer: each player's record per game and level, kept in practice.json
 * in the data folder. Games against the computer stay out of the match history and the
 * leaderboard (stats.js); this is just your own progress, shown on the game cards.
 *
 *   nameKey -> { name, games: { gameId -> { easy | normal | hard -> { played, wins, draws, bestStars, maxStars } } } }
 * (wins/draws for head-to-head games; bestStars of maxStars for the co-op ones, with the computer
 * as your teammate)
 */
export class Practice {
  constructor(dataDir) {
    this.file = dataDir ? path.join(dataDir, 'practice.json') : null;
    this.players = this.load();
  }

  load() {
    const out = table();
    if (!this.file) return out;
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      for (const [k, p] of Object.entries((data && data.players) || {})) {
        if (!p || typeof p !== 'object' || !p.games || typeof p.games !== 'object') continue;
        const games = table();
        for (const [g, levels] of Object.entries(p.games)) {
          if (!levels || typeof levels !== 'object') continue;
          games[g] = table();
          for (const lv of LEVELS) if (levels[lv] && typeof levels[lv] === 'object') games[g][lv] = levels[lv];
        }
        out[k] = { name: String(p.name || k), games };
      }
    } catch {
      // (unreadable: start afresh, as stats.json does)
    }
    return out;
  }

  save() {
    if (!this.file) return;
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      const tmp = `${this.file}.tmp`;
      fs.writeFileSync(tmp, JSON.stringify({ players: this.players }));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('Could not save practice records:', err.message);
    }
  }

  /** One game against the computer: { name, game, level, result: 'win' | 'loss' | 'draw' } or { ..., stars, maxStars }. */
  record({ name, game, level, result, stars, maxStars }) {
    const k = nameKey(name);
    if (!k || !LEVELS.includes(level) || typeof game !== 'string') return;
    const p = (this.players[k] = this.players[k] || { name, games: table() });
    p.name = name; // latest spelling wins
    const g = (p.games[game] = p.games[game] || table());
    const r = (g[level] = g[level] || { played: 0, wins: 0, draws: 0 });
    r.played++;
    if (result === 'win') r.wins++;
    if (result === 'draw') r.draws++;
    if (Number.isFinite(stars)) {
      r.bestStars = Math.max(r.bestStars || 0, stars);
      if (Number.isFinite(maxStars)) r.maxStars = maxStars;
    }
    this.save();
  }

  /** A player's records: gameId -> level -> record (empty if none). */
  recordsFor(name) {
    const p = this.players[nameKey(name)];
    return p ? p.games : table();
  }

  reset() {
    this.players = table();
    this.save();
  }
}
