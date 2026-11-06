import { randomBytes, randomInt } from 'node:crypto';
import { getGame, listGames } from './games/index.js';
import { Tournament } from './tournament.js';
import { defaultProfile } from './profiles.js';
import { contextFor } from './trophies.js';

export const MAX_PLAYERS = 2;
const NAME_MAX = 16;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O, they look like 1 and 0
const CODE_LENGTH = 4;
const IDLE_ROOM_MS = 30 * 60 * 1000;

const newToken = () => randomBytes(16).toString('hex');

export const BOT_LEVELS = ['easy', 'normal', 'hard'];
export const BOT_NAME = 'Computer';
const BOT_THINK_MS = 1100; // the computer's pause before each move, so you can follow it

export function sanitizeName(name) {
  return String(name ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, NAME_MAX);
}

export function normalizeCode(code) {
  return String(code ?? '').trim().toUpperCase();
}

const isValidCode = (code) => code.length === CODE_LENGTH && [...code].every((c) => CODE_ALPHABET.includes(c));
const isValidToken = (t) => typeof t === 'string' && /^[0-9a-f]{32}$/.test(t);

/**
 * One TV + two players, each on a phone or on a controller plugged into the TV. The room owns the running game instance and is
 * the only thing that talks to Socket.IO on the game's behalf: games produce
 * views, the room pushes them out.
 */
export class Room {
  constructor(code, io, { stats = null, profiles = null, practice = null, trophies = null, hostToken = null } = {}) {
    this.code = code;
    this.io = io;
    this.stats = stats; // match history (see stats.js), optional
    this.practice = practice; // records against the computer (see practice.js), optional
    this.trophies = trophies; // each player's trophies (see trophies.js), optional
    this.trophyNews = null; // the trophies the last game earned, for the screens: { n, at, list }
    this.trophySeq = 0; // (each batch a new number, so the screens show each once)
    this.profiles = profiles; // avatars and colours (see profiles.js), optional
    this.hostToken = hostToken || newToken();
    this.hostSockets = new Set();
    this.players = Array(MAX_PLAYERS).fill(null);
    this.hostOrigin = null; // the address the TV opened, used to build the join link
    this.joinUrl = null;
    this.joinGuess = false; // true when the join address is probably unreachable (see network.js)
    this.qr = null;
    this.gameId = null;
    this.game = null;
    this.generation = 0;
    this.timers = new Set();
    this.saved = {}; // per game: what it asked to keep between launches (e.g. chosen settings)
    this.tournament = new Tournament(); // best of N games, off until the players turn it on
    this.touch();
  }

  get allChannel() { return `r:${this.code}`; }
  get hostChannel() { return `h:${this.code}`; }
  playerChannel(slot) { return `p:${this.code}:${slot}`; }

  touch() { this.lastActive = Date.now(); }

  isIdle(now = Date.now()) {
    const anyoneHere = this.hostSockets.size > 0 || this.players.some((p) => p && p.connected && !p.bot);
    return !anyoneHere && now - this.lastActive > IDLE_ROOM_MS;
  }

  // ---- players -----------------------------------------------------------

