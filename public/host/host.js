// TV screen: creates (or resumes) a room, shows the QR code and the lobby,
// and hands the stage to the current game's host renderer.
(function () {
  const STORE_KEY = 'ark.host';
  const socket = io();
  const $ = (id) => document.getElementById(id);

  let state = null;
  let current = null; // { gameId, renderer } mounted on the stage
  let pendingView = null;

  // ---- room lifecycle --------------------------------------------------

  function saved() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch (e) { return null; }
  }
  function save(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
  }

  function onRoom(res) {
    save({ code: res.code, hostToken: res.hostToken });
    $('room-code').textContent = res.code;
    $('join-code').textContent = res.code;
    if (res.qr) $('qr').src = res.qr;
  }

  function createRoom() {
    socket.emit('host:create', { origin: location.origin }, onRoom);
  }

  socket.on('connect', function () {
    $('conn').textContent = 'Connected';
    $('conn').className = 'conn ok';
    const prev = saved();
    if (!prev) return createRoom();
    // Survive TV refreshes and server hiccups by reclaiming the same room.
    socket.emit('host:resume', prev, function (res) {
      if (res && res.ok) onRoom(res);
      else createRoom();
    });
  });

  socket.on('disconnect', function () {
    $('conn').textContent = 'Reconnecting…';
    $('conn').className = 'conn';
  });

  // ---- lobby -----------------------------------------------------------

  function renderSeat(slot, p) {
    const el = $('seat-' + slot);
    const label = '<span class="label">Player ' + (slot + 1) + '</span>';
    if (!p) {
      el.className = 'seat empty';
      el.innerHTML = label + '<span class="who">Waiting…</span><span class="status">Scan the code to join</span>';
      return;
    }
    el.className = 'seat filled' + (p.connected ? '' : ' away');
    el.innerHTML =
      label +
      '<span class="who">' + Ark.escapeHtml(p.name) + '</span>' +
      '<span class="status">' + (p.connected ? 'Ready' : 'Reconnecting…') + '</span>';
  }

  function renderLobby() {
    $('join-url').textContent = state.joinUrl ? state.joinUrl.replace(/\?.*$/, '') : '';
    state.players.forEach(function (p, i) { renderSeat(i, p); });

    $('games-hint').textContent = state.readyToPlay
      ? 'Choose here or from either phone.'
      : 'Games unlock once both players are in.';

    $('game-list').innerHTML = state.games.map(function (g) {
      return (
        '<button class="game-card" data-game="' + Ark.escapeHtml(g.id) + '"' + (state.readyToPlay ? '' : ' disabled') + '>' +
        '<strong>' + Ark.escapeHtml(g.name) + '</strong>' +
        '<span>' + Ark.escapeHtml(g.tagline) + '</span>' +
        '</button>'
      );
    }).join('');
  }

  $('game-list').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-game]');
    if (btn && !btn.disabled) socket.emit('lobby:start', { gameId: btn.getAttribute('data-game') });
  });

  $('to-lobby').addEventListener('click', function () { socket.emit('lobby:return'); });

  $('fullscreen').addEventListener('click', function () {
    const root = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (root.requestFullscreen) root.requestFullscreen();
  });

  // ---- game stage ------------------------------------------------------

  function unmountGame() {
    if (current && current.renderer.unmount) current.renderer.unmount();
    current = null;
    pendingView = null;
    $('stage').innerHTML = '';
  }

  function mountGame(gameId) {
    unmountGame();
    const stage = $('stage');
    stage.innerHTML = '<div class="loading">Loading…</div>';
    const mounting = { gameId: gameId, renderer: null };
    current = mounting;
    Ark.loadRenderer('host', gameId).then(function (renderer) {
      if (current !== mounting) return; // switched games while loading
      stage.innerHTML = '';
      mounting.renderer = renderer;
      renderer.mount(stage, { players: state.players });
      if (pendingView) renderer.update(pendingView);
      pendingView = null;
    }).catch(function (err) {
      stage.innerHTML = '<div class="loading">' + Ark.escapeHtml(err.message) + '</div>';
    });
  }

  socket.on('room:state', function (s) {
    state = s;
    const playing = s.phase === 'playing';
    $('lobby').classList.toggle('hidden', playing);
    $('stage').classList.toggle('hidden', !playing);
    $('to-lobby').classList.toggle('hidden', !playing);

    if (playing) {
      if (!current || current.gameId !== s.gameId) mountGame(s.gameId);
    } else {
      unmountGame();
      renderLobby();
    }
  });

  socket.on('game:view', function (msg) {
    if (!current || current.gameId !== msg.gameId) return;
    if (current.renderer) current.renderer.update(msg.view);
    else pendingView = msg.view;
  });
})();
