/**
 * The computer opponent for Battleship, Classic and Ultimate. It plays from its own player view,
 * the same thing a phone sees, so it can't peek at your fleet: battleshipBot(view, level, rng)
 * gives its next input, or null when it's not its move. The room calls it (see Room#driveBot).
 *
 *   easy:   fires about at random, and only sometimes follows up a hit.
 *   normal: hunts around its hits, follows a line of them, and uses its skills and special.
 *   hard:   works out where the ships left could still be and aims at the likeliest squares.
 */
import { FLEET, SIZE, shipCells } from './battleship.js';
import { COMMANDERS, COMMANDER_IDS, SKILLS, footprint, shapeCells } from './battleship-ultimate.js';

export const BOT_LEVELS = ['easy', 'normal', 'hard'];

const EMPTY = 0;
const HIT = 2;
const BLOCKED = new Set(['#', '*', '^']);
const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]];

export function battleshipBot(view, level, rng = Math.random) {
  if (!view || !BOT_LEVELS.includes(level)) return null;
  if (view.ultimate && view.phase === 'pick') {
    return view.yourCommander ? null : { type: 'commander', id: COMMANDER_IDS[Math.floor(rng() * COMMANDER_IDS.length)] };
  }
  if (view.phase !== 'aim' || view.turn !== view.you) return null;
  const sea = seaOf(view);
  const score = level === 'hard' ? density(sea) : hunt(sea, level, rng);
  const best = bestCell(sea, score, rng);
  if (!best) return null;
  const shot = { type: 'fire', x: best.x, y: best.y };
  return view.ultimate ? ultimateMove(view, sea, score, best, level, rng) || shot : shot;
}

// ---- what the computer knows about your sea ---------------------------------------------

/**
 * Your sea as the computer sees it: its size and terrain, the shots (fog shows as 3), the
 * squares of sunk ships, the hits not yet part of a sunk ship (still worth hunting around),
 * and the ships still afloat (their shapes, for working out where they could be).
 */
function seaOf(view) {
  const ult = Boolean(view.ultimate);
  const w = ult ? view.size.w : SIZE;
  const h = ult ? view.size.h : SIZE;
  const rows = ult ? view.rows : null;
  const t = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : rows ? rows[y][x] : '.');
  const shots = view.theirs.shots;
  const wreck = new Set();
  const sunkNames = [];
  for (const s of view.theirs.ships || []) {
    if (!s.sunk) continue;
    sunkNames.push(s.name);
    const cells = ult ? s.cells : shipCells(s, s.len);
    cells.forEach(([x, y]) => wreck.add(y * w + x));
  }
  const live = [];
  shots.forEach((v, k) => { if (v === HIT && !wreck.has(k)) live.push(k); });
  for (const k of view.theirs.spotted || []) if (shots[k] === EMPTY) live.push(k); // seen by a scan
  // The ships left: each as its shapes (every turn of it), and how many squares it is.
  let afloat;
  if (ult) {
    const id = view.commanders && view.commanders[1 - view.you];
    const fleet = id && COMMANDERS[id] ? COMMANDERS[id].fleet : [];
    afloat = fleet.filter((e, i) => !removeOnce(sunkNames, e.name, i)).map((e) => ({ size: shapeCells(e.shape, 0).length, rots: [0, 1, 2, 3].map((r) => shapeCells(e.shape, r)) }));
  } else {
    afloat = FLEET.filter((f) => !removeOnce(sunkNames, f.name)).map((f) => ({ size: f.len, rots: [shipCells({ x: 0, y: 0, dir: 'h' }, f.len), shipCells({ x: 0, y: 0, dir: 'v' }, f.len)] }));
  }
  return {
    w, h, t, shots, wreck, live, afloat,
    open: (x, y) => { const tt = t(x, y); return tt !== null && !BLOCKED.has(tt) && shots[y * w + x] === EMPTY; },
  };
}

/** Take `name` out of `list` once (two ships can share a name); true if it was there. */
function removeOnce(list, name) {
  const i = list.indexOf(name);
  if (i === -1) return false;
  list.splice(i, 1);
  return true;
}

