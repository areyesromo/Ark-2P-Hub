// Kart Race 3D: the same race as Kart Race (see kart-race.js), shown on the TV as a split-screen
// 3D race with a chase camera behind each kart. A subclass so it has its own id, setup memory and
// records, and room to grow (tracks with height later).

import { KartRace, OPTIONS, CPU } from './kart-race.js';
import { TRACKS_3D } from './kart-tracks-3d.js';

const Racers = globalThis.ArkKartRacers;

// The Track row: Mixed, then each big track. And the 8-kart Cup: the Field (1v1 or the Cup) and how
// well the computer racers drive.
// Laps: 3 by default (a big track's lap is about a minute), 5 and 8 still there.
const OPTIONS_3D = { ...OPTIONS, track: TRACKS_3D.map((_, i) => i).concat(TRACKS_3D.length), field: [0, 1], cpu: ['normal', 'easy', 'hard'], laps: [3, 5, 8] };

/**
 * The 8-kart Cup: the two players and six computer racers (racers neither picked), five races on
 * the five big tracks. Every place scores (1st to 8th); the player with more points after five wins
 * (level: the better place in the last race). Race 1's grid has the computers in front; after that
 * it's by points, fewest at the front, so the leader starts at the back.
 */
export const CUP_POINTS = [10, 8, 6, 5, 4, 3, 2, 1];
const CUP_RACES = 5;

export class KartRace3D extends KartRace {
  /** The big tracks (see kart-tracks-3d.js); Kart Race keeps its own. */
  get tracks() {
    return TRACKS_3D;
  }

  get options() {
    return OPTIONS_3D;
  }

  get cup8() {
    return this.settings.field === 1;
  }

  onBegin() {
    if (!this.cup8) return;
    this.points = CUP_POINTS.map(() => 0);
    // Six racers neither player picked, in a shuffled order, each with its own style (CPU.sway).
    const free = Racers.RACERS.map((r) => r.id).filter((id) => id !== this.picks[0].racer && id !== this.picks[1].racer);
    for (let i = free.length - 1; i > 0; i--) {
      const j = Math.floor(this.rng() * (i + 1));
      [free[i], free[j]] = [free[j], free[i]];
    }
    this.cpuRacers = free.slice(0, 6).map((racer) => ({ racer, sway: (this.rng() * 2 - 1) * CPU.sway }));
  }

  entrants() {
    if (!this.cup8) return super.entrants();
    return this.picks.concat(this.cpuRacers.map((c) => ({ racer: c.racer, tyre: Racers.DEFAULT_TYRE, cpu: { level: this.settings.cpu, sway: c.sway } })));
  }

  gridOrder(n) {
    if (!this.cup8 || n !== CUP_POINTS.length) return super.gridOrder(n);
    if (this.race === 1) return [2, 3, 4, 5, 6, 7, 0, 1];
    return this.points.map((p, i) => i).sort((a, b) => this.points[a] - this.points[b] || a - b);
  }

  onRaceEnd() {
    if (!this.cup8) return;
    const places = this.positions();
    places.forEach((rank, i) => { this.points[i] += CUP_POINTS[rank - 1]; });
    this.scores = [this.points[0], this.points[1]];
    Object.assign(this.history[this.history.length - 1], { places, points: this.points.slice() });
  }

  seriesOver() {
    return this.cup8 ? this.race >= CUP_RACES : super.seriesOver();
  }

  matchWinner() {
    if (!this.cup8) return super.matchWinner();
    if (this.points[0] !== this.points[1]) return this.points[0] > this.points[1] ? 0 : 1;
    const last = this.history[this.history.length - 1].places;
    return last[0] < last[1] ? 0 : 1;
  }
}

export default {
  id: 'kart-race-3d',
  motion: true, // phones can tilt or move to play (with buttons or a joystick as well)
  name: 'Kart Race 3D',
  tagline: 'Kart Race in 3D: split-screen, a chase camera behind each kart, on five big tracks built for 3D. Same racers, items and battles. Best on a PC or Steam Deck.',
  create: (ctx) => new KartRace3D(ctx),
};
