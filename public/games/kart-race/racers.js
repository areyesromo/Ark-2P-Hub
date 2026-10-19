// Kart Race racers and tyres, shared by the server (imported for its side effect), the screens
// (a plain <script>) and any future 3D module: who you can race as, which tyres you can fit, and
// how their stats turn into driving numbers. Sets globalThis.ArkKartRacers.
(function () {
  // Six types; each has a male and a female racer with the same stats (every type totals 12).
  const TYPES = {
    speed: { label: 'Speed', emoji: '🔥' },
    accel: { label: 'Acceleration', emoji: '⚡' },
    handling: { label: 'Handling', emoji: '🌀' },
    heavy: { label: 'Heavy', emoji: '🪨' },
    allround: { label: 'All-round', emoji: '⚖️' },
    tricky: { label: 'Tricky', emoji: '🦊' },
  };
  const KINDS = [
    // type, [m id, m name], [f id, f name], stats [speed, accel, handling, weight], kart shape, stripe
    ['speed', ['rex', 'Rex'], ['roxy', 'Roxy'], [5, 2, 2, 3], 'long', '#ef4444'],
    ['accel', ['zip', 'Zip'], ['zara', 'Zara'], [2, 5, 3, 2], 'stubby', '#facc15'],
    ['handling', ['swift', 'Swift'], ['sky', 'Sky'], [3, 3, 5, 1], 'wings', '#38bdf8'],
    ['heavy', ['boulder', 'Boulder'], ['bella', 'Bella'], [4, 1, 2, 5], 'boxy', '#a8a29e'],
    ['allround', ['dash', 'Dash'], ['daisy', 'Daisy'], [3, 3, 3, 3], 'classic', '#4ade80'],
    ['tricky', ['rascal', 'Rascal'], ['ruby', 'Ruby'], [2, 4, 5, 1], 'pointed', '#fb923c'],
  ];
  const RACERS = [];
  KINDS.forEach(function (k) {
    [[k[1], 'm'], [k[2], 'f']].forEach(function (who) {
      RACERS.push({
        id: who[0][0],
        name: who[0][1],
        type: k[0],
        gender: who[1],
        emoji: TYPES[k[0]].emoji,
        stats: { speed: k[3][0], accel: k[3][1], handling: k[3][2], weight: k[3][3] },
        shape: k[4],
        stripe: k[5],
      });
    });
  });

  // Tyres shift the racer's stats; `wheel` is how they're drawn (length and width, field units).
  const TYRES = [
    { id: 'standard', name: 'Standard', emoji: '⚫', mod: {}, wheel: { len: 0.24, wide: 0.14 } },
    { id: 'slicks', name: 'Slicks', emoji: '🏁', mod: { speed: 1, handling: -1 }, wheel: { len: 0.26, wide: 0.09 } },
    { id: 'grippy', name: 'Grippy', emoji: '🔩', mod: { handling: 1, speed: -1 }, wheel: { len: 0.26, wide: 0.19 } },
    { id: 'rollers', name: 'Rollers', emoji: '🔘', mod: { accel: 1, speed: -1 }, wheel: { len: 0.17, wide: 0.12 } },
    { id: 'monster', name: 'Monster', emoji: '🚜', mod: { weight: 1, accel: -1 }, grassHalf: true, wheel: { len: 0.34, wide: 0.22 } },
  ];

  const DEFAULT_RACERS = ['dash', 'daisy']; // by slot
  const DEFAULT_TYRE = 'standard';

  function racer(id) {
    return RACERS.filter(function (r) { return r.id === id; })[0] || RACERS.filter(function (r) { return r.id === 'dash'; })[0];
  }

  function tyre(id) {
    return TYRES.filter(function (t) { return t.id === id; })[0] || TYRES[0];
  }

  /** A racer's stats with a tyre fitted (each 0..6). */
  function stats(racerId, tyreId) {
    const s = racer(racerId).stats;
    const m = tyre(tyreId).mod;
    const out = {};
    ['speed', 'accel', 'handling', 'weight'].forEach(function (k) { out[k] = s[k] + (m[k] || 0); });
    return out;
  }

  /**
   * The driving numbers for a racer on a tyre. A 3 in every stat is the classic kart; each step
   * either side changes it by the same amount.
   */
  function physics(racerId, tyreId) {
    const s = stats(racerId, tyreId);
    const maxSpeed = 8.5 + (s.speed - 3) * 0.45;
    let grassSpeed = 3.2 + (s.weight - 3) * 0.15;
    if (tyre(tyreId).grassHalf) grassSpeed = maxSpeed - (maxSpeed - grassSpeed) / 2;
    return {
      maxSpeed: maxSpeed,
      boostSpeed: maxSpeed + 4,
      accel: 9 + (s.accel - 3) * 1.25,
      turnRate: 2.8 + (s.handling - 3) * 0.15,
      grip: 1.2 - (s.handling - 3) * 0.1, // lower: full steering at a lower speed
      weight: 1 + (s.weight - 3) * 0.25,
      grassSpeed: grassSpeed,
    };
  }

  globalThis.ArkKartRacers = { TYPES: TYPES, RACERS: RACERS, TYRES: TYRES, DEFAULT_RACERS: DEFAULT_RACERS, DEFAULT_TYRE: DEFAULT_TYRE, racer: racer, tyre: tyre, stats: stats, physics: physics };
})();
