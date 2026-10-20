// Kart Race items: what's in the ? boxes, who gets what, and what each one does. The race
// (kart-race.js) calls in here: rollItem when a kart drives through a box, useItem when a
// player presses ITEM, and effects(k, now) every tick for how a kart's active power-ups change
// its driving. Names and emoji for the screens are in public/games/kart-race/items.js.

/**
 * Rows of ? boxes at these points of every lap, three across the road; the middle one of each
 * row is a gold double box (two items). A kart holds up to `maxHeld` items and uses the oldest
 * first. The timers and amounts for each item follow.
 */
export const ITEMS = {
  rows: [0.3, 0.8], // where along the lap
  offsets: [-1.05, 0, 1.05], // three boxes across the road (the middle one: a double box)
  boxR: 0.55,
  respawnMs: 4000,
  maxHeld: 3,
  kinds: ['banana', 'turbo', 'shield', 'goldturbo', 'star', 'coinbag', 'magnet', 'hover', 'thunder', 'freeze', 'swap'],
  turboMs: 1600,
  shieldMs: 5000, // blocks one hit in this time, then pops
  spinMs: 1200, // hit a banana (or a Star): spin out
  bananaR: 0.45,
  maxBananas: 6,
  goldMs: 5000, // Gold Turbo: every ITEM press in this time boosts
  starMs: 6000,
  starSpeed: 1.5,
  coinBag: 5,
  magnetMs: 5000,
  magnetR: 3, // coins and boxes this close are pulled in
  slipR: 6, // ...and the rival ahead this close gives a slipstream
  slipSpeed: 0.8,
  hoverMs: 4000,
  thunderMs: 4000,
  thunderSpeed: 1.5,
  thunderWeight: 0.25, // one Weight step
  freezeMs: 3000,
  freezeTurn: 0.6,
};

/**
 * How likely each item is, by place: the leader mostly gets defensive ones, the kart behind
 * the catch-up ones (Star, Gold Turbo, Thunder, Freeze, Swap, Hover are never the leader's).
 */
export const ODDS = {
  first: { banana: 5, turbo: 3, shield: 3, coinbag: 3, magnet: 1 },
  second: { banana: 1, turbo: 3, shield: 1, coinbag: 1, magnet: 2, hover: 2, freeze: 2, swap: 2, thunder: 1, goldturbo: 2, star: 1 },
};

/** A random item for the kart in this slot, by its place. */
export function rollItem(game, slot) {
  const odds = game.positions()[slot] === 1 ? ODDS.first : ODDS.second;
  const kinds = Object.keys(odds);
  let r = game.rng() * kinds.reduce((sum, k) => sum + odds[k], 0);
  for (const kind of kinds) {
    if ((r -= odds[kind]) < 0) return kind;
  }
  return kinds[kinds.length - 1];
}

/** How a kart's active power-ups change its driving right now. */
export function effects(k, now) {
  const star = now < k.starUntil;
  const shrunk = now < k.shrinkUntil;
  return {
    star,
    hover: now < k.hoverUntil,
    // Bananas (and later hazards) can't touch a Star; a hovering kart floats over them.
    immune: star,
    floating: now < k.hoverUntil,
    noGrass: star || now < k.hoverUntil,
    topBonus: (star ? ITEMS.starSpeed : 0) - (shrunk ? ITEMS.thunderSpeed : 0),
    turnScale: now < k.freezeUntil ? ITEMS.freezeTurn : 1,
    weightBonus: shrunk ? -ITEMS.thunderWeight : 0,
  };
}

/** A boost, like a turbo. */
function boost(game, k, now) {
  k.boostUntil = now + ITEMS.turboMs;
  k.speed = Math.max(k.speed, k.car.boostSpeed + game.coinBonus(k));
}

/** Something aimed at the rival (Thunder, Freeze): a shield takes it instead. */
function zap(game, rival, now) {
  if (now < rival.shieldUntil) {
    rival.shieldUntil = 0;
    game.events.blocked++;
    return false;
  }
  game.events.zapped++;
  return true;
}

/** The player in this slot pressed ITEM. */
export function useItem(game, slot, now) {
  const k = game.karts[slot];
  const rival = game.karts[1 - slot];
  if (game.phase !== 'race' || k.finishedAt !== null || now < k.spinUntil) return;
  // Gold Turbo: every press boosts while it lasts, and the rest of the queue waits.
  if (now < k.goldUntil) {
    boost(game, k, now);
    game.events.used++;
    return;
  }
  const kind = k.items.shift();
  if (!kind) return;
  game.events.used++;
  if (kind === 'turbo') boost(game, k, now);
  else if (kind === 'shield') k.shieldUntil = now + ITEMS.shieldMs;
  else if (kind === 'banana') {
    // Dropped just behind the kart.
    const back = game.kartR + ITEMS.bananaR + 0.15;
    game.bananas.push({ x: k.x - Math.cos(k.angle) * back, y: k.y - Math.sin(k.angle) * back, owner: slot, safeUntil: now + 700 });
    if (game.bananas.length > ITEMS.maxBananas) game.bananas.shift();
  } else if (kind === 'goldturbo') {
    k.goldUntil = now + ITEMS.goldMs;
    boost(game, k, now);
  } else if (kind === 'star') k.starUntil = now + ITEMS.starMs;
  else if (kind === 'coinbag') game.addCoins(k, ITEMS.coinBag);
  else if (kind === 'magnet') k.magnetUntil = now + ITEMS.magnetMs;
  else if (kind === 'hover') k.hoverUntil = now + ITEMS.hoverMs;
  else if (kind === 'thunder') {
    if (zap(game, rival, now)) rival.shrinkUntil = now + ITEMS.thunderMs;
  } else if (kind === 'freeze') {
    if (zap(game, rival, now)) rival.freezeUntil = now + ITEMS.freezeMs;
  } else if (kind === 'swap') {
    [k.items, rival.items] = [rival.items, k.items];
    game.events.swapped++;
  }
}
