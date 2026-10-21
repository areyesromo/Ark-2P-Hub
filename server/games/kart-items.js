// Kart Race items: what's in the ? boxes, who gets what, and what each one does. The race
// (kart-race.js) calls in here: rollItem when a kart drives through a box, useItem when a
// player presses ITEM, and effects(k, now) every tick for how a kart's active power-ups change
// its driving; and, for the things on the track (webs, oil, Bouncers, Seekers, Bombs),
// stepShots each tick and hazardCheck per kart. Names and emoji for the screens are in
// public/games/kart-race/items.js.

const Road = globalThis.ArkKartTrack; // (loaded by kart-race.js)

/**
 * Rows of ? boxes at these points of every lap, three across the road; the middle one of each
 * row is a gold double box (two items). A kart holds up to `maxHeld` items and uses the oldest
 * first. The timers and amounts for each item follow.
 */
export const ITEMS = {
  rows: [0.3, 0.8], // where along the lap
  offsets: [-1.2, 0, 1.2], // three boxes across the road (the middle one: a double box)
  boxR: 0.55,
  respawnMs: 4000,
  maxHeld: 3,
  kinds: ['banana', 'turbo', 'shield', 'goldturbo', 'star', 'coinbag', 'magnet', 'hover', 'thunder', 'freeze', 'swap', 'web', 'oil', 'bouncer', 'seeker', 'bomb'],
  turboMs: 1600,
  shieldMs: 5000, // blocks one hit in this time, then pops
  spinMs: 1200, // hit a banana (or a Star): spin out
  graceMs: 600, // after a shield pops, a moment before anything can hit you
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
  // Dropped on the road (6 of each at most): a Web holds you to half speed, Oil takes your
  // steering and brakes.
  hazardR: 0.5,
  maxHazards: 6,
  webMs: 1500,
  webSlow: 0.5,
  oilMs: 1000,
  // Fired: a Bouncer goes straight and bounces off the barriers; a Seeker follows the road to
  // the rival; a Bomb lands ahead and goes off.
  shotR: 0.3,
  bouncerSpeed: 12,
  bouncerMs: 4000,
  bouncerSafeMs: 500, // before it can hit its own thrower
  seekerSpeed: 13,
  seekerMs: 6000,
  seekerHome: 4, // this close to the rival it heads straight for them
  seekerAhead: 0.03, // otherwise it follows the road this far ahead (fraction of a lap)
  bombThrow: 5,
  bombFuseMs: 1500,
  bombR: 2,
};

/**
 * How likely each item is, by place: the leader mostly gets defensive ones, the kart behind
 * the catch-up ones (Star, Gold Turbo, Thunder, Freeze, Swap, Hover are never the leader's).
 */