  /**
   * Seat a player. A matching token re-seats the same player (phone woke up,
   * page refreshed). Otherwise take a free slot, or a slot whose player has
   * gone away, so a lost phone never locks the room.
   *
   * `local` players use a controller on the TV: they have no socket of their
   * own, the TV sends their input, and they're present while the TV is.
   */
  seatPlayer(rawName, token, { local = false } = {}) {
    if (token) {
      const slot = this.players.findIndex((p) => p && p.token === token);
      if (slot !== -1 && Boolean(this.players[slot].local) === local) {
        const name = sanitizeName(rawName);
        if (name) this.players[slot].name = name;
        return { slot, player: this.players[slot], rejoined: true };
      }
    }
    const name = sanitizeName(rawName);
    if (!name) return { error: 'Please enter a name.' };

    // Same name as someone seated: while they're here, it's someone else (pick another name);
    // once their phone has gone, it's them coming back without their token (another browser,
    // cleared storage, the camera app's browser), so they get their seat back, not a second one.
    const same = this.players.findIndex((p) => p && p.name.toLowerCase() === name.toLowerCase());
    if (same !== -1) {
      const p = this.players[same];
      if (p.connected || p.local || local) {
        // `clash`: a phone seat that may only look connected (see player:join, which checks).
        return { error: `Someone here is already called ${p.name}. Pick another name.`, clash: !p.local && !local ? same : undefined };
      }
      p.token = newToken(); // the old device's token stops working
      p.name = name;
      return { slot: same, player: p, rejoined: true };
    }

    // A controller can't step into a phone-only game that's already running.
    const running = this.gameId && getGame(this.gameId);
    if (local && running && running.phoneOnly) return { error: `${running.name} needs two phones: join from the lobby.` };

    let slot = this.players.findIndex((p) => p === null);
    if (slot === -1) slot = this.players.findIndex((p) => p && !p.connected);
    if (slot === -1 && !this.game) slot = this.botSlot; // in the lobby, a person takes the computer's seat
    if (slot === -1) return { error: 'This room already has two players.' };

    const player = { name, token: newToken(), socketId: null, connected: local && this.hostSockets.size > 0, local };
    this.players[slot] = player;
    this.tournament.reset(); // someone new: a fresh series
    return { slot, player, rejoined: false };
  }

  /**
   * The computer opponent (see a game's `bot`): it takes the free seat, or changes level if it's
   * already here. It plays as a controller seat does (the game places its ships for it), from
   * its own player view.
   */
  seatBot(level) {
    if (!BOT_LEVELS.includes(level)) return { error: 'Pick a level: easy, normal or hard.' };
    const here = this.players.findIndex((p) => p && p.bot);
    if (here !== -1) {
      if (this.game) return { error: 'Finish this game first.' };
      if (this.players[here].bot !== level) this.tournament.reset(); // a new level: a new series
      this.players[here].bot = level;
      this.broadcastState();
      return { slot: here, ok: true };
    }
    if (this.game) return { error: 'Finish this game first.' };
    if (this.players.some((p) => p && p.name.toLowerCase() === BOT_NAME.toLowerCase())) return { error: `Someone here is already called ${BOT_NAME}.` };
    const slot = this.players.findIndex((p) => p === null);
    if (slot === -1) return { error: 'This room already has two players.' };
    this.players[slot] = { name: BOT_NAME, token: newToken(), socketId: null, connected: true, local: true, bot: level };
    this.tournament.reset();
    this.broadcastState();
    return { slot, ok: true };
  }

  /** The running game's definition, for its `bot`. */
  botDef() {
    return this.gameId ? getGame(this.gameId) : null;
  }

  get botSlot() {
    return this.players.findIndex((p) => p && p.bot);
  }

  /** Controller players come and go with the TV (the computer stays). Call after the host sockets change. */
  syncLocalPlayers() {
    const tvHere = this.hostSockets.size > 0;
    for (const p of this.players) if (p && p.local && !p.bot) p.connected = tvHere;
  }

  /** Rename a controller player (phones pick their name when they join). */
  renameLocal(slot, rawName) {
    const p = this.players[slot];
    if (!p || !p.local || p.bot) return { error: 'Only controller players can be renamed here.' };
    const name = sanitizeName(rawName);
    if (!name) return { error: 'Please enter a name.' };
    const other = this.players[1 - slot];
    if (other && other.name.toLowerCase() === name.toLowerCase()) return { error: 'The other player already has that name.' };
    p.name = name;
    this.broadcastState();
    return { ok: true, name };
  }

  removePlayer(slot) {
    if (!this.players[slot]) return;
    this.players[slot] = null;
    this.trophyNews = null; // (their trophies aren't news for whoever sits down next)
    this.tournament.reset();
    if (this.game) this.stopGame();
    else this.broadcastState();
  }

  get readyToPlay() {
    return this.players.every((p) => p && p.connected);
  }

  // ---- games -------------------------------------------------------------

