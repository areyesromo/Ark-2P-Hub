/**
 * The computer teammate for Kitchen Rush (see `bot` in index.js). It cooks like a good partner:
 * every moment it looks at the orders, the stations and what you're holding, and takes the most
 * useful job: meat off the stove before it burns, chopping what's on a board, a finished plate
 * to the hatch, a ready ingredient onto a plate, a fresh plate out, or fetching what the next
 * orders still need (counting what you've got in hand, so it doesn't double up). In the Split
 * kitchen it works its own side and passes things over the middle counter. It walks there and
 * presses ACTION at a person's pace.
 *   easy:   slower on its feet and with its hands, and it stands about now and then.
 *   normal: steady.
 *   hard:   quick, and never lets the meat burn.
 */
import { reactionMs } from './bot-human.js';

const LEVEL = {
  easy: { pace: 0.8, hands: 1.3, dawdle: 0.02, rescue: 0.3 },
  normal: { pace: 0.9, hands: 1.1, dawdle: 0.008, rescue: 0.2 },
  hard: { pace: 1, hands: 0.85, dawdle: 0, rescue: 0.05 },
};
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const CRATE = { bun: 'B', meat: 'M', tomato: 'T', lettuce: 'L' };
const isReady = (it) => it.kind === 'bun' || (it.kind === 'meat' ? it.state === 'cooked' : it.kind !== 'plate' && it.state === 'chopped');
const sameDish = (a, b) => a.slice().sort().join() === b.slice().sort().join();

/** The kitchen as a grid: which floor cells this chef can walk to, and how to get places. */
function kitchenMap(layout, from) {
  const tile = (x, y) => (layout[y] || '')[x];
  const floor = (x, y) => tile(x, y) === ' ';
  // Each floor area (the Split kitchen has two), and the steps from the chef's cell.
  const area = new Map();
  let n = 0;
  layout.forEach((row, y) => [...row].forEach((c, x) => {
    if (c !== ' ' || area.has(x + ',' + y)) return;
    n++;
    const stack = [[x, y]];
    area.set(x + ',' + y, n);
    while (stack.length) {
      const [cx, cy] = stack.pop();
      for (const [dx, dy] of DIRS) {
        const k = cx + dx + ',' + (cy + dy);
        if (floor(cx + dx, cy + dy) && !area.has(k)) {
          area.set(k, n);
          stack.push([cx + dx, cy + dy]);
        }
      }
    }
  }));
  const dist = new Map([[from.join(), 0]]);
  const prev = new Map();
  const queue = [from];
  while (queue.length) {
    const [x, y] = queue.shift();
    for (const [dx, dy] of DIRS) {
      const k = x + dx + ',' + (y + dy);
      if (!floor(x + dx, y + dy) || dist.has(k)) continue;
      dist.set(k, dist.get(x + ',' + y) + 1);
      prev.set(k, [x, y]);
      queue.push([x + dx, y + dy]);
    }
  }
  /** The floor cells beside a station that the chef can stand in, nearest first. */
  const access = (tx, ty) => DIRS.map(([dx, dy]) => [tx + dx, ty + dy]).filter(([x, y]) => dist.has(x + ',' + y)).sort((a, b) => dist.get(a.join()) - dist.get(b.join()));
  const reach = (tx, ty) => access(tx, ty).length > 0;
  const steps = (tx, ty) => (reach(tx, ty) ? dist.get(access(tx, ty)[0].join()) : Infinity);
  /** The first cell to step to on the way to `cell` (or the cell itself when it's next door). */
  const firstStep = (cell) => {
    let k = cell.join();
    let p = prev.get(k);
    while (p && p.join() !== from.join()) {
      k = p.join();
      p = prev.get(k);
    }
    return k.split(',').map(Number);
  };
  // Counters beside both floor areas: where things are passed over (Split).
  const mine = area.get(from.join());
  const pass = (x, y) => tile(x, y) === '#' && DIRS.some(([dx, dy]) => area.get(x + dx + ',' + (y + dy)) === mine) && DIRS.some(([dx, dy]) => { const a = area.get(x + dx + ',' + (y + dy)); return a && a !== mine; });
  return { tile, access, reach, steps, firstStep, pass };
}