/** Normal and Easy: the squares next to a live hit are worth most, more so along a line of hits. */
function hunt(sea, level, rng) {
  const { w, h } = sea;
  const score = new Array(w * h).fill(0);
  const follow = level === 'normal' || rng() < 0.35; // Easy forgets about its hits most of the time
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!sea.open(x, y)) continue;
      score[y * w + x] = level === 'easy' ? 1 : (x + y) % 2 === 0 ? 1 : 0.6; // a checkerboard finds ships faster
    }
  }
  if (!follow) return score;
  const live = new Set(sea.live);
  for (const k of sea.live) {
    const x = k % w;
    const y = Math.floor(k / w);
    if (sea.shots[k] === EMPTY) score[k] += 60; // a ship square seen by a scan: fire on it
    for (const [dx, dy] of SIDES) {
      const nx = x + dx;
      const ny = y + dy;
      if (!sea.open(nx, ny)) continue;
      // Along a line of hits (the hit behind this one too) is better than off to the side.
      const behind = live.has((y - dy) * w + (x - dx)) && x - dx >= 0 && x - dx < w;
      score[ny * w + nx] += behind ? 30 : 10;
    }
  }
  // Further along a line: past the hits, to the first open square.
  for (const k of sea.live) {
    const x = k % w;
    const y = Math.floor(k / w);
    for (const [dx, dy] of SIDES) {
      if (!live.has((y + dy) * w + (x + dx)) || x + dx < 0 || x + dx >= w) continue;
      let nx = x + dx;
      let ny = y + dy;
      while (nx >= 0 && ny >= 0 && nx < w && ny < h && live.has(ny * w + nx)) { nx += dx; ny += dy; }
      if (sea.open(nx, ny)) score[ny * w + nx] += 30;
    }
  }
  return score;
}

/**
 * Hard: for every square, how many ways a ship still afloat could lie across it, given the
 * misses, the wrecks and the terrain. While there are hits to follow up, only the ways that
 * pass through them count (so it finishes off a ship it has found).
 */
function density(sea) {
  const { w, h } = sea;
  const score = new Array(w * h).fill(0);
  const live = new Set(sea.live);
  const huntingFor = live.size > 0;
  for (const ship of sea.afloat) {
    for (const cells of ship.rots) {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          let ok = true;
          let through = 0;
          for (const [cx, cy] of cells) {
            const px = x + cx;
            const py = y + cy;
            const tt = sea.t(px, py);
            const k = py * w + px;
            if (tt === null || BLOCKED.has(tt) || (tt === '~' && ship.size > 3) || sea.wreck.has(k) || (sea.shots[k] !== EMPTY && !live.has(k) && sea.shots[k] !== 3)) { ok = false; break; }
            if (live.has(k)) through++;
          }
          if (!ok || (huntingFor && !through)) continue;
          const weight = huntingFor ? 1 + through * 4 : 1;
          for (const [cx, cy] of cells) score[(y + cy) * w + x + cx] += weight;
        }
      }
    }
  }
  for (let k = 0; k < w * h; k++) {
    if (!sea.open(k % w, Math.floor(k / w))) score[k] = 0;
    else if (live.has(k)) score[k] += 1000; // a scanned ship square
  }
  return score;
}

/** The open square with the best score (ties broken at random); any open square if all score 0. */
function bestCell(sea, score, rng) {
  let best = [];
  let top = -1;
  for (let y = 0; y < sea.h; y++) {
    for (let x = 0; x < sea.w; x++) {
      if (!sea.open(x, y)) continue;
      const s = score[y * sea.w + x];
      if (s > top + 1e-9) { top = s; best = [{ x, y }]; } else if (Math.abs(s - top) <= 1e-9) best.push({ x, y });
    }
  }
  return best.length ? best[Math.floor(rng() * best.length)] : null;
}

// ---- Ultimate: skills and specials ------------------------------------------------------

