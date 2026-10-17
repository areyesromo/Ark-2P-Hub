// Party Board: a Mario Party-style board for two. Take turns rolling and
// walking around the island, collect coins, buy ⭐ stars (20 🪙), and play a
// party minigame after every round. Most stars after the last turn wins;
// coins break ties. The minigames are Party Minigames' (server/games/minis/).

import { MAPS } from './board/maps.js';
import { PARTIES } from './minis/index.js';
import { OneMini } from './minis/runner.js';
import { poolFor } from './party-minis.js';
import { settingOf } from './options.js';

export const TIMING = { stepMs: 250, promptMs: 15000, messageMs: 1500, bonusMs: 4000, rollMs: 800 };
export const START_COINS = 10;
export const STAR_PRICE = 20;
export const MINI_PRIZE = { win: 10, draw: 3 };
export const SPACE_COINS = { blue: 3, red: -3 };

export class PartyBoard {
  constructor(ctx, rng = Math.random, map = MAPS.island, pool = PARTIES) {
    this.ctx = ctx;
    this.rng = rng;
    this.map = map;
    this.pool = poolFor(pool, settingOf(ctx, 'style', 'mix'));
    this.turns = settingOf(ctx, 'turns', 10);
    this.bonusOn = settingOf(ctx, 'bonus', 1) === 1;
    this.epoch = 0;
    this.timers = [];
  }

  // ---- timers (every callback dies with a rematch) ----
  after(fn, ms) {
    const e = this.epoch;
    const t = this.ctx.setTimeout(() => {
      this.timers = this.timers.filter((x) => x !== t);
      if (e === this.epoch) fn();
    }, ms);
    this.timers.push(t);
    return t;
  }

  clearTimers() {
    this.timers.forEach((t) => this.ctx.clearTimeout(t));
    this.timers = [];
  }

  start() {
    this.epoch++;
    this.clearTimers();
    this.players = [0, 1].map(() => ({ space: 0, coins: START_COINS, stars: 0, items: [], earned: 0, minigames: 0 }));
    this.star = this.pickStar(null);
    this.round = 1;
    this.turn = 0;
    this.phase = 'board';
    this.prompt = null;
    this.dice = null;
    this.message = null;
    this.mini = null;
    this.bonusStars = null;
    this.winner = null;
    this.draw = false;
    this.turnStart();
  }

  get spaces() {
    return this.map.spaces;
  }

  pickStar(not) {
    const c = this.spaces.map((s, i) => (s.starCandidate && i !== not ? i : -1)).filter((i) => i >= 0);
    return c[Math.floor(this.rng() * c.length)];
  }

  die() {
    return 1 + Math.floor(this.rng() * 10);
  }

  /** Add (or take, never below 0) coins; gains count towards the coin star. */
  coins(slot, n) {
    const p = this.players[slot];
    const before = p.coins;
    p.coins = Math.max(0, p.coins + n);
    if (n > 0) p.earned += n;
    return p.coins - before;
  }

  say(message) {
    this.message = message;
  }

  // ---- prompts ----
  ask(kind, options, onAnswer, fallback) {
    const prompt = { slot: this.turn, kind, options, deadline: this.ctx.now() + TIMING.promptMs, onAnswer };
    prompt.timer = this.after(() => this.answer(fallback), TIMING.promptMs);
    this.prompt = prompt;
    this.ctx.update();
  }

  answer(value) {
    const p = this.prompt;
    if (!p) return;
    this.ctx.clearTimeout(p.timer);
    this.prompt = null;
    p.onAnswer(value);
  }

  // ---- a turn ----
  turnStart() {
    this.dice = null;
    this.turnState = { mushroom: false, double: false };
    this.rollPrompt();
  }

  rollPrompt() {
    this.ask('roll', ['roll'], () => this.roll(), 'roll');
  }

  roll() {
    const ts = this.turnState;
    const values = ts.double ? [this.die(), this.die()] : [this.die()];
    const total = values.reduce((a, b) => a + b, 0) + (ts.mushroom ? 3 : 0);
    this.dice = { values, total, bonus: ts.mushroom ? 3 : 0 };
    this.ctx.update();
    this.after(() => this.walk(total), TIMING.rollMs + TIMING.stepMs); // the dice show, then one hop per step
  }

