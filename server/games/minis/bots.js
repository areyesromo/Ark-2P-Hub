/**
 * The computer player in the minigames (Micro Mayhem, Party Minigames, Party Board's rounds; see
 * `bot` in server/games/index.js). One small player per minigame, all from the same person:
 *   - it sees a thing a reaction time after it happens (bot-human.js), a slow player's on Easy,
 *     a quick one's on Hard;
 *   - what it sees coming (a needle, a beat, a hurdle, the 10 on a wheel) it times, off by a
 *     person's error (tens of milliseconds: about 70 on Easy, 45 on Normal, 28 on Hard);
 *   - it aims with a wobble, mashes at a person's pace (6 to 9 taps a second), remembers a path
 *     or a shape about as well as people do (Easy loses track past 5 or so), and now and then
 *     slips (the wrong colour, a tap on Don't touch!).
 * It only uses what that player's own screen shows: the board's hidden glass, the other kicker's
 * pick and the shape it has to draw from memory stay hidden.
 */
import { reactionMs } from '../bot-human.js';
import { targetAt } from './tap-it.js';
import { needleAt } from './stop-it.js';
import { STEP_MS as WHEEL_STEP } from './sweet-spot.js';
import { BEAT_MS } from './tug-of-war.js';
import { swingAt } from './tower-stack.js';
import { SWEET } from './bowling.js';
import { JUMP_MS as HURDLE_JUMP_MS } from './hurdle-dash.js';
import { HIT_MS } from './laser-dodge.js';
import { ASPECT, GRAB_R } from './pop-the-most.js';
import { FLOW } from './pour-it.js';
import { CATCH, LEAN_PER, SPEED as SPEED_TRAY } from './stack-attack.js';
import { adjacent, DOTS } from './mirror-me.js';
import * as CANNON from './cannon-lob.js';
import { FRONT_CONE, MAX_SPEED as MAX_CAR_SPEED } from './bumper-cars.js';
import * as DRUM from './drum-beat.js';
import * as ARCHERY from './archery.js';
import * as CURL from './curling.js';

/** A person at each level: timing error (ms sd), aim wobble, slips, mashing rate, thinking pace. */
const SKILL = {
  easy: { timing: 70, aim: 0.07, slip: 0.08, rate: 6, think: 1.5, recall: 5, angle: 6, hold: 120 },
  normal: { timing: 45, aim: 0.045, slip: 0.035, rate: 7.5, think: 1.15, recall: 7, angle: 3.5, hold: 70 },
  hard: { timing: 28, aim: 0.03, slip: 0.012, rate: 9, think: 0.9, recall: 9, angle: 2, hold: 40 },
};

const gauss = (rng) => Math.sqrt(-2 * Math.log(1 - rng())) * Math.cos(2 * Math.PI * rng());
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const unit = (x, y) => {
  const d = Math.hypot(x, y);
  return d > 1e-6 ? { x: x / d, y: y / d } : { x: 0, y: 0 };
};

/**
 * The computer's move in a minigame view (a MiniGame's botView), or null. `key` keeps its plans
 * apart from one minigame to the next (Party Board passes its round).
 */
export function miniBot(view, level, rng = Math.random, memory = {}, key = '') {
  const L = SKILL[level];
  if (!view || !L || !view.mini || (view.you !== 0 && view.you !== 1)) return null;
  // The how-to card: a moment to read it, then Ready (a micro just starts).
  if (view.phase === 'intro') {
    return view.mini.kind === 'party' && view.ready && !view.ready[view.you] ? { type: 'ready', botDelayMs: 1500 + rng() * 2000 * L.think } : null;
  }
  if (view.phase !== 'play' || !view.state) return null;
  const play = PLAYERS[view.mini.id];
  if (!play) return null;
  const id = key + ':' + view.count + ':' + view.mini.id;
  if (!memory.mini || memory.mini.id !== id) memory.mini = { id };
  const el = Number.isFinite(view.elapsedMs) ? view.elapsedMs : (view.durationMs || 0) - (view.timeLeftMs || 0);
  const c = {
    s: view.state, you: view.you, el, level, L, rng, m: memory.mini,
    react: () => reactionMs(level, rng),
    /** A move to be made `t` ms into the minigame. */
    at: (t) => ({ botDelayMs: Math.max(0, t - el) }),
  };
  const move = play(c);
  // (never quicker than a person can press twice: a move that comes straight back, a refused
  // tap say, waits its turn rather than spinning)
  if (move) move.botDelayMs = Math.max(30, Number.isFinite(move.botDelayMs) ? move.botDelayMs : 0);
  return move;
}

