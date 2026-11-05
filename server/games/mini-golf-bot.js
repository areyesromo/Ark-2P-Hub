/**
 * The computer opponent for Mini Golf (see `bot` in index.js). Like a player who knows the
 * course, it tries putts in its head (the game's own physics, simulatePutt), picks the one that
 * ends nearest the cup (or in it), keeps out of the water, takes a moment to line it up, then
 * putts with a person's slip in the angle and the power.
 *   easy:   aims straight at the cup, judges the power by eye, and slips the most.
 *   normal: tries a few dozen putts (off walls too), and slips a little.
 *   hard:   tries many, picks putts that still come off when slightly mishit, and putts steadily.
 */
import { PHYSICS, simulatePutt } from './mini-golf.js';

const THINK_MS = 12; // planning per look, at most

const LEVEL = {
  easy: { angles: 0, powers: 0, slipAngle: 0.07, slipPower: 0.15 },
  normal: { angles: 24, powers: 4, slipAngle: 0.03, slipPower: 0.07 },
  hard: { angles: 40, powers: 6, slipAngle: 0.012, slipPower: 0.03 },
};

export function miniGolfBot(view, level, rng = Math.random, retries = 0, memory = {}) {
  const L = LEVEL[level];
  if (!view || !L || view.phase !== 'play' || !view.balls || !view.hole) return null;
  const b = view.balls[view.you];
  if (b.done || b.holed || b.vx || b.vy) return null;
  const id = view.holeNo + ':' + b.strokes + ':' + b.x + ',' + b.y;
  if (!memory.golf || memory.golf.id !== id) {
    // How long it'll take to line up and putt (so it judges the windmill as it'll be then).
    const aimMs = 900 + rng() * 1200;
    const puttMs = 700 + rng() * 900;
    const mill = view.hole.windmill;
    const millThen = mill ? view.millAngle + (mill.speed * (aimMs + puttMs + 60)) / 1000 : 0;
    memory.golf = { id, aimMs, puttMs, work: plan(view, b, level, rng, millThen), plan: null };
  }
  const g = memory.golf;
  // It thinks it through a little at a time (a few ms each look), so the hub never stalls.
  if (!g.plan) {
    const until = Date.now() + THINK_MS;
    for (let step = g.work.next(); ; step = g.work.next()) {
      if (step.done) { g.plan = step.value; break; }
      if (Date.now() > until) return null;
    }
  }
  // Line it up first (the TV shows the aim), then putt.
  const off = Math.abs(Math.atan2(Math.sin(b.aim.angle - g.plan.angle), Math.cos(b.aim.angle - g.plan.angle)));
  if (off > 0.02) return { type: 'aim', angle: g.plan.angle, power: 0, botDelayMs: g.aimMs };
  // The putt itself, with a person's slip.
  const angle = g.plan.angle + gauss(rng) * L.slipAngle;
  const power = Math.max(0.05, Math.min(1, g.plan.power * (1 + gauss(rng) * L.slipPower)));
  return { type: 'shoot', angle, power, botDelayMs: g.puttMs };
}

/** The putt it means to play, { angle, power }, worked out a putt at a time (it yields after each). */
function* plan(view, b, level, rng, mill) {
  const hole = view.hole;
  const [cx, cy] = hole.cup;
  const direct = Math.atan2(cy - b.y, cx - b.x);
  const L = LEVEL[level];
  // By eye: straight at it, hard enough to roll there (and a little past).
  const d = Math.hypot(cx - b.x, cy - b.y);
  const byEye = { angle: direct, power: Math.min(1, (Math.sqrt(2 * PHYSICS.rollDecel * d) * 1.1 + 0.6) / PHYSICS.maxSpeed) };
  if (!L.angles) return byEye;
  // In its head: a fan of angles and powers, the best ending (in the cup, or nearest it).
  const tried = [{ ...byEye, score: (yield 0, score(simulatePutt(hole, [b.x, b.y], byEye.angle, byEye.power, mill), cx, cy)) }];
  for (let i = 0; i < L.angles; i++) {
    const angle = direct + ((i / L.angles) * 2 - 1) * Math.PI;
    for (let j = 1; j <= L.powers; j++) {
      const power = j / L.powers;
      tried.push({ angle, power, score: (yield 0, score(simulatePutt(hole, [b.x, b.y], angle, power, mill), cx, cy)) + rng() * 0.01 });
    }
  }
  tried.sort((a, c) => a.score - c.score);
  let best = tried[0];
  // Hard knows its own hand: it plays the putt that still comes off when it's slightly off (the
  // best few, each tried a few times with its slip), not one that only works when perfect.
  if (level === 'hard') {
    let bestAvg = Infinity;
    for (const c of tried.slice(0, 8)) {
      let sum = 0;
      for (let k = 0; k < 4; k++) sum += (yield 0, score(simulatePutt(hole, [b.x, b.y], c.angle + gauss(rng) * L.slipAngle, Math.max(0.05, Math.min(1, c.power * (1 + gauss(rng) * L.slipPower))), mill), cx, cy));
      if (sum / 4 < bestAvg) { bestAvg = sum / 4; best = c; }
    }
  }
  // A finer look round the best one.
  for (let k = 0; k < 16; k++) {
    const angle = best.angle + (rng() * 2 - 1) * (Math.PI / L.angles);
    const power = Math.max(0.05, Math.min(1, best.power + (rng() * 2 - 1) * (0.5 / L.powers)));
    const s = (yield 0, score(simulatePutt(hole, [b.x, b.y], angle, power, mill), cx, cy));
    if (s < best.score) best = { angle, power, score: s };
  }
  return best;
}

/** Lower is better: in the cup best of all, the water worst. */
function score(end, cx, cy) {
  if (end.holed) return -10;
  if (end.water) return 50;
  return Math.hypot(end.x - cx, end.y - cy);
}

function gauss(rng) {
  const u = Math.max(1e-9, rng());
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}
