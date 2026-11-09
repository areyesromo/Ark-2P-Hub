// Kart Race 3D: the same race as Kart Race (see kart-race.js), shown on the TV as a split-screen
// 3D race with a chase camera behind each kart. A subclass so it has its own id, setup memory and
// records, and room to grow (tracks with height later).

import { KartRace, OPTIONS } from './kart-race.js';
import { TRACKS_3D } from './kart-tracks-3d.js';

// The Track row: Mixed, then each big track.
const OPTIONS_3D = { ...OPTIONS, track: TRACKS_3D.map((_, i) => i).concat(TRACKS_3D.length) };

export class KartRace3D extends KartRace {
  /** The big tracks (see kart-tracks-3d.js); Kart Race keeps its own. */
  get tracks() {
    return TRACKS_3D;
  }

  get options() {
    return OPTIONS_3D;
  }
}

export default {
  id: 'kart-race-3d',
  motion: true, // phones can tilt or move to play (with buttons or a joystick as well)
  name: 'Kart Race 3D',
  tagline: 'Kart Race in 3D: split-screen, a chase camera behind each kart, on five big tracks built for 3D. Same racers, items and battles. Best on a PC or Steam Deck.',
  create: (ctx) => new KartRace3D(ctx),
};
