import fs from 'node:fs';
import path from 'node:path';

export const MAX_MATCHES = 2000; // oldest are dropped beyond this
export const MAX_TOURNAMENTS = 500;
const RECENT = 30;

/** Players are matched by name, ignoring case and surrounding spaces. */
export const nameKey = (name) => String(name || '').trim().toLowerCase();

/**
 * Match history and the leaderboard built from it, kept in stats.json in the
 * data folder (a Docker volume, so it survives updates).
 *
 * A match record:
 *   { at, game, gameName, category, players: [name0, name1],
 *     winner: 0 | 1 | null, draw, scores: [a, b] | null,   // competitive
 *     cup: true,                                            // a Kart Race cup (won by winner)
 *     laps: [{ track, player: 0 | 1, ms }],                 // Kart Race best laps
 *     reactions: [{ player: 0 | 1, ms }],                   // Kart Race starts
 *     stars, maxStars }                                     // casual (team) games
 *
 * A won tournament (best of N games, see tournament.js):
 *   { at, players: [name0, name1], winner: 0 | 1, wins: [a, b], bestOf }
 */
export class Stats {
  constructor(dataDir) {
    this.file = dataDir ? path.join(dataDir, 'stats.json') : null;
    const data = this.load();
    this.matches = Array.isArray(data.matches) ? data.matches : [];
    this.tournaments = Array.isArray(data.tournaments) ? data.tournaments : [];
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
      fs.writeFileSync(tmp, JSON.stringify({ matches: this.matches, tournaments: this.tournaments }));
      fs.renameSync(tmp, this.file);
    } catch (err) {
      console.error('Could not save match history:', err.message);
    }
  }

  record(match) {
    this.matches.push({ at: Date.now(), ...match });
    if (this.matches.length > MAX_MATCHES) this.matches.splice(0, this.matches.length - MAX_MATCHES);
    this.save();
  }

  recordTournament(t) {
    this.tournaments.push({ at: Date.now(), ...t });
    if (this.tournaments.length > MAX_TOURNAMENTS) this.tournaments.splice(0, this.tournaments.length - MAX_TOURNAMENTS);
    this.save();
  }

  reset() {
    this.matches = [];
    this.tournaments = [];
    this.save();
  }

  /** The record between two players, from a's point of view (index 0 = a). */
  headToHead(a, b) {
    const ka = nameKey(a);
    const kb = nameKey(b);
    const out = { played: 0, wins: [0, 0], draws: 0, byGame: [], recent: [], team: { played: 0, stars: 0, maxStars: 0 }, titles: [0, 0], cups: [0, 0] };
    if (!ka || !kb || ka === kb) return out;
    for (const t of this.tournaments) {
      const keys = t.players.map(nameKey);
      const flip = keys[0] === kb && keys[1] === ka;
      if (flip || (keys[0] === ka && keys[1] === kb)) out.titles[flip ? 1 - t.winner : t.winner]++;
    }
    const games = new Map();
    for (const m of this.matches) {
      const keys = m.players.map(nameKey);
      const flip = keys[0] === kb && keys[1] === ka;
      if (!flip && !(keys[0] === ka && keys[1] === kb)) continue;
      if (m.category === 'casual') {
        out.team.played++;
        out.team.stars += m.stars || 0;
        out.team.maxStars += m.maxStars || 0;
        continue;
      }
      const winner = m.winner === null || m.winner === undefined ? null : flip ? 1 - m.winner : m.winner;
      const scores = m.scores ? (flip ? [m.scores[1], m.scores[0]] : m.scores.slice()) : null;
      out.played++;
      if (winner === null) out.draws++;
      else out.wins[winner]++;
      if (m.cup && winner !== null) out.cups[winner]++;
      if (!games.has(m.game)) games.set(m.game, { game: m.game, name: m.gameName, played: 0, wins: [0, 0], draws: 0 });
      const g = games.get(m.game);
      g.played++;
      if (winner === null) g.draws++;
      else g.wins[winner]++;
      out.recent.push({ at: m.at, game: m.game, name: m.gameName, winner, scores });
    }
    out.byGame = [...games.values()].sort((x, y) => y.played - x.played);
    out.recent = out.recent.slice(-5).reverse();
    return out;
  }

  /** gameId -> when it was last finished. */
  lastPlayed() {
    const out = {};
    for (const m of this.matches) out[m.game] = Math.max(out[m.game] || 0, m.at || 0);
    return out;
  }

  /** Names seen in the history, most recent first (for controller players to pick from). */
  knownNames(limit = 12) {
    const seen = new Map();
    for (let i = this.matches.length - 1; i >= 0 && seen.size < limit; i--) {
      for (const name of this.matches[i].players) {
        if (!seen.has(nameKey(name)) && seen.size < limit) seen.set(nameKey(name), name);
      }
    }
    return [...seen.values()];
  }

  /** The fastest lap ever on each track (Kart Race), by track name. */
  lapRecords() {
    const best = new Map();
    for (const m of this.matches) {
      for (const l of m.laps || []) {
        const key = m.game + '\u0000' + l.track;
        const cur = best.get(key);
        if (!cur || l.ms < cur.ms) best.set(key, { game: m.game, track: l.track, name: m.players[l.player], ms: l.ms, at: m.at });
      }
    }
    return [...best.values()].sort((a, b) => a.track.localeCompare(b.track));
  }

  /** One track's record in one game: { name, ms }, or null. */
  lapRecord(game, track) {
    const r = this.lapRecords().find((x) => x.game === game && x.track === track);
    return r ? { name: r.name, ms: r.ms } : null;
  }

  /** Each player's fastest start (Kart Race reaction time), fastest first. */
  bestStarts() {
    const best = new Map();
    for (const m of this.matches) {
      for (const r of m.reactions || []) {
        const name = m.players[r.player];
        const k = nameKey(name);
        const cur = best.get(k);
        if (!cur || r.ms < cur.ms) best.set(k, { name, ms: r.ms, at: m.at });
      }
    }
    return [...best.values()].sort((a, b) => a.ms - b.ms).slice(0, 10);
  }

  /** Everything the leaderboard page shows. */
  leaderboard() {
    const players = new Map();
    const games = new Map();
    const pairs = new Map();
    const player = (name) => {
      const k = nameKey(name);
      if (!players.has(k)) players.set(k, { name, played: 0, wins: 0, losses: 0, draws: 0, teamGames: 0, stars: 0, titles: 0, cups: 0 });
      const p = players.get(k);
      p.name = name; // latest spelling wins
      return p;
    };
    for (const m of this.matches) {
      const ps = m.players.map(player);
      if (m.category === 'casual') {
        ps.forEach((p) => {
          p.teamGames++;
          p.stars += m.stars || 0;
        });
      } else {
        ps.forEach((p, i) => {
          p.played++;
          if (m.winner === null || m.winner === undefined) p.draws++;
          else if (m.winner === i) {
            p.wins++;
            if (m.cup) p.cups++;
          } else p.losses++;
        });
      }
      if (!games.has(m.game)) games.set(m.game, { game: m.game, name: m.gameName, category: m.category, played: 0, wins: new Map(), bestStars: 0 });
      const g = games.get(m.game);
      g.name = m.gameName;
      g.played++;
      if (m.category === 'casual') g.bestStars = Math.max(g.bestStars, m.stars || 0);
      else if (m.winner === 0 || m.winner === 1) {
        const k = nameKey(m.players[m.winner]);
        g.wins.set(k, (g.wins.get(k) || 0) + 1);
      }
      const pairKey = m.players.map(nameKey).sort().join('\u0000');
      if (!pairs.has(pairKey) && m.category !== 'casual' && nameKey(m.players[0]) !== nameKey(m.players[1])) {
        const [a, b] = m.players.map(nameKey).sort();
        pairs.set(pairKey, { a, b });
      }
    }
    for (const t of this.tournaments) player(t.players[t.winner]).titles++;
    const nameOf = (k) => (players.get(k) || { name: k }).name;
    return {
      players: [...players.values()]
        .map((p) => ({ ...p, winPct: p.played ? Math.round((100 * p.wins) / p.played) : 0 }))
        .sort((x, y) => y.wins - x.wins || y.winPct - x.winPct || y.played - x.played),
      games: [...games.values()]
        .map((g) => {
          const top = [...g.wins.entries()].sort((x, y) => y[1] - x[1])[0];
          return { game: g.game, name: g.name, category: g.category, played: g.played, champion: top ? { name: nameOf(top[0]), wins: top[1] } : null, bestStars: g.bestStars };
        })
        .sort((x, y) => y.played - x.played),
      rivalries: [...pairs.values()]
        .map(({ a, b }) => {
          const h = this.headToHead(nameOf(a), nameOf(b));
          return { names: [nameOf(a), nameOf(b)], played: h.played, wins: h.wins, draws: h.draws };
        })
        .filter((r) => r.played)
        .sort((x, y) => y.played - x.played),
      recent: this.matches.slice(-RECENT).reverse(),
      tournaments: this.tournaments.slice(-10).reverse(),
      lapRecords: this.lapRecords(),
      bestStarts: this.bestStarts(),
      // The latest Kart Race cups, newest first.
      cups: this.matches
        .filter((m) => m.cup && (m.winner === 0 || m.winner === 1))
        .slice(-10)
        .reverse()
        .map((m) => ({ at: m.at, players: m.players, winner: m.winner, scores: m.scores })),
      total: this.matches.length,
    };
  }
}