  walk(left) {
    const p = this.players[this.turn];
    p.space = (p.space + 1) % this.spaces.length;
    left--;
    this.ctx.update();
    if (left > 0) this.after(() => this.walk(left), TIMING.stepMs);
    else this.after(() => this.land(), TIMING.stepMs);
  }

  land() {
    const slot = this.turn;
    const type = this.spaces[this.players[slot].space].type;
    const n = this.coins(slot, type === 'red' ? SPACE_COINS.red : SPACE_COINS.blue);
    this.say(n >= 0 ? `+${n} 🪙` : `${n} 🪙`);
    this.ctx.update();
    this.after(() => this.endTurn(), TIMING.messageMs);
  }

  endTurn() {
    this.message = null;
    this.dice = null;
    if (this.turn === 0) {
      this.turn = 1;
      return this.turnStart();
    }
    this.startMinigame();
  }

  // ---- the minigame after each round ----
  startMinigame() {
    const e = this.epoch;
    this.phase = 'minigame';
    this.mini = new OneMini(this.ctx, this.pool, this.rng, (r) => {
      if (e === this.epoch) this.miniDone(r);
    });
    this.mini.start();
  }

  miniDone(result) {
    this.mini = null;
    this.phase = 'board';
    if (result.winner === 0 || result.winner === 1) {
      this.coins(result.winner, MINI_PRIZE.win);
      this.players[result.winner].minigames++;
    } else {
      this.coins(0, MINI_PRIZE.draw);
      this.coins(1, MINI_PRIZE.draw);
    }
    if (this.round >= this.turns) return this.finishGame();
    this.round++;
    this.turn = 0;
    this.turnStart();
  }

  // ---- the end ----
  finishGame() {
    if (!this.bonusOn) return this.over();
    const best = (key) => {
      const [a, b] = this.players.map((p) => p[key]);
      return a === b ? [0, 1] : a > b ? [0] : [1];
    };
    this.bonusStars = [{ kind: 'minigame', slots: best('minigames') }, { kind: 'coin', slots: best('earned') }];
    this.bonusStars.forEach((b) => b.slots.forEach((s) => this.players[s].stars++));
    this.phase = 'bonus';
    this.ctx.update();
    this.after(() => this.over(), TIMING.bonusMs);
  }

  over() {
    const [a, b] = this.players;
    const cmp = a.stars !== b.stars ? a.stars - b.stars : a.coins - b.coins;
    this.winner = cmp === 0 ? null : cmp > 0 ? 0 : 1;
    this.draw = cmp === 0;
    this.phase = 'over';
    this.ctx.update();
  }

  onInput(slot, input) {
    if (!input || typeof input !== 'object') return;
    if (this.phase === 'minigame' && this.mini) return this.mini.onInput(slot, input);
    if (this.phase === 'over') {
      if (input.type === 'rematch') this.start();
      return;
    }
    const p = this.prompt;
    if (input.type !== 'choose' || !p || p.slot !== slot || !p.options.includes(input.value)) return;
    this.answer(input.value);
  }

  view(slot) {
    const p = this.prompt;
    return {
      phase: this.phase,
      round: this.round,
      turns: this.turns,
      turn: this.turn,
      players: this.players,
      board: { spaces: this.spaces, star: this.star },
      prompt: p ? { slot: p.slot, kind: p.kind, options: p.options, msLeft: Math.max(0, p.deadline - this.ctx.now()), extra: p.extra || null } : null,
      dice: this.dice,
      message: this.message,
      mini: this.mini ? (slot === null ? this.mini.hostView() : this.mini.playerView(slot)) : null,
      bonusStars: this.bonusStars,
      winner: this.winner,
      draw: this.draw,
      scores: this.players.map((x) => x.stars),
    };
  }

  hostView() {
    return Object.assign(this.view(null), { names: this.ctx.players.map((x) => x.name), localPlayers: this.ctx.players.map((x) => Boolean(x.local)) });
  }

  playerView(slot) {
    return Object.assign(this.view(slot), { you: slot, names: this.ctx.players.map((x) => x.name) });
  }
}

export default {
  id: 'party-board',
  name: 'Party Board',
  category: 'competitive',
  music: 'casual',
  tagline: 'A Mario Party-style board for two: roll, walk the island, grab coins, buy ⭐ stars, raid the shop for items, and battle in a party minigame every round. Most stars wins.',
  create: (ctx) => new PartyBoard(ctx),
};