  /** A random game for the "🎲 Random" button: not the one just played, and playable by these players. */
  pickRandomGame(rng = Math.random) {
    const allLocal = this.players.every((p) => p && p.local);
    const anyLocal = this.players.some((p) => p && p.local && !p.bot); // (the computer isn't a controller: it plays phone-only games)
    const bot = this.botSlot !== -1;
    let pool = listGames().filter((g) => !(g.needsPhone && allLocal) && !(g.phoneOnly && anyLocal) && (!bot || g.vsComputer));
    if (pool.length > 1) pool = pool.filter((g) => g.id !== this.lastGameId);
    return pool[Math.floor(rng() * pool.length)].id;
  }

  startGame(gameId) {
    if (gameId === 'random') gameId = this.pickRandomGame();
    const def = getGame(gameId);
    if (!def) return { error: 'Unknown game.' };
    if (!this.readyToPlay) return { error: 'Waiting for two players.' };
    if (def.phoneOnly && this.players.some((p) => p && p.local && !p.bot)) return { error: `${def.name} needs two phones.` };
    if (this.botSlot !== -1 && !def.bot) return { error: `${def.name} can't be played against the computer (yet).` };

    this.stopGame({ silent: true });
    this.trophyNews = null; // (last game's: gone with the new one)
    this.lastPhase = null;
    this.lastGameId = def.id;
    const generation = ++this.generation;
    const room = this;
    const live = () => room.generation === generation;

    const ctx = {
      get players() {
        return room.players.map((p, slot) => ({ slot, name: p ? p.name : `Player ${slot + 1}`, local: Boolean(p && p.local), connected: Boolean(p && p.connected), ...(p && p.bot ? { bot: p.bot } : {}) }));
      },
      now: () => Date.now(),
      // The fastest lap on a track in this game's history (Kart Race), or null.
      lapRecord: (track) => (room.stats ? room.stats.lapRecord(def.id, track) : null),
      // Kept by the room between launches of this game, e.g. the settings picked last time.
      saved: (this.saved[def.id] = this.saved[def.id] || {}),
      setTimeout(fn, ms) {
        const t = setTimeout(() => {
          room.timers.delete(t);
          if (live()) fn();
        }, ms);
        room.timers.add(t);
        return t;
      },
      clearTimeout(t) {
        clearTimeout(t);
        room.timers.delete(t);
      },
      update() {
        if (live()) room.pushGameViews();
      },
    };

    this.gameId = def.id;
    this.game = def.create(ctx);
    this.broadcastState();
    this.game.start();
    return { ok: true, gameId: def.id };
  }

  stopGame({ silent = false } = {}) {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.botTimer = null;
    this.botRetries = 0;
    this.botLastMove = null;
    this.botMemory = {}; // the computer's memory for a match (see a game's `bot`)
    this.botCache = null; // its last answer, for the position it was worked out for
    this.generation++;
    this.game = null;
    this.gameId = null;
    if (!silent) this.broadcastState();
  }

  /** The lobby's tournament controls: { bestOf } changes the length, { reset: true } starts over. */
  setTournament({ bestOf, reset } = {}) {
    if (reset) this.tournament.reset();
    else if (!this.tournament.setLength(Number(bestOf))) return { error: 'Pick off, 3, 5 or 7 games.' };
    this.touch();
    this.broadcastState();
    return { ok: true, tournament: this.tournament.view() };
  }

  handleInput(slot, input) {
    if (!this.game || !input || typeof input !== 'object') return;
    // (the computer's own moves aren't someone here: they don't keep an empty room alive)
    if (!(this.players[slot] && this.players[slot].bot)) this.touch();
    try {
      this.game.onInput(slot, input);
    } catch (err) {
      console.error(`[room ${this.code}] game input error:`, err);
    }
  }

  // ---- broadcasting ------------------------------------------------------