/** One player per minigame: (c) -> a move, or null. */
export const PLAYERS = {
  // ---- micros ----
  'tap-it'({ s, you, el, L, rng, m, react, at }) {
    if (s.res[you] !== null) return null;
    // Spot it, move there, tap where it is then (with a wobble); missed: another go (a look and a
    // reach later, past the miss's lock-out).
    if (!m.t || el > m.t + 50) m.t = el + react() + (200 + rng() * 300) * L.think, m.err = [gauss(rng) * L.aim, gauss(rng) * L.aim];
    const p = targetAt(m.t, s.seed);
    return { type: 'tap', x: p.x + m.err[0], y: p.y + m.err[1], t: Math.round(m.t), ...at(m.t) };
  },
  'stop-it'({ s, you, el, L, rng, m, react, at }) {
    if (s.res[you] !== null) return null;
    if (!m.t) {
      // Watch it come round, and stop it as it crosses the middle of the green.
      const mid = (s.zone.from + s.zone.to) / 2;
      const from = el + react() + 300 * L.think;
      let best = from;
      for (let t = from; t < from + s.periodMs; t += 5) if (Math.abs(needleAt(t, s.periodMs) - mid) < Math.abs(needleAt(best, s.periodMs) - mid)) best = t;
      m.t = Math.max(0, best + gauss(rng) * L.timing);
    }
    return { type: 'stop', t: Math.round(m.t), ...at(m.t) };
  },
  'shake-it'({ s, you, L, rng, m, react }) {
    if (s.res[you] !== null) return null;
    const first = !m.going;
    m.going = true;
    return { type: 'shake', botDelayMs: first ? react() : (1000 / L.rate) * (0.8 + rng() * 0.4) };
  },
  'odd-one'({ s, you, L, rng, m, react }) {
    if (s.picks[you] !== null) return null;
    if (m.i === undefined) {
      const count = (e) => s.cells.filter((x) => x === e).length;
      const odd = s.cells.findIndex((e) => count(e) === 1);
      m.i = rng() < L.slip * 1.5 ? (odd + 1 + Math.floor(rng() * 8)) % 9 : odd;
      m.ms = react() + (450 + rng() * 800) * L.think;
    }
    return { type: 'pick', i: m.i, botDelayMs: m.ms };
  },
  'count-em'({ s, you, L, rng, m, react }) {
    if (s.picks[you] !== null) return null;
    if (m.n === undefined) {
      const n = s.sheep.length;
      // A few at a glance; more are counted one by one, and miscounted now and then.
      const off = rng() < L.slip * (n > 5 ? 3 : 1) ? (rng() < 0.5 ? -1 : 1) : 0;
      m.n = s.choices.includes(n + off) ? n + off : n;
      m.ms = react() + (n > 4 ? n * 220 : 350) * L.think;
    }
    return { type: 'pick', n: m.n, botDelayMs: m.ms };
  },
  'swipe-it'({ s, you, L, rng, react }) {
    if (s.res[you] !== null) return null;
    const k = s.done[you];
    const want = s.arrows[k];
    const dirs = ['up', 'down', 'left', 'right'];
    const dir = rng() < L.slip * 0.6 ? dirs[(dirs.indexOf(want) + 1 + Math.floor(rng() * 3)) % 4] : want;
    return { type: 'swipe', dir, botDelayMs: k === 0 ? react() + 250 * L.think : (220 + rng() * 160) * L.think };
  },
  'dont-touch'({ s, you, L, rng, m, react }) {
    if (s.res[you] !== null) return null;
    // Hands off... mostly: a reflex tap at the flash now and then.
    if (m.slip === undefined) m.slip = rng() < L.slip * 1.2;
    return m.slip ? { type: 'tap', botDelayMs: react() } : null;
  },
  'quick-math'({ s, you, L, rng, m, react }) {
    if (s.picks[you] !== null) return null;
    if (m.n === undefined) {
      const [a, op, b] = s.q.split(' ');
      const answer = op === '+' ? +a + +b : op === '×' ? a * b : a - b;
      const wrong = s.choices.filter((n) => n !== answer);
      m.n = rng() < L.slip * (op === '×' ? 2.5 : 1.5) ? wrong[Math.floor(rng() * wrong.length)] : answer;
      m.ms = react() + (700 + rng() * 900 + (op === '×' ? 600 : 0)) * L.think;
    }
    return { type: 'pick', n: m.n, botDelayMs: m.ms };
  },

  // ---- party minigames ----
  balloon({ L, rng, m, react }) {
    const first = !m.going;
    m.going = true;
    return { type: 'pump', botDelayMs: first ? react() : (1000 / (L.rate - 0.5)) * (0.85 + rng() * 0.3) };
  },
  'hot-potato'({ s, you, L, rng, react }) {
    if (s.holder !== you || s.flying) return null;
    return { type: 'pass', botDelayMs: react() + (80 + rng() * 400) * L.think };
  },
  'quick-draw'({ s, L, rng, m, react }) {
    const d = (m.duels = m.duels || {});
    if (!d[s.duel]) d[s.duel] = { rt: react(), jump: rng() < L.slip * 0.5 ? 400 + rng() * 1500 : null };
    if (s.stage === 'bang') return { type: 'fire', botDelayMs: d[s.duel].rt };
    // (jumping the gun now and then, on Easy most)
    if (s.stage === 'wait' && d[s.duel].jump !== null) return { type: 'fire', botDelayMs: d[s.duel].jump };
    return null;
  },
  'memory-path'({ s, you, L, rng, m, react }) {
    m.seen = m.seen || {};
    if (s.stage === 'show' && s.seq && !m.seen[s.length]) {
      // It takes the path in, as well as a person holds one: past its span, a step goes astray.
      const seq = s.seq.slice();
      const over = seq.length - (L.recall + Math.round(gauss(rng)));
      if (over > 0 && rng() < Math.min(0.9, over * 0.35)) seq[Math.floor(rng() * seq.length)] = Math.floor(rng() * 9);
      m.seen[s.length] = seq;
    }
    if (s.stage !== 'input' || s.out[you] || s.finished[you]) return null;
    const seq = m.seen[s.length];
    const k = s.step[you];
    const i = seq ? seq[k] : Math.floor(rng() * 9);
    return { type: 'cell', i, botDelayMs: k === 0 ? react() + 300 * L.think : (300 + rng() * 250) * L.think };
  },
  'sweet-spot'({ s, you, el, L, rng, m, react, at }) {
    const n = s.spins[you].length;
    if (n >= 3) return null;
    if (!m.plan || m.plan.n !== n) {
      // The 10 comes round every 1.1 s: it times its press for the middle of it.
      const start = s.spinStart[you];
      const from = Math.max(el + react() + 200, start);
      const cycle = WHEEL_STEP * 10;
      const mid = start - s.offset[you] + WHEEL_STEP * 9.5;
      const k = Math.ceil((from - mid) / cycle);
      m.plan = { n, t: Math.max(start + 1, mid + k * cycle + gauss(rng) * L.timing) };
    }
    return { type: 'stop', t: Math.round(m.plan.t), ...at(m.plan.t) };
  },
  'coin-grab'({ s, you, L, rng, react }) {
    const me = s.players[you];
    if (me.stunned) return null;
    const bombs = s.items.filter((it) => it.bomb);
    const near = (x, y) => bombs.some((b) => Math.hypot(b.x - x, b.y - y) < 0.1);
    let best = null;
    for (const it of s.items) {
      if (it.bomb) continue;
      const d = Math.hypot(it.x - me.x, it.y - me.y);
      if (s.life - it.age < (d / 0.6) * 1000) continue; // gone before it gets there
      // (a bomb in the way counts against it)
      const blocked = [0.25, 0.5, 0.75].some((k) => near(me.x + (it.x - me.x) * k, me.y + (it.y - me.y) * k));
      const v = d + (blocked ? 0.3 : 0);
      if (!best || v < best.v) best = { it, v };
    }
    let dir = best ? unit(best.it.x - me.x, best.it.y - me.y) : unit(0.5 - me.x, 0.5 - me.y);
    const bomb = bombs.find((b) => Math.hypot(b.x - me.x, b.y - me.y) < 0.13);
    if (bomb) dir = unit(dir.x + (me.x - bomb.x) * 8, dir.y + (me.y - bomb.y) * 8); // sidestep it
    const wob = gauss(rng) * L.aim * 4;
    return { type: 'move', x: dir.x * Math.cos(wob) - dir.y * Math.sin(wob), y: dir.x * Math.sin(wob) + dir.y * Math.cos(wob), botDelayMs: react() * 0.7 };
  },
  'tug-of-war'({ el, L, rng, m, react, at }) {
    // One pull on each beat, off by a person's timing error.
    if (!m.plan || el >= m.plan.t) { // (due: the next one's for the next beat)
      const k = Math.max(m.plan ? m.plan.k + 1 : 0, Math.ceil((el + react() * 0.5) / BEAT_MS));
      m.plan = { k, t: Math.max(0, k * BEAT_MS + gauss(rng) * L.timing) };
    }
    return { type: 'pull', t: Math.round(m.plan.t), ...at(m.plan.t) };
  },
  'tower-stack'({ s, you, el, L, rng, m, react, at }) {
    if (s.out[you]) return null;
    const height = s.towers[you].length;
    if (!m.plan || m.plan.height !== height) {
      // Drop it as it swings over the top block.
      const top = s.towers[you][height - 1];
      const start = s.blockStart[you];
      const from = Math.max(el + react() + 150, start);
      let best = from;
      for (let t = from; t < from + s.swing.period; t += 5) {
        if (Math.abs(swingAt(t - start, s.swing) - top.x) < Math.abs(swingAt(best - start, s.swing) - top.x)) best = t;
      }
      m.plan = { height, t: Math.max(start, best + gauss(rng) * L.timing) };
    }
    return { type: 'drop', t: Math.round(m.plan.t), ...at(m.plan.t) };
  },
  bowling({ s, you, L, rng, m }) {
    const lane = s.lanes[you];
    if (lane.stage !== 'ready') return null;
    if (!m.roll || m.roll.n !== lane.roll) {
      m.roll = { n: lane.roll, aim: clamp(SWEET.aim + gauss(rng) * L.aim * 3, -1, 1), power: clamp(SWEET.power + gauss(rng) * L.aim * 2.2, 0, 1), ms: (1500 + rng() * 1500) * L.think };
    }
    return { type: 'bowl', aim: m.roll.aim, power: m.roll.power, botDelayMs: m.roll.ms };
  },
  penalty({ s, you, level, rng, L, m }) {
    // It remembers where you've kicked and dived this shootout (from each kick's result).
    // (each kick once: counted by how many have been taken, as a result stays on show into the next kick)
    m.seen = m.seen || { kicks: [0, 0, 0], dives: [0, 0, 0], n: 0 };
    const taken = s.taken[0] + s.taken[1];
    if (s.last && m.seen.n !== taken) {
      m.seen.n = taken;
      if (s.last.kicker !== you && s.last.shot !== null) m.seen.kicks[s.last.shot]++;
      if (s.last.kicker === you) m.seen.dives[s.last.dive]++;
    }
    if (s.stage !== 'pick' || s.picked[you]) return null;
    if (!m.kick || m.kick.n !== s.kick) {
      const kicking = s.kicker === you;
      // Hard (and Normal, less often) plays your habits: as keeper, it dives where you kick most;
      // as kicker, it shoots away from where you dive most. Easy just leans to its favourite side.
      const read = { easy: 0, normal: 0.45, hard: 0.85 }[level] || 0;
      const counts = kicking ? m.seen.dives : m.seen.kicks;
      const top = [0, 1, 2].filter((x) => counts[x] === Math.max(...counts));
      const most = top[Math.floor(rng() * top.length)]; // (a tie: either)
      let side = Math.floor(rng() * 3);
      if (Math.max(...counts) >= 2 && rng() < read) side = kicking ? [0, 1, 2].filter((x) => x !== most)[Math.floor(rng() * 2)] : most;
      else if (level === 'easy' && rng() < 0.4) side = 2;
      m.kick = { n: s.kick, side, ms: (900 + rng() * 1600) * L.think };
    }
    return { type: 'pick', side: m.kick.side, botDelayMs: m.kick.ms };
  },
  'whack-a-mole'({ s, you, L, rng, m, react }) {
    const t = react() + 120 * L.think;
    // Its own colour or gold (the odd slip on one of yours), still up when the hammer lands.
    const up = s.holes.map((h, i) => ({ h, i })).filter(({ h }) => h && h.left > t + 30);
    const mine = up.filter(({ h }) => h.who === you || h.who === 'gold');
    let pick = mine.find(({ h }) => m.id === h.id) || mine.sort((a, b) => (b.h.who === 'gold') - (a.h.who === 'gold'))[0];
    if (!pick && up.length && rng() < L.slip * 0.5) pick = up[0];
    if (!pick) return null;
    m.id = pick.h.id;
    return { type: 'whack', hole: pick.i, botFor: pick.h.id, botDelayMs: t }; // (for that mole: not one up in its hole since)
  },
  fishing({ s, you, level, L, rng, react }) {
    const line = s.lines[you];
    if (line.stage === 'bite') return { type: 'tap', botDelayMs: react() };
    if (line.stage !== 'reel') return null;
    // Reel steadily, easing off before the line's too tight (it sees the tension late).
    const easeAt = { easy: 0.68, normal: 0.75, hard: 0.8 }[level];
    if (line.tension >= easeAt) return null;
    return { type: 'tap', botDelayMs: (1000 / (L.rate - 1.5)) * (0.85 + rng() * 0.3) };
  },
  'glass-bridge'({ s, you, L, rng, m }) {
    const r = s.runners[you];
    if (r.busy || r.falling || r.row >= s.rows) return null;
    const row = r.row;
    // What's been stood on or broken it can see (yours too); otherwise a guess.
    m.guess = m.guess || {};
    if (m.guess[row] === undefined) m.guess[row] = rng() < 0.5 ? 0 : 1;
    let side = m.guess[row];
    if (s.solid[row][0] || s.solid[row][1]) side = s.solid[row][0] ? 0 : 1;
    else if (s.broken[row][side]) side = 1 - side;
    return { type: 'pick', side, botDelayMs: (450 + rng() * 450) * L.think };
  },
  'ice-sumo'({ s, you, L, rng, react }) {
    const me = s.pucks[you];
    const foe = s.pucks[1 - you];
    const r = Math.hypot(me.x, me.y);
    let dir;
    if (r > s.rink * 0.72) dir = unit(-me.x - me.vx * 0.5, -me.y - me.vy * 0.5); // back from the edge
    else {
      // At them, a little outside them (to shove them out), leading their slide.
      const out = unit(foe.x, foe.y);
      dir = unit(foe.x + foe.vx * 0.3 + out.x * 0.6 - me.x - me.vx * 0.3, foe.y + foe.vy * 0.3 + out.y * 0.6 - me.y - me.vy * 0.3);
    }
    const wob = gauss(rng) * L.aim * 4;
    return { type: 'move', x: dir.x * Math.cos(wob) - dir.y * Math.sin(wob), y: dir.x * Math.sin(wob) + dir.y * Math.cos(wob), botDelayMs: react() * 0.7 };
  },
  'simon-says'({ s, you, level, L, rng, m, react }) {
    const o = s.order;
    if (!o || o.done || s.answers[you]) return null;
    if (!m.order || m.order.id !== o.id) {
      // A colour to find (a choice: slower than a plain reaction), and "Simon didn't say" to catch.
      const trap = { easy: 0.22, normal: 0.12, hard: 0.05 }[level];
      const colours = ['green', 'red', 'blue', 'yellow'];
      const press = o.simon || rng() < trap;
      const colour = o.simon && rng() < L.slip ? colours[(colours.indexOf(o.color) + 1 + Math.floor(rng() * 3)) % 4] : o.color;
      m.order = { id: o.id, press, colour, ms: react() + 180 * L.think };
    }
    if (!m.order.press || o.left < m.order.ms) return null;
    return { type: 'press', color: m.order.colour, botDelayMs: m.order.ms };
  },
  'sword-duel'({ s, you, L, rng, m, react }) {
    if (s.out[you]) return null;
    if (!m.point || m.point.n !== s.n) {
      const dirs = ['up', 'down', 'left', 'right'];
      m.point = { n: s.n, early: rng() < L.slip * 0.6 ? 300 + rng() * 1200 : null, wrong: rng() < L.slip ? dirs[Math.floor(rng() * 4)] : null, ms: react() + 120 * L.think };
    }
    if (s.stage === 'wait' && m.point.early !== null) return { type: 'slash', dir: 'up', botFor: 'wait' + s.n, botDelayMs: m.point.early }; // (not played once the arrow's up)
    if (s.stage !== 'go' || !s.dir) return null;
    return { type: 'slash', dir: m.point.wrong || s.dir, botFor: 'go' + s.n, botDelayMs: m.point.ms };
  },
  'pour-it'({ s, you, L, rng, m, react }) {
    const g = s.glasses[you];
    if (g.done) return null;
    // Pour, and stand it up a reaction time before it reaches the line (judged by eye).
    if (m.stopAt === undefined) m.stopAt = s.line + gauss(rng) * L.aim * 0.6 - (FLOW * react()) / 1000;
    if (g.fill >= m.stopAt) return g.pouring ? { type: 'pour', v: 0, botDelayMs: react() } : null;
    return g.pouring ? null : { type: 'pour', v: 1, botDelayMs: react() + 400 * L.think };
  },
  'hurdle-dash'({ s, you, el, L, rng, m, at }) {
    const me = s.runners[you];
    if (me.air || me.stumbling) return null;
    const h = s.hurdles.find((x) => x > me.pos + 0.2);
    if (h === undefined) return null;
    if (!m.plan || m.plan.h !== h) {
      // In the air as it reaches the hurdle (take-off about half a jump before), off by its
      // timing: judged as it comes up (you're still speeding up, so not from far off).
      const tta = ((h - me.pos) / Math.max(1, me.speed)) * 1000;
      if (tta > 900) return null;
      m.plan = { h, t: el + tta - HURDLE_JUMP_MS / 2 + gauss(rng) * L.timing * 2.5 }; // (a take-off spot at speed: harder to judge than a beat)
    }
    return { type: 'jump', botFor: h, ...at(m.plan.t) };
  },
  'laser-dodge'({ s, you, el, L, rng, m, react, at }) {
    const me = s.players[you];
    m.beams = m.beams || {};
    const next = s.beams.find((b) => b.inMs > -HIT_MS);
    if (!next) return me.duck ? { type: 'duck', on: false, botDelayMs: react() } : null;
    if (!m.beams[next.id]) {
      // It sees the warning (a choice: jump or duck), then times its move to the beam.
      const wrong = rng() < L.slip * 0.6;
      m.beams[next.id] = { hit: el + next.inMs, seen: el + react() + 150 * L.think, kind: wrong ? (next.kind === 'low' ? 'high' : 'low') : next.kind, err: gauss(rng) * L.timing };
    }
    const b = m.beams[next.id];
    if (b.kind === 'low') {
      if (me.duck) return { type: 'duck', on: false, ...at(b.seen) };
      if (me.air || el > b.hit) return null;
      return { type: 'jump', botFor: next.id, ...at(Math.max(b.seen, b.hit - 220 + b.err)) };
    }
    if (el > b.hit + HIT_MS + 100) return me.duck ? { type: 'duck', on: false, botDelayMs: react() } : null;
    return me.duck ? null : { type: 'duck', on: true, ...at(Math.max(b.seen, b.hit - 350 + b.err)) };
  },
  'pop-the-most'({ s, you, L, rng, m, react }) {
    const cur = s.cursors[you];
    const dist = (b) => Math.hypot((b.x - cur.x) * ASPECT, b.y - cur.y);
    const inReach = s.balloons.filter((b) => dist(b) <= GRAB_R).sort((a, b) => dist(a) - dist(b));
    // Pop when the nearest one in the ring is its own colour or gold.
    if (inReach.length && (inReach[0].who === you || inReach[0].who === 'gold') && dist(inReach[0]) < GRAB_R * 0.85) return { type: 'pop', botDelayMs: react() * 0.6 };
    const worth = s.balloons.filter((b) => (b.who === you || b.who === 'gold') && b.y > 0.05 && b.y < 1);
    let t = worth.find((b) => b.id === m.target);
    if (!t) t = worth.sort((a, b) => dist(a) - (a.who === 'gold' ? 0.2 : 0) - (dist(b) - (b.who === 'gold' ? 0.2 : 0)))[0];
    if (!t) return { type: 'move', x: 0, y: 0, botDelayMs: react() };
    m.target = t.id;
    const lead = 0.25; // (they float up: aim a little above)
    const dir = unit((t.x - cur.x) * ASPECT + gauss(rng) * L.aim, t.y - 0.2 * lead - cur.y + gauss(rng) * L.aim);
    const slow = dist(t) < 0.06 ? 0.3 : 1;
    return { type: 'move', x: dir.x * slow, y: dir.y * slow, botDelayMs: react() * 0.7 };
  },
  'safe-cracker'({ s, L, rng, m, react }) {
    if (s.locked || s.opened >= 3) return null;
    // Turn a notch at a time, listening; on the click, try it. (Which way is a guess: the long way
    // round is at most 30 notches, so turning back on a hunch never pays.)
    if (s.click) return { type: 'try', botDelayMs: react() };
    m.dir = m.dir || {};
    if (!m.dir[s.opened]) m.dir[s.opened] = rng() < 0.5 ? -1 : 1;
    return { type: 'turn', by: m.dir[s.opened], botDelayMs: (1000 / (L.rate + 2)) * (0.8 + rng() * 0.4) };
  },
  'reflex-grid'({ s, you, L, rng, react }) {
    const t = react() + 100 * L.think;
    const lit = s.lights.filter((l) => !l.hitBy[you] && l.left > t + 40).sort((a, b) => a.left - b.left);
    if (!lit.length) return null;
    const cell = rng() < L.slip * 0.4 ? Math.floor(rng() * 9) : lit[0].cell;
    return { type: 'tap', cell, botDelayMs: t };
  },
  'mirror-me'({ s, you, L, rng, m, react }) {
    m.shapes = m.shapes || {};
    if (s.stage === 'show' && s.shape && !m.shapes[s.round]) {
      // The lines as it remembers them: most of them; a forgotten one is now and then misplaced.
      const keep = { 5: 0.8, 7: 0.9, 9: 0.97 }[L.recall] || 0.9;
      const lines = [];
      for (const [a, b] of s.shape) {
        if (rng() < keep) lines.push([a, b]);
        else if (rng() < 0.5) {
          const c = [a - 1, a + 1, a - 4, a + 4, a - 5, a + 5].filter((x) => adjacent(a, x) && x !== b && x >= 0 && x < DOTS);
          if (c.length) lines.push([a, c[Math.floor(rng() * c.length)]]);
        }
      }
      m.shapes[s.round] = lines;
    }
    if (s.stage !== 'draw' || s.done[you]) return null;
    const mine = (s.mine || []).map(([a, b]) => (a < b ? a + '-' + b : b + '-' + a));
    const left = (m.shapes[s.round] || []).filter(([a, b]) => !mine.includes(a < b ? a + '-' + b : b + '-' + a));
    if (!left.length) return { type: 'done', botDelayMs: (400 + rng() * 500) * L.think };
    return { type: 'line', a: left[0][0], b: left[0][1], botDelayMs: (mine.length ? 500 + rng() * 400 : react() + 400) * L.think };
  },
  'cannon-lob'({ s, you, el, level, L, rng, m, at }) {
    const me = s.cannons[you];
    if (s.shots.some((x) => x.slot === you)) {
      m.plan = null; // (away: a fresh one for the next shot)
      return null;
    }
    if (me.charging) {
      if (!m.plan || m.plan.chargeT === undefined) return { type: 'fire', botDelayMs: 300 };
      return { type: 'fire', t: Math.round(m.plan.chargeT + m.plan.hold), ...at(m.plan.chargeT + m.plan.hold) };
    }
    if (!me.ready) return null;
    if (!m.plan) {
      // Works out an angle and power for the wind (as players learn to), then aims a bit off.
      const wind = level === 'easy' ? s.wind * 0.5 : s.wind;
      const shot = aimCannon(you, s.towers[1 - you].blocks, wind);
      const angle = clamp(Math.round(shot.angle + gauss(rng) * L.angle), CANNON.ANGLE.min, CANNON.ANGLE.max);
      m.plan = { angle, hold: clamp(shot.power * CANNON.CHARGE_MS + gauss(rng) * L.hold, 0, CANNON.CHARGE_MS), ms: (700 + rng() * 800) * L.think };
    }
    if (me.angle !== m.plan.angle) return { type: 'aim', angle: m.plan.angle, botDelayMs: m.plan.ms };
    if (m.plan.chargeT === undefined || m.plan.chargeT < el - 500) m.plan.chargeT = el + 200;
    return { type: 'charge', t: Math.round(m.plan.chargeT), ...at(m.plan.chargeT) };
  },
  'stack-attack'({ s, you, el, level, L, rng, m, react }) {
    // Where its tray will be when this move lands (it's sliding at the speed it last set: seen
    // from how far it went since the last look), so it eases in rather than overshooting.
    const now = s.trays[you].x;
    const seen = m.tray && el > m.tray.el ? (now - m.tray.x) / (el - m.tray.el) : 0;
    m.tray = { x: now, el };
    const delay = react() * 0.7;
    const tray = clamp(now + seen * delay, 0, 1);
    const crate = s.crates.filter((c) => c.left > 0).sort((a, b) => a.left - b.left)[0];
    if (!crate) return { type: 'move', x: 0, botDelayMs: react() };
    // Under it, and (Normal, Hard) a little off-centre the other way when the stack leans.
    const fix = { easy: 0, normal: 0.5, hard: 0.85 }[level];
    const lean = s.stacks[you].lean;
    const target = crate.x + clamp(lean / LEAN_PER, -0.7, 0.7) * CATCH * fix + gauss(rng) * L.aim * 0.5;
    const gap = target - tray;
    // (enough speed to close the gap over about the time until its next move)
    const v = Math.abs(gap) < 0.015 ? 0 : clamp(gap / (SPEED_TRAY * 0.35), -1, 1);
    return { type: 'move', x: Math.round(v * 100) / 100, botDelayMs: delay };
  },
  'bumper-cars'({ s, you, level, el, L, rng, m, react }) {
    const me = s.cars[you];
    const foe = s.cars[1 - you];
    // Where its rival's heading (from where it saw it last), for Normal and Hard to lead it.
    // (over a tenth of a second or more: the cars move in steps, and it may look between them)
    if (!m.prev) m.prev = { x: foe.x, y: foe.y, t: el };
    if (el - m.prev.t >= 100) {
      const cap = MAX_CAR_SPEED * 1.5;
      m.v = { x: clamp(((foe.x - m.prev.x) * 1000) / (el - m.prev.t), -cap, cap), y: clamp(((foe.y - m.prev.y) * 1000) / (el - m.prev.t), -cap, cap) };
      m.prev = { x: foe.x, y: foe.y, t: el };
    }
    const fvx = m.v ? m.v.x : 0;
    const fvy = m.v ? m.v.y : 0;
    // Hard keeps its nose to a rival coming at its side or back (a head-on bump scores nothing).
    const toFoe = Math.atan2(foe.y - me.y, foe.x - me.x);
    const near = Math.hypot(foe.x - me.x, foe.y - me.y);
    const coming = (fvx * (me.x - foe.x) + fvy * (me.y - foe.y)) / (near || 1) > 2;
    const exposed = Math.abs(Math.atan2(Math.sin(toFoe - me.h), Math.cos(toFoe - me.h))) > FRONT_CONE;
    if (level === 'hard' && !me.spinning && !foe.spinning && coming && exposed && near < 3.2) {
      const wob = gauss(rng) * L.aim * 3;
      return { type: 'move', x: Math.cos(toFoe + wob), y: Math.sin(toFoe + wob), botDelayMs: react() * 0.6 };
    }
    // Their side or back: if it's in front of their nose, round them first.
    const toMe = Math.atan2(me.y - foe.y, me.x - foe.x);
    const facing = Math.abs(Math.atan2(Math.sin(toMe - foe.h), Math.cos(toMe - foe.h))) < FRONT_CONE + 0.3;
    const lead = { easy: 0, normal: 0.35, hard: 0.55 }[level] || 0;
    let tx = foe.x + fvx * lead;
    let ty = foe.y + fvy * lead;
    if (facing && !foe.spinning) {
      const side = Math.sin(toMe - foe.h) > 0 ? 1 : -1;
      tx += Math.cos(foe.h + side * Math.PI / 2) * 1.6;
      ty += Math.sin(foe.h + side * Math.PI / 2) * 1.6;
    }
    if (Math.hypot(tx, ty) > s.arena - 1) [tx, ty] = [tx * 0.8, ty * 0.8];
    const dir = unit(tx - me.x, ty - me.y);
    const wob = gauss(rng) * L.aim * 4;
    return { type: 'move', x: dir.x * Math.cos(wob) - dir.y * Math.sin(wob), y: dir.x * Math.sin(wob) + dir.y * Math.cos(wob), botDelayMs: react() * 0.7 };
  },
  'paint-grab'({ s, you, L, rng, m, react }) {
    const me = s.players[you];
    const mine = String(you);
    const theirs = String(1 - you);
    let target = null;
    if (s.bucket && Math.hypot(s.bucket.c + 0.5 - me.x, s.bucket.r + 0.5 - me.y) < 5) target = { c: s.bucket.c, r: s.bucket.r };
    else {
      const keep = m.tile && s.tiles[m.tile.r * s.cols + m.tile.c] !== mine ? m.tile : null;
      if (keep) target = keep;
      else {
        // The nearest tile that isn't its colour (theirs a bit sooner).
        let best = null;
        for (let r = 0; r < s.rows; r++) {
          for (let c = 0; c < s.cols; c++) {
            const t = s.tiles[r * s.cols + c];
            if (t === mine) continue;
            const d = Math.hypot(c + 0.5 - me.x, r + 0.5 - me.y) - (t === theirs ? 0.8 : 0) + rng() * 0.5;
            if (!best || d < best.d) best = { c, r, d };
          }
        }
        target = best;
      }
    }
    if (!target) return { type: 'move', x: 0, y: 0, botDelayMs: react() };
    m.tile = { c: target.c, r: target.r };
    const dir = unit(target.c + 0.5 - me.x + gauss(rng) * L.aim * 3, target.r + 0.5 - me.y + gauss(rng) * L.aim * 3);
    return { type: 'move', x: dir.x, y: dir.y, botDelayMs: react() * 0.7 };
  },
  'drum-beat'({ s, you, el, L, rng, m, at }) {
    // The next note it hasn't hit, timed with a person's error (now and then the wrong lane).
    const mine = new Set(s.hits[you]);
    m.plan = m.plan || {};
    const i = s.chart.findIndex((n, k) => !mine.has(k) && !(m.plan[k] && m.plan[k].sent) && n.t > el - DRUM.WINDOWS.good + 20);
    if (i === -1) return null;
    const n = s.chart[i];
    if (!m.plan[i]) m.plan[i] = { t: Math.max(0, n.t + gauss(rng) * L.timing), lane: rng() < L.slip ? (n.lane + 1) % s.lanes : n.lane };
    const p = m.plan[i];
    if (el > p.t + 25) {
      p.sent = true; // (its moment's gone, hit or not: on to the next)
      return null;
    }
    return { type: 'hit', lane: p.lane, t: Math.round(p.t), botFor: 'note' + i, ...at(p.t) };
  },
  'musical-chairs'({ s, you, el, L, rng, m, react }) {
    if (s.sat[you] || el < s.trippedUntil[you] || s.stage === 'done') return null;
    const r = (m.rounds = m.rounds || {});
    if (!r[s.round]) r[s.round] = { rt: react(), fooled: rng() < L.slip * 3 };
    if (s.stage === 'stopped') return { type: 'sit', rt: Math.round(r[s.round].rt), botDelayMs: r[s.round].rt, botFor: 'stop' + s.round };
    // A dip in the music fools it now and then (Easy most).
    if (s.stage === 'dip' && r[s.round].fooled) {
      r[s.round].fooled = false;
      return { type: 'sit', rt: Math.round(r[s.round].rt), botDelayMs: r[s.round].rt, botFor: 'dip' + s.round };
    }
    return null;
  },
  archery({ s, you, el, L, rng, m, react, at }) {
    const n = s.arrows[you].length;
    if (n >= s.arrowsEach) return null;
    // Each arrow: aim off for the wind (not quite right), draw, then let go in the steady spell,
    // at a moment the sight's near still (Hard picks it well; Easy any time it's steady).
    if (!m.arrow || m.arrow.n !== n) m.arrow = { n, x: -s.wind + gauss(rng) * L.aim * 4, y: gauss(rng) * L.aim * 3, shot: null };
    const a = m.arrow;
    const aim = s.aims[you];
    if (Math.abs(aim.x - a.x) > 0.01 || Math.abs(aim.y - a.y) > 0.01) return { type: 'aim', x: Math.round(a.x * 1000) / 1000, y: Math.round(a.y * 1000) / 1000, botDelayMs: react() };
    const drawnAt = s.drawnAt[you];
    if (drawnAt === null) {
      const t = el + react();
      return { type: 'draw', on: true, t: Math.round(t), ...at(t) };
    }
    if (a.shot === null) {
      const from = drawnAt + 1300;
      const to = drawnAt + 3200;
      let best = from + rng() * (to - from);
      if (L.timing < 60) {
        for (let t = from; t < to; t += 20) if (Math.hypot(...ARCHERY.swayAt(t, s.seeds[you], drawnAt)) < Math.hypot(...ARCHERY.swayAt(best, s.seeds[you], drawnAt))) best = t;
      }
      a.shot = Math.max(el + 30, best + gauss(rng) * L.timing);
    }
    return { type: 'shoot', t: Math.round(a.shot), botFor: 'arrow' + n, ...at(a.shot) };
  },
  curling({ s, you, el, L, rng, m, react }) {
    if (s.turn !== you) return null;
    if (s.phase === 'aim') {
      // Draw to the button; Hard knocks out a rival stone sitting nearer the button than its own.
      const d = (st) => Math.hypot(st.x, st.z - CURL.SHEET.button);
      const near = s.stones.slice().sort((p, q) => d(p) - d(q))[0];
      let x = 0;
      let z = CURL.SHEET.button;
      let power = (Math.sqrt(2 * CURL.ICE.decel * z) - CURL.THROW.minSpeed) / (CURL.THROW.maxSpeed - CURL.THROW.minSpeed);
      if (near && near.slot !== you && d(near) < CURL.SHEET.house && L.timing < 60) {
        x = near.x;
        z = near.z;
        power = 1;
      }
      const aim = Math.atan2(x, z) / CURL.THROW.maxAngle + gauss(rng) * L.aim * 5;
      return { type: 'throw', aim: Math.round(aim * 1000) / 1000, power: Math.round(clamp(power + gauss(rng) * L.aim * 1.2, 0, 1) * 1000) / 1000, curl: 0, botDelayMs: (1500 + rng() * 1500) * L.think };
    }
    // Sliding: sweep while its stone looks like stopping short of the button.
    const mine = s.stones.filter((st) => st.slot === you && st.moving).sort((p, q) => q.z - p.z)[0];
    if (!mine) return null;
    let v = 0;
    if (m.prev && el > m.prev.t + 80) v = ((mine.z - m.prev.z) * 1000) / (el - m.prev.t);
    if (!m.prev || el > m.prev.t + 80) m.prev = { z: mine.z, t: el };
    const stopsAt = mine.z + (v * v) / (2 * CURL.ICE.decel);
    if (v > 0 && stopsAt < CURL.SHEET.button - 0.2) return { type: 'sweep', botDelayMs: (1000 / L.rate) * (0.8 + rng() * 0.4) };
    return null;
  },
};

