// Party Board: a Mario Party-style board for two. Take turns rolling and
// walking around the island, collect coins, buy ⭐ stars (20 🪙), and play a
// party minigame after every round. Most stars after the last turn wins;
// coins break ties. The minigames are Party Minigames' (server/games/minis/).

import { MAPS } from './board/maps.js';
import { PARTIES } from './minis/index.js';
import { OneMini, Playlist } from './minis/runner.js';
import { poolFor } from './party-minis.js';
import { settingOf } from './options.js';

export const TIMING = { stepMs: 250, promptMs: 15000, messageMs: 1500, bonusMs: 4000, rollMs: 800 };
export const START_COINS = 10;
export const STAR_PRICE = 20;
export const MINI_PRIZE = { win: 10, draw: 3 };
export const SPACE_COINS = { blue: 3, red: -3 };
export const MAX_ITEMS = 3;
/** The shop, in the order it lists them. */
export const ITEMS = {
  mushroom: { name: '🍄 Mushroom', price: 5, what: '+3 to your roll' },
  'coin-thief': { name: '🦹 Coin Thief', price: 8, what: 'steal up to 10 🪙' },
  double: { name: '🎲 Double Dice', price: 10, what: 'roll two dice' },
  warp: { name: '🌀 Warp', price: 10, what: 'swap places with your rival' },
  'star-thief': { name: '👻 Star Thief', price: 35, what: 'steal a ⭐' },
};
export const EVENTS = ['shower', 'swap', 'steal', 'lucky', 'star'];
export const EVENT_COINS = { shower: 5, steal: 5, lucky: 10 };
export const HAZARDS = ['thunder', 'skull', 'tornado'];
export const HARSH = { share: 0.15, min: 2, skullCoins: 10 };
export const SLOT = { reels: 3, faces: 5, three: 15, pair: 5, none: 1 };

export class PartyBoard {
  /** map: a map object (tests), else the 'map' setting: a map id or 'random'. */
  constructor(ctx, rng = Math.random, map = null, pool = PARTIES) {
    this.ctx = ctx;
    this.rng = rng;
    this.mapChoice = map || settingOf(ctx, 'map', 'random');
    this.map = MAPS.island;
    this.pool = poolFor(pool, settingOf(ctx, 'style', 'mix'));
    this.turns = settingOf(ctx, 'turns', 10);
    this.bonusOn = settingOf(ctx, 'bonus', 1) === 1;
    this.harsh = settingOf(ctx, 'harsh', 0) === 1;
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
    this.map = this.pickMap();
    this.board = this.map.spaces.map((sp) => ({ ...sp })); // this match's copy (Harsh mode changes it)
    if (this.harsh) this.placeHazards();
    this.players = [0, 1].map(() => ({ space: 0, coins: START_COINS, stars: 0, items: [], earned: 0, minigames: 0 }));
    this.playlist = new Playlist(this.pool.map((d) => d.id), this.rng); // one per match: no repeats until all are played
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
    return this.board;
  }

  /** Harsh mode: turn ~15% of the plain spaces into hazards (never the start, stars, forks or warp exits). */
  placeHazards() {
    const exits = new Set(this.board.filter((sp) => sp.type === 'warp').map((sp) => sp.warp));
    const spots = this.board.map((sp, i) => i).filter((i) => {
      const sp = this.board[i];
      return i !== 0 && (sp.type === 'blue' || sp.type === 'red') && !sp.starCandidate && sp.next.length === 1 && !exits.has(i);
    });
    const plain = this.board.filter((sp) => sp.type === 'blue' || sp.type === 'red').length;
    const n = Math.min(spots.length, Math.max(HARSH.min, Math.round(plain * HARSH.share)));
    for (let k = 0; k < n; k++) {
      const i = spots.splice(Math.floor(this.rng() * spots.length), 1)[0];
      this.board[i].type = HAZARDS[Math.floor(this.rng() * HAZARDS.length)];
    }
  }

  pickMap() {
    const c = this.mapChoice;
    if (typeof c === 'object') return c;
    if (c === 'random') {
      const ids = Object.keys(MAPS);
      return MAPS[ids[Math.floor(this.rng() * ids.length)]];
    }
    return MAPS[c] || MAPS.island;
  }

  get starPrice() {
    return this.map.starPrice || STAR_PRICE;
  }

