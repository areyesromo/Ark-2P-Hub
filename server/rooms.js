import { randomBytes, randomInt } from 'node:crypto';
import { getGame, listGames } from './games/index.js';

export const MAX_PLAYERS = 2;
const NAME_MAX = 16;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I or O, they look like 1 and 0
const CODE_LENGTH = 4;
const IDLE_ROOM_MS = 30 * 60 * 1000;

const newToken = () => randomBytes(16).toString('hex');

export function sanitizeName(name) {
  return String(name ?? '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim()
    .slice(0, NAME_MAX);
}

export function normalizeCode(code) {
  return String(code ?? '').trim().toUpperCase();
}

/**
 * One TV + two players, each on a phone or on a controller plugged into the TV. The room owns the running game instance and is
 * the only thing that talks to Socket.IO on the game's behalf: games produce
 * views, the room pushes them out.
 */
export class Room {
  constructor(code, io, { stats = null } = {}) {
    this.code = code;
    this.io = io;
    this.stats = stats; // match history (see stats.js), optional
    this.hostToken = newToken();
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
    this.touch();
  }

  get allChannel() { return `r:${this.code}`; }
  get hostChannel() { return `h:${this.code}`; }
  playerChannel(slot) { return `p:${this.code}:${slot}`; }

  touch() { this.lastActive = Date.now(); }

  isIdle(now = Date.now()) {
    const anyoneHere = this.hostSockets.size > 0 || this.players.some((p) => p && p.connected);
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

    let slot = this.players.findIndex((p) => p === null);
    if (slot === -1) slot = this.players.findIndex((p) => p && !p.connected);
    if (slot === -1) return { error: 'This room already has two players.' };

    const player = { name, token: newToken(), socketId: null, connected: local && this.hostSockets.size > 0, local };
    this.players[slot] = player;
    return { slot, player, rejoined: false };
  }

  /** Controller players come and go with the TV. Call after the host sockets change. */
  syncLocalPlayers() {
    const tvHere = this.hostSockets.size > 0;
    for (const p of this.players) if (p && p.local) p.connected = tvHere;
  }

  removePlayer(slot) {
    if (!this.players[slot]) return;
    this.players[slot] = null;
    if (this.game) this.stopGame();
    else this.broadcastState();
  }

  get readyToPlay() {
    return this.players.every((p) => p && p.connected);
  }

  // ---- games -------------------------------------------------------------

  startGame(gameId) {
    const def = getGame(gameId);
    if (!def) return { error: 'Unknown game.' };
    if (!this.readyToPlay) return { error: 'Waiting for two players.' };

    this.stopGame({ silent: true });
    this.lastPhase = null;
    const generation = ++this.generation;
    const room = this;
    const live = () => room.generation === generation;

    const ctx = {
      get players() {
        return room.players.map((p, slot) => ({ slot, name: p ? p.name : `Player ${slot + 1}`, local: Boolean(p && p.local) }));
      },
      now: () => Date.now(),
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
    return { ok: true };
  }

  stopGame({ silent = false } = {}) {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
    this.generation++;
    this.game = null;
    this.gameId = null;
    if (!silent) this.broadcastState();
  }

  handleInput(slot, input) {
    if (!this.game || !input || typeof input !== 'object') return;
    this.touch();
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
        p ? { slot, name: p.name, connected: p.connected, local: Boolean(p.local) } : null,
      ),
      games: listGames(),
      h2h: this.headToHead(),
    };
  }

  broadcastState() {
    this.io.to(this.allChannel).emit('room:state', this.publicState());
  }

  pushGameViews() {
    if (!this.game) return;
    const { gameId } = this;
    const view = this.game.hostView();
    if (view.phase === 'over' && this.lastPhase !== 'over') this.recordResult(view);
    this.lastPhase = view.phase;
    this.io.to(this.hostChannel).emit('game:view', { gameId, view });
    this.players.forEach((p, slot) => {
      if (p) this.io.to(this.playerChannel(slot)).emit('game:view', { gameId, view: this.game.playerView(slot) });
    });
  }

  /**
   * A match just ended: add it to the history. Competitive games report
   * winner (a slot, or null for a draw) and scores in their TV view; casual
   * games report the team's stars.
   */
  recordResult(view) {
    if (!this.stats) return;
    const def = getGame(this.gameId);
    const category = def.category || 'competitive';
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
    }
    this.stats.record(match);
  }

  /** The record between the two seated players, for the lobby. */
  headToHead() {
    const [a, b] = this.players;
    return this.stats && a && b ? this.stats.headToHead(a.name, b.name) : null;
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
  constructor(io, { stats = null } = {}) {
    this.io = io;
    this.stats = stats;
    this.rooms = new Map();
  }

  create() {
    let code;
    do {
      code = Array.from({ length: CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('');
    } while (this.rooms.has(code));
    const room = new Room(code, this.io, { stats: this.stats });
    this.rooms.set(code, room);
    return room;
  }

  get(code) {
    return this.rooms.get(normalizeCode(code)) || null;
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
