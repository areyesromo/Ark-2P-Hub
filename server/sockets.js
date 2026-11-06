const asObject = (data) => (data && typeof data === 'object' ? data : {});
const reply = (ack, payload) => {
  if (typeof ack === 'function') ack(payload);
};

/**
 * Socket protocol (client -> server):
 *   host:create   { origin }                -> ack { ok, code, hostToken }
 *   host:resume   { code, hostToken, origin } -> ack { ok, code, hostToken }  (reopens the room after a restart)
 *   player:join   { code, name, token? }    -> ack { ok, code, slot, token, name }
 *   player:leave
 *   lobby:start   { gameId | 'random' }     -> ack { ok, gameId } | { error }
 *   lobby:return
 *   lobby:tournament { bestOf } | { reset: true } -> ack { ok, tournament } | { error }
 *   game:input    { type, ... }              (players only, game-specific)
 *   bot:join      { level }                  -> ack { ok, slot } | { error }  (the computer takes the free seat, or changes level)
 *   bot:leave                                -> ack { ok }  (the computer gives up its seat)
 *   host:online   { on }                     -> ack { ok } | { error }  (the TV invites someone over the internet, see online.js)
 *   watch:join    { code }                   -> ack { ok, code } | { error }  (a remote screen: sees what the TV sees, can't play)
 *
 * Controllers plugged into the TV (host only):
 *   pad:join      { name, token? }           -> ack { ok, slot, token, name }
 *   pad:leave     { slot }
 *   pad:input     { slot, input }            (only for seats taken with pad:join)
 *   pad:rename    { slot, name }             -> ack { ok, name } | { error }
 *   profile:set   { avatar?, colour?, slot? } -> ack { ok, profile } | { error }  (a phone: its own seat; the TV: slot)
 *   host:kick     { slot }                   -> ack { ok } | { error }  (the TV removes a player)
 *
 * Server -> client:
 *   room:state    Room#publicState()
 *   host:qr       { qr }                     (TV only: join address changed in Settings)
 *   game:view     { gameId, view }           (host and each player get their own view)
 *   player:kicked { reason, removed? }       (this phone lost its seat; `removed`: the TV took it away)
 *   player:ping   ack()                      (are you still there? see player:join)
 */
/** From the internet: this many wrong tries (code or key) from one address, then a pause. */
export const GUESSES = { max: 20, windowMs: 10 * 60 * 1000 };

/** How long a phone gets to answer "still there?" before its seat counts as free. */
export const PING_MS = 2500;

