// Kart Race 3D: the same race as Kart Race (see kart-race.js), shown on the TV as a split-screen
// 3D race with a chase camera behind each kart. A subclass so it has its own id, setup memory and
// records, and room to grow (tracks with height later).

import { KartRace } from './kart-race.js';

export class KartRace3D extends KartRace {}

export default {
  id: 'kart-race-3d',
  name: 'Kart Race 3D',
  tagline: 'Kart Race in 3D: split-screen, a chase camera behind each kart. Same racers, tracks, items and battles. Best on a PC or Steam Deck.',
  create: (ctx) => new KartRace3D(ctx),
};
