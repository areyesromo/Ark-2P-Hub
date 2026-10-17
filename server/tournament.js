// Tournament: a "best of N games" series across the hub's games, kept by the
// room for as long as the same two players are seated. Every competitive
// match that ends (rematches included) counts; a draw is listed but scores
// nothing, and casual games don't count. First to a majority of N wins it.
// Off by default; the players turn it on (and pick N) in the lobby.

export const TOURNAMENT_LENGTHS = [0, 3, 5, 7]; // best of N games; 0 is off
const HISTORY = 12; // games listed in the lobby

export class Tournament {
  constructor() {
    this.bestOf = 0;
    this.reset();
  }

  get on() {
    return this.bestOf > 0;
  }

  /** Wins needed to take the tournament. */
  get target() {
    return this.on ? Math.floor(this.bestOf / 2) + 1 : 0;
  }

  /** A fresh series: no wins, no games, no champion. Keeps the length. */
  reset() {
    this.wins = [0, 0];
    this.games = [];
    this.champion = null;
  }

  /** Change the length (keeping the score, so a series can be extended). Returns false for a bad value. */
  setLength(n) {
    if (!TOURNAMENT_LENGTHS.includes(n)) return false;
    this.bestOf = n;
    if (!this.on) this.reset();
    this.champion = this.leader();
    return true;
  }

  leader() {
    const t = this.target;
    if (!t) return null;
    if (this.wins[0] >= t && this.wins[0] > this.wins[1]) return 0;
    if (this.wins[1] >= t && this.wins[1] > this.wins[0]) return 1;
    return null;
  }

  /**
   * A competitive match ended: `winner` is a slot, or null for a draw.
   * After a tournament is won, the next match starts a new one.
   * Returns true when the tournament changed.
   */
  record({ game, winner }) {
    if (!this.on) return false;
    if (this.champion !== null) this.reset();
    const w = winner === 0 || winner === 1 ? winner : null;
    if (w !== null) this.wins[w]++;
    this.games.push({ game: String(game || ''), winner: w });
    if (this.games.length > HISTORY) this.games.shift();
    this.champion = this.leader();
    return true;
  }

  view() {
    return {
      bestOf: this.bestOf,
      target: this.target,
      wins: this.wins.slice(),
      games: this.games.map((g) => ({ ...g })),
      champion: this.champion,
      lengths: TOURNAMENT_LENGTHS,
    };
  }
}