  /** An item's price on this map (Volcano Peak's shop costs 50% more). */
  price(id) {
    return Math.round(ITEMS[id].price * (this.map.shopMarkup || 1));
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
  ask(kind, options, onAnswer, fallback, extra) {
    if (this.prompt) this.ctx.clearTimeout(this.prompt.timer);
    const prompt = { slot: this.turn, kind, options, deadline: this.ctx.now() + TIMING.promptMs, onAnswer, extra };
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
    const usable = this.usableItems(this.turn);
    if (!usable.length) return this.rollPrompt();
    this.ask('item', usable.concat('none'), (id) => this.useItem(id), 'none');
  }

  /** The items `slot` can use now (each kind once; the star thief only if the rival has a star). */
  usableItems(slot) {
    const rival = this.players[1 - slot];
    return Object.keys(ITEMS).filter((id) => this.players[slot].items.includes(id) && (id !== 'star-thief' || rival.stars > 0));
  }

  useItem(id) {
    if (id === 'none') return this.rollPrompt();
    const slot = this.turn;
    const me = this.players[slot];
    const rival = this.players[1 - slot];
    me.items.splice(me.items.indexOf(id), 1);
    if (id === 'mushroom') this.turnState.mushroom = true;
    if (id === 'double') this.turnState.double = true;
    if (id === 'warp') [me.space, rival.space] = [rival.space, me.space];
    if (id === 'coin-thief') this.coins(slot, -this.coins(1 - slot, -10));
    if (id === 'star-thief') {
      rival.stars--;
      me.stars++;
    }
    this.say(ITEMS[id].name + '!');
    this.ctx.update();
    this.after(() => this.rollPrompt(), TIMING.messageMs);
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

  /** One hop on: at a fork, the player picks the way first. */
  walk(left) {
    const here = this.spaces[this.players[this.turn].space];
    if (here.next.length === 2) return this.forkPrompt(here.next, (to) => this.hop(to, left));
    this.hop(here.next[0], left);
  }

  hop(to, left) {
    this.players[this.turn].space = to;
    left--;
    this.ctx.update();
    if (left === 0) return this.after(() => this.land(), TIMING.stepMs);
    this.passBy(() => this.after(() => this.walk(left), TIMING.stepMs));
  }

  /** What lies ahead from space `i`: the next 4 spaces' types ('star' for the star). */
  preview(i) {
    const out = [];
    for (let k = 0; k < 4; k++) {
      out.push(i === this.star ? 'star' : this.spaces[i].type);
      i = this.spaces[i].next[0];
    }
    return out;
  }

  forkPrompt(ways, go) {
    this.ask('path', ['0', '1'], (v) => go(ways[Number(v)]), '0', { previews: ways.map((i) => this.preview(i)) });
  }

  /** On a space while walking past it: the star and the shop can stop you; then `next`. */
  passBy(next) {
    const slot = this.turn;
    const space = this.players[slot].space;
    if (space === this.star && this.players[slot].coins >= this.starPrice) return this.starPrompt(next);
    if (this.spaces[space].type === 'shop' && this.shopItems(slot).length) return this.shopPrompt(next);
    next();
  }

  /** Buy the star? `landed`: on its space, where "no" still pays the space's blue +3. */
  starPrompt(next, landed) {
    this.ask('star', ['yes', 'no'], (v) => {
      if (v !== 'yes' && landed) this.say(`+${this.coins(this.turn, SPACE_COINS.blue)} 🪙`);
      if (v === 'yes') {
        this.coins(this.turn, -this.starPrice);
        this.players[this.turn].stars++;
        this.star = this.pickStar(this.star);
        this.say('⭐ Got a star!');
      }
      this.ctx.update();
      next();
    }, 'no');
  }

  /** What `slot` can buy: affordable, with a free item slot. */
  shopItems(slot) {
    const p = this.players[slot];
    if (p.items.length >= MAX_ITEMS) return [];
    return Object.keys(ITEMS).filter((id) => this.price(id) <= p.coins);
  }

  shopPrompt(next) {
    this.ask('shop', this.shopItems(this.turn).concat('none'), (id) => {
      if (id !== 'none') {
        this.coins(this.turn, -this.price(id));
        this.players[this.turn].items.push(id);
        this.say('🛒 Bought ' + ITEMS[id].name);
      }
      this.ctx.update();
      next();
    }, 'none');
  }

  land() {
    const slot = this.turn;
    const space = this.players[slot].space;
    const type = this.spaces[space].type;
    const done = () => {
      this.ctx.update();
      this.after(() => this.endTurn(), TIMING.messageMs);
    };
    if (space === this.star && this.players[slot].coins >= this.starPrice) return this.starPrompt(done, true);
    if (type === 'shop') {
      if (this.shopItems(slot).length) return this.shopPrompt(done);
      this.say('🛒 Nothing you can buy');
      return done();
    }
    if (type === 'event') {
      this.event(EVENTS[Math.floor(this.rng() * EVENTS.length)]);
      return done();
    }
    if (type === 'bonus') return this.slot(done);
    if (type === 'thunder') {
      const lost = -this.coins(slot, -Math.floor(this.players[slot].coins / 2));
      this.say(`⚡ Thunder! −${lost} 🪙`);
      return done();
    }
    if (type === 'skull') {
      if (this.players[slot].stars > 0) {
        this.players[slot].stars--;
        this.say('💀 Skull! −1 ⭐');
      } else this.say(`💀 Skull! −${-this.coins(slot, -HARSH.skullCoins)} 🪙`);
      return done();
    }
    if (type === 'tornado') {
      const spots = this.spaces.map((sp, i) => i).filter((i) => i !== 0 && i !== space);
      this.players[slot].space = spots[Math.floor(this.rng() * spots.length)];
      this.say('🌪️ Tornado!');
      return done();
    }
    if (type === 'warp') {
      this.players[slot].space = this.spaces[space].warp;
      this.say('🌀 Warp!');
      return done();
    }
    const n = this.coins(slot, type === 'red' ? SPACE_COINS.red : SPACE_COINS.blue);
    this.say(n >= 0 ? `+${n} 🪙` : `${n} 🪙`);
    done();
  }

  event(kind) {
    const slot = this.turn;
    const me = this.players[slot];
    const rival = this.players[1 - slot];
    if (kind === 'shower') {
      this.coins(0, EVENT_COINS.shower);
      this.coins(1, EVENT_COINS.shower);
      this.say('🌧️ Coin shower! +5 🪙 each');
    } else if (kind === 'swap') {
      [me.space, rival.space] = [rival.space, me.space];
      this.say('🔀 Swap places!');
    } else if (kind === 'steal') {
      const n = -this.coins(1 - slot, -EVENT_COINS.steal);
      this.coins(slot, n);
      this.say(`💰 Stole ${n} 🪙`);
    } else if (kind === 'lucky') {
      this.coins(slot, EVENT_COINS.lucky);
      this.say('🍀 Lucky! +10 🪙');
    } else {
      this.star = this.pickStar(this.star);
      this.say('👻 The star moved!');
    }
    this.lastEvent = kind;
  }

  /** The bonus space's slot machine: stop three reels (1-5); three of a kind, a pair, or a consolation coin. */
  slot(done) {
    const reels = [];
    const spin = () => {
      this.ask('slot', ['stop'], (v) => {
        do reels.push(1 + Math.floor(this.rng() * SLOT.faces));
        while (v === 'stop-all' && reels.length < SLOT.reels);
        if (reels.length < SLOT.reels) return spin();
        const kinds = new Set(reels).size;
        const n = kinds === 1 ? SLOT.three : kinds === 2 ? SLOT.pair : SLOT.none;
        this.coins(this.turn, n);
        this.slotReels = reels.slice();
        this.say(`🎰 ${reels.join(' ')}: +${n} 🪙`);
        done();
      }, 'stop-all', { reels: reels.slice() });
    };
    spin();
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
    }, this.playlist);
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
    const v = {
      phase: this.phase,
      round: this.round,
      turns: this.turns,
      turn: this.turn,
      players: this.players,
      board: { name: this.map.name, tier: this.map.tier, spaces: this.spaces, star: this.star, starPrice: this.starPrice },
      prompt: p ? { slot: p.slot, kind: p.kind, options: p.options, msLeft: Math.max(0, p.deadline - this.ctx.now()), extra: p.extra || null } : null,
      dice: this.dice,
      items: Object.fromEntries(Object.keys(ITEMS).map((id) => [id, { ...ITEMS[id], price: this.price(id) }])),
      message: this.message,
      mini: this.mini ? (slot === null ? this.mini.hostView() : this.mini.playerView(slot)) : null,
      bonusStars: this.bonusStars,
      winner: this.winner,
      draw: this.draw,
      scores: this.players.map((x) => x.stars),
    };
    // Minigames update up to 20 times a second and don't show the board: leave it out.
    if (this.phase === 'minigame') {
      delete v.board;
      delete v.items;
    }
    return v;
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
