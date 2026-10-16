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
 *   game:input    { type, ... }              (players only, game-specific)
 *
 * Controllers plugged into the TV (host only):
 *   pad:join      { name, token? }           -> ack { ok, slot, token, name }
 *   pad:leave     { slot }
 *   pad:input     { slot, input }            (only for seats taken with pad:join)
 *   pad:rename    { slot, name }             -> ack { ok, name } | { error }
 *
 * Server -> client:
 *   room:state    Room#publicState()
 *   host:qr       { qr }                     (TV only: join address changed in Settings)
 *   game:view     { gameId, view }           (host and each player get their own view)
 */
export function registerSocketHandlers(io, rooms, { refreshJoin }) {
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
        if (old) {
          old.leave(room.playerChannel(slot));
          old.emit('player:kicked', { reason: 'You joined from another tab or device.' });
        }
      }
      p.socketId = socket.id;
      p.connected = true;
      socket.join(room.allChannel);
      socket.join(room.playerChannel(slot));
      room.touch();
      room.broadcastState();
      room.sendSnapshot(socket, 'player', slot);
    }

    socket.on('host:create', async (data, ack) => {
      const { origin } = asObject(data);
      const target = rooms.create();
      target.hostOrigin = typeof origin === 'string' ? origin : null;
      await refreshJoin(target);
      bindHost(target);
      reply(ack, { ok: true, code: target.code, hostToken: target.hostToken, qr: target.qr });
    });

    socket.on('host:resume', async (data, ack) => {
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

    socket.on('player:join', (data, ack) => {
      const { code, name, token } = asObject(data);
      const target = rooms.get(code);
      if (!target) return reply(ack, { error: 'No room with that code.' });
      const seat = target.seatPlayer(name, token);
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

    socket.on('lobby:start', (data, ack) => {
      if (!room) return reply(ack, { error: 'Not in a room.' });
      reply(ack, room.startGame(asObject(data).gameId));
    });

    socket.on('lobby:return', (_data, ack) => {
      if (room && room.game) room.stopGame();
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
      if (role === 'host' && room.players[seat] && room.players[seat].local) room.handleInput(seat, input);
    });

    socket.on('pad:rename', (data, ack) => {
      if (role !== 'host') return reply(ack, { error: 'Only the TV can rename controller players.' });
      const { slot: seat, name } = asObject(data);
      reply(ack, room.renameLocal(seat, name));
    });

    socket.on('disconnect', detach);
  });
}