export function registerSocketHandlers(io, rooms, { refreshJoin, online = null, fromInternet = () => false }) {
  /** Does this seated phone still answer? */
  function answers(player) {
    const s = player && player.socketId && io.sockets.sockets.get(player.socketId);
    if (!s) return Promise.resolve(false);
    return new Promise((resolve) => s.timeout(PING_MS).emit('player:ping', (err) => resolve(!err)));
  }

  // Wrong tries from the internet, by address (Cloudflare's Cf-Connecting-Ip).
  const misses = new Map(); // ip -> { count, since }
  const missKey = (socket) => String(socket.handshake.headers['cf-connecting-ip'] || socket.handshake.address || '?');
  function tooManyMisses(socket) {
    const m = misses.get(missKey(socket));
    if (!m) return false;
    if (Date.now() - m.since > GUESSES.windowMs) {
      misses.delete(missKey(socket));
      return false;
    }
    return m.count >= GUESSES.max;
  }
  function missed(socket) {
    if (misses.size > 1000) for (const [k, m] of misses) if (Date.now() - m.since > GUESSES.windowMs) misses.delete(k); // (old tries go)
    const k = missKey(socket);
    const m = misses.get(k);
    if (!m || Date.now() - m.since > GUESSES.windowMs) misses.set(k, { count: 1, since: Date.now() });
    else m.count++;
  }
  /**
   * From the internet, only a room that invited someone online, with that invite's key, can be
   * joined or watched (and only so many wrong tries). The reason it can't, or null.
   */
  function shutOut(socket, target, key) {
    if (!fromInternet(socket)) return null;
    if (online && online.admits(target, key)) return null; // (the invite's key always gets in, whatever others tried)
    if (tooManyMisses(socket)) return 'Too many tries. Wait a few minutes and use the link from the TV.';
    missed(socket);
    if (online && !online.allowed) return 'Online play is turned off on this hub.';
    return 'Use the invite link or QR code from the TV (this room hasn\'t invited anyone online).';
  }

  // Stop (or online play turned off): whoever came into that room over the internet goes.
  if (online) {
    online.onShutOut = (target) => {
      for (const s of io.sockets.sockets.values()) if (s.data.leaveOnline) s.data.leaveOnline(target);
    };
  }

  io.on('connection', (socket) => {
    // What this socket is bound to. A socket is in at most one room at a time.
    let room = null;
    let role = null;
    let slot = null;

    function detach() {
      if (!room) return;
      socket.leave(room.allChannel);
      if (role === 'host') {
        socket.leave(room.hostChannel);
        room.hostSockets.delete(socket.id);
        room.syncLocalPlayers();
      } else if (role === 'watch') {
        // A remote screen leaving changes nothing for the room (and isn't someone there).
        socket.leave(room.hostChannel);
        room = null;
        role = null;
        return;
      } else if (role === 'player') {
        socket.leave(room.playerChannel(slot));
        const p = room.players[slot];
        if (p && p.socketId === socket.id) {
          p.connected = false;
          p.socketId = null;
        }
      }
      room.touch();
      room.broadcastState();
      room = null;
      role = null;
      slot = null;
    }

    /** Online play stopped for `target`: a phone or remote screen that came in over the internet leaves it. */
    socket.data.leaveOnline = (target) => {
      if (room !== target || !fromInternet(socket)) return;
      if (role === 'watch') return socket.disconnect(true);
      if (role !== 'player') return;
      const seat = slot;
      socket.data.unseat({ reason: 'The TV stopped online play.', removed: true });
      target.removePlayer(seat);
    };

    /** Another socket took this one's seat (or the TV removed it): stop acting for that player. */
    socket.data.unseat = (msg) => {
      if (role !== 'player' || !room) return;
      socket.leave(room.playerChannel(slot));
      socket.leave(room.allChannel);
      room = null;
      role = null;
      slot = null;
      socket.emit('player:kicked', msg);
    };

    function bindHost(target) {
      detach();
      room = target;
      role = 'host';
      socket.join(room.allChannel);
      socket.join(room.hostChannel);
      room.hostSockets.add(socket.id);
      room.syncLocalPlayers();
      room.touch();
      room.broadcastState();
      room.sendSnapshot(socket, 'host');
    }

    function bindPlayer(target, seat) {
      detach();
      room = target;
      role = 'player';
      slot = seat;
      const p = room.players[slot];
      // If the same player was connected on another socket (old tab), that tab loses the seat.
      if (p.socketId && p.socketId !== socket.id) {
        const old = io.sockets.sockets.get(p.socketId);
        if (old && old.data.unseat) old.data.unseat({ reason: 'You joined from another tab or device.' });
      }
      p.socketId = socket.id;
      p.connected = true;
      socket.join(room.allChannel);
      socket.join(room.playerChannel(slot));
      room.touch();
      room.broadcastState();
      room.sendSnapshot(socket, 'player', slot);
    }

    /** A remote screen: in the room for the TV's view, but nothing it says changes anything. */
    function bindWatcher(target) {
      detach();
      room = target;
      role = 'watch';
      socket.join(room.allChannel);
      socket.join(room.hostChannel);
      room.sendSnapshot(socket, 'host');
    }

    /** What a remote screen may not do (it only watches): the reason, or null. */
    const watching = () => (role === 'watch' ? 'This is a remote screen: it can watch, not play.' : null);

    socket.on('host:create', async (data, ack) => {
      if (fromInternet(socket)) return reply(ack, { error: 'A room can only be opened on the TV at home, not over the internet.' });
      const { origin } = asObject(data);
      const target = rooms.create();
      target.hostOrigin = typeof origin === 'string' ? origin : null;
      await refreshJoin(target);
      bindHost(target);
      reply(ack, { ok: true, code: target.code, hostToken: target.hostToken, qr: target.qr });
    });

    socket.on('host:resume', async (data, ack) => {
      if (fromInternet(socket)) return reply(ack, { error: 'A room can only be opened on the TV at home, not over the internet.' });
      const { code, hostToken, origin } = asObject(data);
      let target = rooms.get(code);
      if (target && target.hostToken !== hostToken) return reply(ack, { error: 'Room not found.' });
      if (!target) {
        // The server restarted (an update, a power cut): open the same room again,
        // so phones and controllers that knew it rejoin by themselves.
        target = rooms.create({ code, hostToken });
        if (target.hostToken !== hostToken) {
          rooms.rooms.delete(target.code);
          target.dispose();
          return reply(ack, { error: 'Room not found.' });
        }
        target.hostOrigin = typeof origin === 'string' ? origin : null;
        await refreshJoin(target);
      }
      bindHost(target);
      reply(ack, { ok: true, code: target.code, hostToken: target.hostToken, qr: target.qr });
    });

    socket.on('player:join', async (data, ack) => {
      const { code, name, token, key } = asObject(data);
      const target = rooms.get(code);
      const no = shutOut(socket, target, key);
      if (no) return reply(ack, { error: no });
      if (!target) return reply(ack, { error: 'No room with that code.' });
      let seat = target.seatPlayer(name, token);
      // Someone joins under the name of a phone that looks connected. A reloaded page
      // doesn't always close its connection, so the server may not know it's gone yet:
      // ask that phone. No answer means it's gone, and this is the same person back.
      if (seat.clash !== undefined && !(await answers(target.players[seat.clash]))) {
        const p = target.players[seat.clash];
        const old = p && p.socketId && io.sockets.sockets.get(p.socketId);
        if (old) old.disconnect(true);
        if (p) {
          p.connected = false;
          p.socketId = null;
        }
        seat = target.seatPlayer(name, token);
      }
      if (seat.error) return reply(ack, { error: seat.error });
      bindPlayer(target, seat.slot);
      reply(ack, { ok: true, code: target.code, slot: seat.slot, token: seat.player.token, name: seat.player.name });
    });

    socket.on('player:leave', (_data, ack) => {
      if (role !== 'player') return reply(ack, { ok: true });
      const target = room;
      const seat = slot;
      detach();
      target.removePlayer(seat);
      reply(ack, { ok: true });
    });

    socket.on('watch:join', (data, ack) => {
      const { code, key } = asObject(data);
      const target = rooms.get(code);
      const no = shutOut(socket, target, key);
      if (no) return reply(ack, { error: no });
      if (!target) return reply(ack, { error: 'No room with that code.' });
      if (role === 'watch' && room === target) return reply(ack, { ok: true, code: target.code }); // (already watching)
      bindWatcher(target);
      reply(ack, { ok: true, code: target.code });
    });

    socket.on('host:online', async (data, ack) => {
      if (role !== 'host' || !online) return reply(ack, { error: 'Only the TV can invite someone online.' });
      reply(ack, await online.invite(room, Boolean(asObject(data).on)));
    });

    socket.on('lobby:start', (data, ack) => {
      if (!room) return reply(ack, { error: 'Not in a room.' });
      if (watching()) return reply(ack, { error: watching() });
      reply(ack, room.startGame(asObject(data).gameId));
    });

    socket.on('lobby:return', (_data, ack) => {
      if (watching()) return reply(ack, { error: watching() });
      if (room && room.game) room.stopGame();
      reply(ack, { ok: true });
    });

    socket.on('lobby:tournament', (data, ack) => {
      if (!room) return reply(ack, { error: 'Not in a room.' });
      if (watching()) return reply(ack, { error: watching() });
      reply(ack, room.setTournament(asObject(data)));
    });

    // The computer opponent, from the TV or a seated phone (for a game with no TV at all).
    socket.on('bot:join', (data, ack) => {
      if (!room || (role === 'player' && slot === null)) return reply(ack, { error: 'Not in a room.' });
      if (watching()) return reply(ack, { error: watching() });
      room.touch();
      reply(ack, room.seatBot(asObject(data).level));
    });

    socket.on('bot:leave', (data, ack) => {
      if (!room) return reply(ack, { error: 'Not in a room.' });
      if (watching()) return reply(ack, { error: watching() });
      const seat = room.botSlot;
      if (seat !== -1) room.removePlayer(seat);
      reply(ack, { ok: true });
    });

    socket.on('game:input', (data) => {
      if (role === 'player' && room) room.handleInput(slot, data);
    });

    socket.on('pad:join', (data, ack) => {
      if (role !== 'host') return reply(ack, { error: 'Only the TV can add controller players.' });
      const { name, token } = asObject(data);
      const seat = room.seatPlayer(name, token, { local: true });
      if (seat.error) return reply(ack, { error: seat.error });
      room.touch();
      room.broadcastState();
      reply(ack, { ok: true, slot: seat.slot, token: seat.player.token, name: seat.player.name });
    });

    socket.on('pad:leave', (data, ack) => {
      const seat = asObject(data).slot;
      if (role === 'host' && room.players[seat] && room.players[seat].local) room.removePlayer(seat);
      reply(ack, { ok: true });
    });

    socket.on('pad:input', (data) => {
      const { slot: seat, input } = asObject(data);
      if (role === 'host' && room.players[seat] && room.players[seat].local && !room.players[seat].bot) room.handleInput(seat, input);
    });

    // A player's avatar and colour: from their own phone, or from the TV ({ slot }).
    socket.on('profile:set', (data, ack) => {
      const { avatar, colour } = asObject(data);
      if (role === 'player' && room) return reply(ack, room.setProfile(slot, { avatar, colour }));
      if (role === 'host') return reply(ack, room.setProfile(asObject(data).slot, { avatar, colour }));
      reply(ack, { error: 'Join first.' });
    });

    socket.on('pad:rename', (data, ack) => {
      if (role !== 'host') return reply(ack, { error: 'Only the TV can rename controller players.' });
      const { slot: seat, name } = asObject(data);
      reply(ack, room.renameLocal(seat, name));
    });

    socket.on('host:kick', (data, ack) => {
      if (role !== 'host') return reply(ack, { error: 'Only the TV can remove players.' });
      const seat = asObject(data).slot;
      const p = room.players[seat];
      if (!p) return reply(ack, { error: 'Nobody in that seat.' });
      const phone = p.socketId && io.sockets.sockets.get(p.socketId);
      if (phone && phone.data.unseat) phone.data.unseat({ reason: 'The TV removed you from the room.', removed: true });
      room.touch();
      room.removePlayer(seat);
      reply(ack, { ok: true });
    });

    socket.on('disconnect', detach);
  });
}