/** Cannon Lob: an angle and power that land on the rival's tower in this wind (a search of shots). */
export function aimCannon(slot, blocks, wind) {
  const dir = slot === 0 ? 1 : -1;
  const tx = CANNON.TOWER_X[1 - slot];
  const top = Math.max(1, blocks) * CANNON.BLOCK_H;
  let best = { angle: 45, power: 0.7, miss: Infinity };
  for (let angle = 25; angle <= 75; angle += 2) {
    for (let power = 0.3; power <= 1.001; power += 0.02) {
      const a = (angle * Math.PI) / 180;
      const v = CANNON.SPEED.min + (CANNON.SPEED.max - CANNON.SPEED.min) * power;
      let x = CANNON.CANNON_X[slot] + dir * 3 * Math.cos(a);
      let y = CANNON.CANNON_Y + 3 * Math.sin(a);
      let vx = dir * v * Math.cos(a);
      let vy = v * Math.sin(a);
      let miss = Infinity;
      for (let i = 0; i < 2000; i++) {
        const dt = 0.01;
        vx += wind * dt;
        vy -= CANNON.GRAVITY * dt;
        x += vx * dt;
        y += vy * dt;
        if (Math.abs(x - CANNON.WALL.x) < CANNON.WALL.w / 2 + 1 && y < CANNON.WALL.h + 1) break; // the wall
        if (Math.abs(x - tx) < CANNON.BLOCK_W / 2 + 1 && y < top + 1) { miss = Math.abs(y - top / 2) / 10; break; } // the tower (its middle best)
        if (y <= 0) { miss = Math.abs(x - tx); break; }
      }
      const score = miss + Math.abs(angle - 50) * 0.002;
      if (score < best.miss) best = { angle, power, miss: score };
    }
  }
  return best;
}