  publicState() {
    return {
      code: this.code,
      joinUrl: this.joinUrl,
      joinGuess: this.joinGuess,
      phase: this.game ? 'playing' : 'lobby',
      gameId: this.gameId,
      hostConnected: this.hostSockets.size > 0,
      readyToPlay: this.readyToPlay,
      players: this.players.map((p, slot) =>
        p ? { slot, name: p.name, connected: p.connected, local: Boolean(p.local), ...(p.bot ? { bot: p.bot } : {}), profile: p.bot ? { ...this.profileOf(p.name), avatar: '🤖' } : this.profileOf(p.name) } : null,
      ),
      games: this.lobbyGames(),
      h2h: this.headToHead(),
      tournament: this.tournament.view(),
      knownNames: this.stats ? this.stats.knownNames() : [],
      trophies: this.trophyNews && { n: this.trophyNews.n, list: this.trophyNews.list, ageMs: Date.now() - this.trophyNews.at }, // (old news isn't shown on a reload)
      // With the computer seated: the person's practice records, for the game cards.
      practice: this.botSlot !== -1 && this.practice ? this.practice.recordsFor((this.players.find((p) => p && !p.bot) || {}).name) : null,
    };
  }

  /** A name's avatar and colour (a default from the name when there's no profile store). */
  profileOf(name) {
    return this.profiles ? this.profiles.get(name) : defaultProfile(name);
  }

  /** A seated player's avatar and colour (set from their phone, or from the TV). */
  setProfile(slot, fields) {
    const p = Number.isInteger(slot) && slot >= 0 && slot < MAX_PLAYERS ? this.players[slot] : null;
    if (!p || !this.profiles) return { error: 'Nobody in that seat.' };
    if (p.bot) return { error: 'The computer keeps its 🤖.' };
    const profile = this.profiles.set(p.name, fields);
    if (!profile) return { error: 'Pick an avatar or a colour from the list.' };
    this.broadcastState();
    return { ok: true, profile };
  }

  broadcastState() {
    this.io.to(this.allChannel).emit('room:state', this.publicState());
  }

  pushGameViews() {
    if (!this.game) return;
    const { gameId } = this;
    const view = this.game.hostView();
    if (view.phase === 'over' && this.lastPhase !== 'over') this.recordResult(view);
    if (this.lastPhase === 'over' && view.phase !== 'over') { // a rematch: the computer starts afresh
      this.botMemory = {};
      this.botCache = null;
      this.botRetries = 0;
      this.botLastMove = null;
    }
    this.lastPhase = view.phase;
    this.io.to(this.hostChannel).emit('game:view', { gameId, view });
    this.players.forEach((p, slot) => {
      if (p) this.io.to(this.playerChannel(slot)).emit('game:view', { gameId, view: this.game.playerView(slot) });
    });
    this.driveBot();
  }

  /**
   * The computer's move, if it has one: it works it out when it sees the game, then plays it
   * after the move's pause (its reaction time, or time to think), unless by then it no longer
   * wants to move at all. One move is waiting at a time; stopping the game clears it.
   */
  driveBot() {
    const slot = this.botSlot;
    if (slot === -1 || !this.game) return;
    const def = this.botDef();
    // The same move again means the game refused it: `retries` lets the bot try something else.
    // One answer per position: the clock ticking down doesn't make it think again.
    const think = () => {
      try {
        if (!def || !def.bot || !this.game) return null;
        const view = this.game.botView ? this.game.botView(slot) : this.game.playerView(slot);
        const key = JSON.stringify(view, (k, v) => (k === 'timeLeftMs' || k === 'timeLeft' ? undefined : v)) + '|' + (this.botRetries || 0);
        if (this.botCache && this.botCache.def === def && this.botCache.key === key) return this.botCache.move;
        const move = def.bot(view, this.players[slot].bot, Math.random, this.botRetries || 0, this.botMemory);
        this.botCache = { def, key, move };
        return move;
      } catch (err) {
        console.error(`[room ${this.code}] computer move error:`, err);
        return null;
      }
    };
    const first = think(); // (every view is a look, so it remembers what it saw: Memory Match)
    if (!first && this.botTimer) {
      // The game moved on and it no longer wants that move (a grid ended, the turn passed).
      clearTimeout(this.botTimer);
      this.timers.delete(this.botTimer);
      this.botTimer = null;
    }
    if (!first || this.botTimer) return;
    const generation = this.generation;
    const t = setTimeout(() => {
      this.timers.delete(t);
      this.botTimer = null;
      if (this.generation !== generation || !this.game || !this.players[slot] || !this.players[slot].bot) return;
      // It plays what it worked out when it looked, a reaction time on (a person can't take in
      // what happened since any quicker); a fresh look only checks it still wants to move. A move
      // it saw coming and timed (botAnticipate: its own planned turn, say) is judged afresh.
      const fresh = think();
      if (!fresh) return;
      // A move meant for something that's gone (botFor: the piece it was for, say) isn't played.
      if (first.botFor !== undefined && fresh.botFor !== first.botFor) return this.driveBot();
      const { botDelayMs, botAnticipate, botFor, ...input } = first.botAnticipate ? fresh : first;
      const key = JSON.stringify(input);
      this.botRetries = key === this.botLastMove ? (this.botRetries || 0) + 1 : 0;
      this.botLastMove = key;
      this.handleInput(slot, input);
      this.driveBot(); // (in case that move was refused, or changed nothing on screen)
    }, Number.isFinite(first.botDelayMs) ? Math.max(0, first.botDelayMs) : BOT_THINK_MS);
    this.timers.add(t);
    this.botTimer = t;
  }