export function kitchenRushBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  const L = LEVEL[level];
  if (!view || !L || !view.chefs) return null;
  // Before and after the shift: hands off the controls.
  if (view.phase !== 'play') return view.phase === 'over' ? null : { type: 'move', x: 0, y: 0, chop: false, botDelayMs: 200 };
  const me = view.chefs[view.you];
  const mate = view.chefs[1 - view.you];
  const here = [Math.floor(me.x), Math.floor(me.y)];
  const K = kitchenMap(view.layout, here);
  const itemAt = (x, y) => view.items.find((it) => it.x === x && it.y === y);
  const tiles = (c) => {
    const out = [];
    view.layout.forEach((row, y) => [...row].forEach((ch, x) => { if (ch === c) out.push([x, y]); }));
    return out;
  };
  // The nearest of some stations (the one it was already heading for, if that's still one: no
  // dithering between two boards side by side).
  const nearest = (list) => {
    const ok = list.filter(([x, y]) => K.reach(x, y));
    const was = memory.kitchenGoal && ok.find(([x, y]) => x === memory.kitchenGoal.at[0] && y === memory.kitchenGoal.at[1]);
    return was || ok.sort((a, b) => K.steps(...a) - K.steps(...b))[0] || null;
  };
  const freeCounter = (preferPass) => {
    const free = tiles('#').filter(([x, y]) => !itemAt(x, y) && K.reach(x, y));
    const passing = free.filter(([x, y]) => K.pass(x, y));
    return nearest(preferPass && passing.length ? passing : free);
  };
  const orders = view.orders.slice().sort((a, b) => a.left - b.left);
  const plates = view.items.filter((it) => it.kind === 'plate');
  /** An order a plate (its contents) could still become, the most urgent first. */
  const fits = (contents) => orders.find((o) => contents.every((k) => o.needs.includes(k)));
  const holding = me.held;
  let goal = null; // { at: [x, y], how: 'act' | 'chop' }
  const act = (at) => at && (goal = { at, how: 'act' });

  if (holding) {
    const k = holding.kind;
    if (k === 'plate') {
      const o = fits(holding.contents);
      if (o && sameDish(holding.contents, o.needs) && nearest(tiles('H'))) act(nearest(tiles('H')));
      else if (o) {
        const missing = o.needs.filter((n) => !holding.contents.includes(n));
        const ready = view.items.filter((it) => missing.includes(it.kind) && isReady(it) && K.reach(it.x, it.y)).map((it) => [it.x, it.y]);
        if (ready.length) act(nearest(ready));
        else if (missing.includes('bun') && nearest(tiles('B'))) act(nearest(tiles('B')));
      } else if (holding.contents.length && nearest(tiles('X'))) act(nearest(tiles('X'))); // (nobody wants this: empty it)
      if (!goal) act(freeCounter(!K.reach(...(tiles('H')[0] || [0, 0]))));
    } else if (holding.state === 'burnt') {
      act(nearest(tiles('X')) || freeCounter(false));
    } else if (k === 'meat' && holding.state !== 'cooked') {
      // (no stove free: down on a counter for now, hands free for the burnt one)
      act(nearest(tiles('S').filter(([x, y]) => !itemAt(x, y))) || freeCounter(!tiles('S').some(([x, y]) => K.reach(x, y))));
    } else if ((k === 'tomato' || k === 'lettuce') && holding.state === 'raw') {
      act(nearest(tiles('C').filter(([x, y]) => !itemAt(x, y))) || freeCounter(!tiles('C').some(([x, y]) => K.reach(x, y))));
    } else {
      // Ready: onto a plate that wants it, else down by the plates (or over the middle).
      const want = plates.filter((p) => K.reach(p.x, p.y) && !p.contents.includes(k) && fits([...p.contents, k])).map((p) => [p.x, p.y]);
      act(nearest(want) || freeCounter(!nearest(tiles('P'))));
    }
  } else {
    const myStations = (list) => list.filter((it) => K.reach(it.x, it.y));
    const burning = myStations(view.items.filter((it) => it.kind === 'meat' && it.state === 'cooked' && view.layout[it.y][it.x] === 'S' && (it.burn || 0) >= L.rescue));
    const burnt = myStations(view.items.filter((it) => it.state === 'burnt'));
    // (a board you're chopping is yours: only one of you can chop it at once)
    const yours = mate.chopping && mate.at ? mate.at.join() : null;
    const toChop = myStations(view.items.filter((it) => view.layout[it.y][it.x] === 'C' && it.state === 'raw' && it.x + ',' + it.y !== yours));
    const done = myStations(plates.filter((p) => { const o = fits(p.contents); return o && sameDish(p.contents, o.needs); }));
    const counterPlates = plates.filter((p) => K.reach(p.x, p.y));
    const wanted = myStations(view.items.filter((it) => it.kind !== 'plate' && isReady(it) && counterPlates.some((p) => !p.contents.includes(it.kind) && fits([...p.contents, it.kind]))));
    if (burning.length) act([burning[0].x, burning[0].y]);
    else if (burnt.length) act(nearest(burnt.map((it) => [it.x, it.y]))); // (into the bin with it)
    else if (toChop.length) goal = { at: [...nearest(toChop.map((it) => [it.x, it.y]))], how: 'chop' };
    else if (done.length && nearest(tiles('H'))) act([done[0].x, done[0].y]);
    else if (wanted.length) act(nearest(wanted.map((it) => [it.x, it.y])));
    else if (!plates.length && !(mate.held && mate.held.kind === 'plate') && nearest(tiles('P')) && orders.length) act(nearest(tiles('P')));
    else {
      // Fetch what the next orders still need, counting what's on its way (yours too).
      const need = {};
      for (const o of orders.slice(0, 2)) for (const n of o.needs) need[n] = (need[n] || 0) + 1;
      const have = {};
      const count = (kind) => { have[kind] = (have[kind] || 0) + 1; };
      view.items.forEach((it) => (it.kind === 'plate' ? it.contents.forEach(count) : it.state !== 'burnt' && count(it.kind)));
      [mate.held].forEach((h) => h && (h.kind === 'plate' ? h.contents.forEach(count) : count(h.kind)));
      const short = Object.keys(need).filter((n) => need[n] > (have[n] || 0) && nearest(tiles(CRATE[n]))).sort((a, b) => (need[b] - (have[b] || 0)) - (need[a] - (have[a] || 0)));
      if (short.length) act(nearest(tiles(CRATE[short[0]])));
    }
  }

  memory.kitchenGoal = goal; // (what it's after: for a look in a test)
  const pace = reactionMs(level, rng);
  // (the shift's clock counts down: it stands looking at the orders until it reaches `idleTill`)
  const left = view.timeLeftMs || 0;
  if (memory.kitchenIdleTill !== undefined && left > memory.kitchenIdleTill && left - memory.kitchenIdleTill < 3000) return { type: 'move', x: 0, y: 0, botDelayMs: pace };
  if (rng() < L.dawdle / 10) memory.kitchenIdleTill = left - 1000 - rng() * 1500;
  const chopping = Boolean(me.chopping);
  if (!goal) return chopping ? { type: 'chop', on: false, botDelayMs: pace } : { type: 'move', x: 0, y: 0, botDelayMs: pace };
  const [gx, gy] = goal.at;
  const facing = me.at && me.at[0] === gx && me.at[1] === gy;
  const spot = K.access(gx, gy)[0];
  if (!spot) return null;
  const atSpot = here[0] === spot[0] && here[1] === spot[1];
  if (atSpot && facing) {
    if (goal.how === 'chop') return chopping ? { type: 'move', x: 0, y: 0, botDelayMs: pace } : { type: 'chop', on: true, botDelayMs: pace * L.hands };
    return { type: 'act', botDelayMs: pace * L.hands, botFor: gx + ',' + gy + ':' + (holding ? holding.kind + (holding.contents || '') : '-') };
  }
  if (chopping) return { type: 'chop', on: false, botDelayMs: pace };
  // Walk: to the next cell's middle, or (there) turn to face the station.
  const next = atSpot ? null : K.firstStep(spot);
  const r2 = (n) => Math.round(n * 100) / 100;
  if (!next) {
    const dx = gx - here[0];
    const dy = gy - here[1];
    // (lean towards it, straightening up in the cell a little: never so much that it turns away,
    // as ACTION faces the way the stick points)
    const ox = dx ? 0 : Math.max(-0.3, Math.min(0.3, (spot[0] + 0.5 - me.x) * 2));
    const oy = dy ? 0 : Math.max(-0.3, Math.min(0.3, (spot[1] + 0.5 - me.y) * 2));
    return { type: 'move', x: r2(dx * 0.8 + ox), y: r2(dy * 0.8 + oy), botDelayMs: pace * 0.5 };
  }
  const dx = next[0] + 0.5 - me.x;
  const dy = next[1] + 0.5 - me.y;
  const d = Math.hypot(dx, dy) || 1;
  return { type: 'move', x: r2((dx / d) * L.pace), y: r2((dy / d) * L.pace), botDelayMs: pace * 0.5 };
}