export const ODDS = {
  first: { banana: 5, turbo: 3, shield: 3, coinbag: 3, magnet: 1, web: 3, oil: 3, bouncer: 4, bomb: 1 },
  second: { banana: 1, turbo: 3, shield: 1, coinbag: 1, magnet: 2, hover: 2, freeze: 2, swap: 2, thunder: 1, goldturbo: 2, star: 1, web: 1, oil: 1, bouncer: 2, bomb: 2, seeker: 3 },
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

/** A boost, like a turbo (`whoosh`: counted with the boost pads, for its sound). */
function boost(game, k, now, whoosh) {
  k.boostUntil = now + ITEMS.turboMs;
  k.speed = Math.max(k.speed, k.car.boostSpeed + game.coinBonus(k));
  if (whoosh) game.events.boosts++;
}

/**
 * Something aimed at the rival (Thunder, Freeze): it misses a Star or a kart that has finished,
 * and a shield takes it instead (and pops).
 */
function zap(game, rival, now) {
  if (rival.finishedAt !== null || effects(rival, now).immune) return false;
  if (now < rival.shieldUntil) {
    rival.shieldUntil = 0;
    game.events.blocked++;
    return false;
  }
  return true;
}

/** The player in this slot pressed ITEM. */
export function useItem(game, slot, now) {
  const k = game.karts[slot];
  const rival = game.karts[1 - slot];
  if (game.phase !== 'race' || k.finishedAt !== null || now < k.spinUntil) return;
  // Gold Turbo: every press boosts while it lasts, and the rest of the queue waits.
  if (now < k.goldUntil) {
    boost(game, k, now, true);
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
    const back = game.kartHalf + ITEMS.bananaR + 0.15;
    game.bananas.push({ x: k.x - Math.cos(k.angle) * back, y: k.y - Math.sin(k.angle) * back, owner: slot, safeUntil: now + 700 });
    if (game.bananas.length > ITEMS.maxBananas) game.bananas.shift();
  } else if (kind === 'goldturbo') {
    k.goldUntil = now + ITEMS.goldMs;
    boost(game, k, now, true);
  } else if (kind === 'star') k.starUntil = now + ITEMS.starMs;
  else if (kind === 'coinbag') game.addCoins(k, ITEMS.coinBag);
  else if (kind === 'magnet') k.magnetUntil = now + ITEMS.magnetMs;
  else if (kind === 'hover') k.hoverUntil = now + ITEMS.hoverMs;
  else if (kind === 'thunder') {
    if (zap(game, rival, now)) {
      rival.shrinkUntil = now + ITEMS.thunderMs;
      game.events.zapped++;
    }
  } else if (kind === 'freeze') {
    if (zap(game, rival, now)) {
      rival.freezeUntil = now + ITEMS.freezeMs;
      game.events.frozen++;
    }
  } else if (kind === 'swap' && rival.finishedAt === null) {
    [k.items, rival.items] = [rival.items, k.items];
    game.events.swapped++;
  } else if (kind === 'web' || kind === 'oil') {
    drop(game, kind === 'web' ? game.webs : game.oils, k, slot, now);
  } else if (kind === 'bouncer' || kind === 'seeker') {
    const ahead = game.kartHalf + ITEMS.shotR + 0.1;
    const life = kind === 'bouncer' ? ITEMS.bouncerMs : ITEMS.seekerMs;
    // Always faster than the kart that fired it (a boosting kart would run into its own Bouncer).
    const speed = Math.max(kind === 'bouncer' ? ITEMS.bouncerSpeed : ITEMS.seekerSpeed, Math.max(0, k.speed) + 3);
    game.shots.push({ kind, x: k.x + Math.cos(k.angle) * ahead, y: k.y + Math.sin(k.angle) * ahead, angle: k.angle, speed, owner: slot, bornAt: now, until: now + life, seg: k.seg });
    game.events.fired++;
  } else if (kind === 'bomb') {
    // Lobbed ahead along your own road (the way you're facing along it), landing on the tarmac.
    const here = Road.pointAt(game.track, k.progress);
    const forward = Math.cos(k.angle - here.angle) >= 0 ? 1 : -1;
    const at = Road.pointAt(game.track, k.progress + (forward * ITEMS.bombThrow) / game.track.length);
    game.shots.push({ kind, x: at.x, y: at.y, angle: 0, owner: slot, bornAt: now, until: now + ITEMS.bombFuseMs });
  }
}

/** Drop a web or oil just behind the kart (it can't hit you straight away). */
function drop(game, list, k, slot, now) {
  const back = game.kartHalf + ITEMS.hazardR + 0.15;
  list.push({ x: k.x - Math.cos(k.angle) * back, y: k.y - Math.sin(k.angle) * back, owner: slot, safeUntil: now + 700 });
  if (list.length > ITEMS.maxHazards) list.shift();
}

/**
 * Something that doesn't spin you (a web, oil) caught the kart: no if it has a Star, has just
 * been saved by a shield, or has a shield now (which pops). True if it takes effect.
 */
function snag(game, k, now) {
  if (effects(k, now).immune || now < (k.graceUntil || 0)) return false;
  if (now < k.shieldUntil) {
    k.shieldUntil = 0;
    k.graceUntil = now + ITEMS.graceMs;
    game.events.blocked++;
    return false;
  }
  return true;
}

/** A kart driving into webs and oil (hovering karts float over; a Star clears them away). */
export function hazardCheck(game, k, slot, now) {
  if (k.finishedAt !== null || effects(k, now).floating) return;
  for (const [list, kind] of [[game.webs, 'web'], [game.oils, 'oil']]) {
    for (const h of list.slice()) {
      if (game.gap(k, h.x, h.y) > ITEMS.hazardR) continue;
      if (h.owner === slot && now < h.safeUntil) continue;
      list.splice(list.indexOf(h), 1);
      if (!snag(game, k, now)) continue;
      if (kind === 'web') {
        k.webUntil = now + ITEMS.webMs;
        k.speed = Math.min(k.speed, k.car.maxSpeed * ITEMS.webSlow); // caught: straight down to half speed
      } else k.oilUntil = now + ITEMS.oilMs;
      game.events.snagged++;
    }
  }
}

/** Move the Bouncers and Seekers, set off the Bombs, and see what they hit. */
export function stepShots(game, dt, now) {
  const gone = new Set();
  for (const s of game.shots) {
    if (gone.has(s)) continue;
    if (s.kind === 'bomb') {
      if (now < s.until) continue;
      gone.add(s);
      game.events.exploded++;
      game.blasts.push({ x: s.x, y: s.y, at: now });
      game.karts.forEach((k) => {
        // (A hovering kart floats over the blast.)
        if (k.finishedAt === null && !effects(k, now).floating && game.gap(k, s.x, s.y) < ITEMS.bombR) game.hitKart(k, now);
      });
      continue;
    }
    if (now >= s.until) {
      gone.add(s);
      continue;
    }
    const speed = s.speed || (s.kind === 'bouncer' ? ITEMS.bouncerSpeed : ITEMS.seekerSpeed);
    if (s.kind === 'seeker') {
      // Follow the road; close to the rival, straight at them.
      const rival = game.karts[1 - s.owner];
      const w = Road.locateNear(game.track, s.x, s.y, s.seg, 8, game.roadHalf * 3);
      s.seg = w.i;
      // (Only a rival on the same stretch: not one just across a barrier.)
      const n = game.track.line.length;
      const apart = Math.abs(rival.seg - s.seg);
      const sameStretch = Math.min(apart, n - apart) < 20;
      const target = rival.finishedAt === null && sameStretch && Math.hypot(rival.x - s.x, rival.y - s.y) < ITEMS.seekerHome ? rival : Road.pointAt(game.track, w.s + ITEMS.seekerAhead);
      s.angle = Math.atan2(target.y - s.y, target.x - s.x);
    }
    s.x += Math.cos(s.angle) * speed * dt;
    s.y += Math.sin(s.angle) * speed * dt;
    bounce(game, s);
    // A Seeker runs into a banana or web, or a Bouncer: both go.
    if (s.kind === 'seeker') {
      for (const list of [game.bananas, game.webs]) {
        const h = list.find((b) => Math.hypot(b.x - s.x, b.y - s.y) < ITEMS.hazardR + ITEMS.shotR);
        if (h) {
          list.splice(list.indexOf(h), 1);
          gone.add(s);
        }
      }
      const b = game.shots.find((o) => o.kind === 'bouncer' && !gone.has(o) && Math.hypot(o.x - s.x, o.y - s.y) < 2 * ITEMS.shotR);
      if (b) {
        gone.add(b);
        gone.add(s);
      }
      if (gone.has(s)) continue;
    }
    // Karts: a Seeker never hits its own thrower; a Bouncer can, once it's been flying a moment.
    game.karts.forEach((k, slot) => {
      if (gone.has(s) || k.finishedAt !== null) return;
      if (slot === s.owner && (s.kind === 'seeker' || now < s.bornAt + ITEMS.bouncerSafeMs)) return;
      if (game.gap(k, s.x, s.y) > ITEMS.shotR) return;
      gone.add(s);
      game.hitKart(k, now);
    });
  }
  game.shots = game.shots.filter((s) => !gone.has(s));
  game.blasts = game.blasts.filter((b) => now - b.at < 600);
}

/** Keep a shot inside the barriers (and the field): a Bouncer bounces off, a Seeker slides along. */
function bounce(game, s) {
  const w = Road.locateNear(game.track, s.x, s.y, s.seg === undefined ? 0 : s.seg, 8, game.roadHalf * 3);
  s.seg = w.i;
  const line = game.track.line;
  const a = line[w.i];
  const b = line[(w.i + 1) % line.length];
  const right = (b[0] - a[0]) * (s.y - a[1]) - (b[1] - a[1]) * (s.x - a[0]) > 0;
  const edge = game.track.edge[right ? 'right' : 'left'];
  const limit = Math.min(edge[w.i], edge[(w.i + 1) % line.length]) - ITEMS.shotR;
  const walls = [];
  if (w.d > limit) {
    const nx = (s.x - w.px) / w.d;
    const ny = (s.y - w.py) / w.d;
    s.x = w.px + nx * limit;
    s.y = w.py + ny * limit;
    walls.push([nx, ny]);
  }
  const f = game.field;
  const r = ITEMS.shotR;
  if (s.x < r) { s.x = r; walls.push([-1, 0]); }
  if (s.x > f.w - r) { s.x = f.w - r; walls.push([1, 0]); }
  if (s.y < r) { s.y = r; walls.push([0, -1]); }
  if (s.y > f.h - r) { s.y = f.h - r; walls.push([0, 1]); }
  if (s.kind !== 'bouncer') return;
  for (const [nx, ny] of walls) {
    let vx = Math.cos(s.angle);
    let vy = Math.sin(s.angle);
    const into = vx * nx + vy * ny;
    if (into <= 0) continue;
    vx -= 2 * into * nx;
    vy -= 2 * into * ny;
    s.angle = Math.atan2(vy, vx);
  }
}