/** What a skill or special would be worth aimed at `a`: the scores of the open squares it covers. */
function worth(sea, score, aim, a) {
  if (aim === 'row' || aim === 'rows3') {
    // A torpedo runs from its side to the first ship: worth the best square on its way.
    const rows = aim === 'row' ? [a.y] : [a.y - 1, a.y, a.y + 1];
    let sum = 0;
    for (const y of rows) {
      let best = 0;
      for (let i = 0; i < sea.w; i++) {
        const x = a.from === 'e' ? sea.w - 1 - i : i;
        const tt = sea.t(x, y);
        if (tt === null || BLOCKED.has(tt) || tt === '%') break;
        if (sea.open(x, y)) best = Math.max(best, score[y * sea.w + x]);
      }
      sum += best;
    }
    return sum;
  }
  return footprint(aim, a, { w: sea.w, h: sea.h }).reduce((s, [x, y]) => s + (sea.open(x, y) ? score[y * sea.w + x] : 0), 0);
}

/** The best place to aim an area: every square, both ways round (a line) or both sides (a torpedo). */
function bestAim(sea, score, aim, rng) {
  let best = null;
  for (let y = 0; y < sea.h; y++) {
    for (let x = 0; x < sea.w; x++) {
      for (const turn of ['h', 'v']) {
        const a = { x, y, dir: turn, from: turn === 'h' ? 'w' : 'e' };
        const v = worth(sea, score, aim, a) + rng() * 1e-6;
        if (!best || v > best.v) best = { v, a };
      }
    }
  }
  return best && best.v > 1e-3 ? best : null;
}

/**
 * A skill or the special, if one's worth more than a plain shot: Normal and Hard always fire a
 * charged special and use a skill when it covers clearly more than the best single square;
 * Easy now and then tries one at random. Sonar and the shield aren't used.
 */
function ultimateMove(view, sea, score, cell, level, rng) {
  const you = view.you;
  const cmd = COMMANDERS[view.yourCommander];
  const shotWorth = score[cell.y * sea.w + cell.x] || 1e-3;
  const special = cmd && view.charge[you] >= view.chargeNeeded[you] && view.chargeNeeded[you] > 0 ? cmd.special : null;
  if (level === 'easy' && rng() > 0.25) return null;
  if (special) {
    if (special.aim === 'none') return { type: 'special' };
    const aim = bestAim(sea, score, special.aim, rng);
    if (aim) return { type: 'special', x: aim.a.x, y: aim.a.y, dir: aim.a.dir, from: aim.a.from };
  }
  const options = (view.skills || []).filter((k) => SKILLS[k] && k !== 'sonar' && k !== 'shield' && view.energy[you] >= SKILLS[k].cost);
  let pick = null;
  for (const k of options) {
    if (SKILLS[k].aim === 'two') {
      const two = topTwo(sea, score, rng);
      if (two) {
        const v = score[two[0].y * sea.w + two[0].x] + score[two[1].y * sea.w + two[1].x];
        if (!pick || v > pick.v) pick = { v, input: { type: 'skill', skill: k, x: two[0].x, y: two[0].y, x2: two[1].x, y2: two[1].y } };
      }
      continue;
    }
    const aim = bestAim(sea, score, SKILLS[k].aim, rng);
    if (aim && (!pick || aim.v > pick.v)) pick = { v: aim.v, input: { type: 'skill', skill: k, x: aim.a.x, y: aim.a.y, dir: aim.a.dir, from: aim.a.from } };
  }
  if (!pick) return null;
  const enough = level === 'easy' ? 0 : level === 'hard' ? 1.6 : 2;
  return pick.v >= shotWorth * enough ? pick.input : null;
}

function topTwo(sea, score, rng) {
  const cells = [];
  for (let y = 0; y < sea.h; y++) for (let x = 0; x < sea.w; x++) if (sea.open(x, y)) cells.push({ x, y, s: score[y * sea.w + x] + rng() * 1e-6 });
  cells.sort((a, b) => b.s - a.s);
  return cells.length >= 2 ? cells.slice(0, 2) : null;
}