  /**
   * A match just ended: add it to the history. Competitive games report
   * winner (a slot, or null for a draw) and scores in their TV view; casual
   * games report the team's stars.
   */
  recordResult(view) {
    const def = getGame(this.gameId);
    const category = def.category || 'competitive';
    let title = null; // a series just won (for the Champion trophy)
    if (category !== 'casual' && this.tournament.record({ game: def.name, winner: view.winner })) {
      const t = this.tournament;
      if (t.champion !== null && this.botSlot === -1) { // (not a series against the computer)
        title = { slot: t.champion, bestOf: t.bestOf };
        if (this.stats) this.stats.recordTournament({ players: this.players.map((p, slot) => (p ? p.name : `Player ${slot + 1}`)), winner: t.champion, wins: t.wins.slice(), bestOf: t.bestOf });
      }
      this.broadcastState();
    }
    this.recordMatch(def, category, view);
    this.awardTrophies(def, category, view, title);
  }

  /** The match history (two people), or the person's practice record (against the computer). */
  recordMatch(def, category, view) {
    const bot = this.botSlot !== -1 ? this.players[this.botSlot] : null;
    if (bot) {
      // Practice: never in anyone's stats or the leaderboard.
      const slot = 1 - this.botSlot;
      const me = this.players[slot];
      if (!this.practice || !me) return;
      const won = view.winner === slot;
      const result = category === 'casual' ? {} : { result: won ? 'win' : view.winner === 0 || view.winner === 1 ? 'loss' : 'draw' };
      const stars = category === 'casual' ? { stars: Number(view.stars) || 0, maxStars: Number(view.maxStars) || 0 } : {};
      this.practice.record({ name: me.name, game: def.id, level: bot.bot, ...result, ...stars });
      return;
    }
    if (!this.stats) return;
    const match = {
      game: def.id,
      gameName: def.name,
      category,
      players: this.players.map((p, slot) => (p ? p.name : `Player ${slot + 1}`)),
    };
    if (category === 'casual') {
      match.stars = Number(view.stars) || 0;
      match.maxStars = Number(view.maxStars) || 0;
    } else {
      match.winner = view.winner === 0 || view.winner === 1 ? view.winner : null;
      match.draw = match.winner === null;
      match.scores = Array.isArray(view.scores) && view.scores.length === 2 ? view.scores.slice() : null;
      if (view.cup === true) match.cup = true; // a Kart Race cup
      // Best laps (Kart Race), for the lap records.
      const laps = Array.isArray(view.lapTimes)
        ? view.lapTimes.filter((l) => l && typeof l.track === 'string' && (l.slot === 0 || l.slot === 1) && Number.isFinite(l.ms) && l.ms > 0).map((l) => ({ track: l.track, player: l.slot, ms: l.ms }))
        : [];
      if (laps.length) match.laps = laps;
      // Reaction times at the start (Kart Race), for the best starts; faster than 0.1 s is a guess.
      const reactions = Array.isArray(view.reactionTimes)
        ? view.reactionTimes.filter((r) => r && (r.slot === 0 || r.slot === 1) && Number.isFinite(r.ms) && r.ms >= 100 && r.ms <= 2000).map((r) => ({ player: r.slot, ms: r.ms }))
        : [];
      if (reactions.length) match.reactions = reactions;
    }
    this.stats.record(match);
  }

