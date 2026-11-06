import fs from 'node:fs';
import path from 'node:path';
import { nameKey } from './stats.js';

export const LEVELS = ['easy', 'normal', 'hard'];

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
      console.error('Could not save practice records:', err.message);
    }
  }

  /** One game against the computer: { name, game, level, result: 'win' | 'loss' | 'draw' } or { ..., stars, maxStars }. */
  record({ name, game, level, result, stars, maxStars }) {
    const k = nameKey(name);
    if (!k || !LEVELS.includes(level) || typeof game !== 'string') return;
    const p = (this.players[k] = this.players[k] || { name, games: {} });
    p.name = name; // latest spelling wins
    const g = (p.games[game] = p.games[game] || {});
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
    return p ? p.games : {};
  }

  reset() {
    this.players = {};
    this.save();
  }
}