  /** Each person's new trophies for this result, onto the screens. */
  awardTrophies(def, category, view, title) {
    if (!this.trophies) return;
    const bot = this.botSlot !== -1 ? this.players[this.botSlot].bot : null;
    const games = listGames();
    const list = [];
    this.players.forEach((p, slot) => {
      if (!p || p.bot) return;
      // (a game between two people counts towards the trophies' own tally of games and wins)
      if (!bot) {
        const rival = this.players[1 - slot];
        this.trophies.note(p.name, { game: def.id, won: category !== 'casual' && view.winner === slot, rival: rival && rival.name });
      }
      const e = {
        ...contextFor(p.name, { stats: this.stats, practice: this.practice, trophies: this.trophies }),
        game: def.id, category, view, slot, bot, title: title && title.slot === slot ? title : null,
        won: category !== 'casual' && view.winner === slot,
        draw: category !== 'casual' && view.winner !== 0 && view.winner !== 1,
        allGames: games.length,
        botGames: games.filter((g) => g.vsComputer && (g.category || 'competitive') !== 'casual').map((g) => g.id),
      };
      for (const t of this.trophies.check(p.name, e)) list.push({ ...t, slot, player: p.name });
    });
    if (!list.length) return;
    this.trophyNews = { n: ++this.trophySeq, at: Date.now(), list };
    this.broadcastState();
  }

  /** Games for the lobby: within each category, the most recently played first. */
  lastPlayedOrder() {
    return this.stats ? this.stats.lastPlayed() : {};
  }

  lobbyGames() {
    const last = this.lastPlayedOrder();
    const games = listGames().map((g, i) => ({ ...g, lastPlayed: last[g.id] || null, order: i }));
    return games
      .sort((a, b) => (a.category === b.category ? (b.lastPlayed || 0) - (a.lastPlayed || 0) || a.order - b.order : a.order - b.order))
      .map(({ order, ...g }) => g);
  }

  /** The record between the two seated players, for the lobby. */
  headToHead() {
    const [a, b] = this.players;
    return this.stats && a && b && !a.bot && !b.bot ? this.stats.headToHead(a.name, b.name) : null;
  }

  /** Bring a (re)connecting socket fully up to date. */
  sendSnapshot(socket, role, slot) {
    socket.emit('room:state', this.publicState());
    if (!this.game) return;
    const view = role === 'host' ? this.game.hostView() : this.game.playerView(slot);
    socket.emit('game:view', { gameId: this.gameId, view });
  }

  dispose() {
    this.stopGame({ silent: true });
  }
}

export class RoomManager {
  constructor(io, { stats = null, profiles = null, practice = null, trophies = null } = {}) {
    this.io = io;
    this.stats = stats;
    this.profiles = profiles;
    this.practice = practice;
    this.trophies = trophies;
    this.rooms = new Map();
  }

  /**
   * A new room with a random code, or (after a server restart) the code and
   * host token a TV asks for, so phones that knew the old room find it again.
   */
  create({ code: wanted = null, hostToken = null } = {}) {
    let code = normalizeCode(wanted);
    if (!isValidCode(code) || this.rooms.has(code)) {
      do {
        code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
      } while (this.rooms.has(code));
      hostToken = null;
    }
    const room = new Room(code, this.io, { stats: this.stats, profiles: this.profiles, practice: this.practice, trophies: this.trophies, hostToken: isValidToken(hostToken) ? hostToken : null });
    this.rooms.set(code, room);
    return room;
  }

  get(code) {
    return this.rooms.get(normalizeCode(code)) || null;
  }

  /** How many rooms are in the middle of a game (the Pi updater waits for 0). */
  get playing() {
    let n = 0;
    for (const room of this.rooms.values()) if (room.game) n++;
    return n;
  }

  /** Drop rooms nobody has touched in a while. Returns how many were removed. */
  sweep(now = Date.now()) {
    let removed = 0;
    for (const [code, room] of this.rooms) {
      if (room.isIdle(now)) {
        room.dispose();
        this.rooms.delete(code);
        removed++;
      }
    }
    return removed;
  }
}
