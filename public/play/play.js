// Phone controller: join a room, pick a game, then hand the screen to the
// current game's player renderer. Rejoins automatically after the phone
// sleeps or the page is refreshed.
(function () {
  const STORE_KEY = 'ark.player';
  const socket = io();
  const $ = (id) => document.getElementById(id);
  Ark.watchVersion(socket);

  let session = loadSession(); // { code, token, name } once joined
  let me = null; // { slot, name, code }
  let state = null;
  let current = null; // { gameId, renderer }
  let lastView = null; // newest game view, kept so it can be applied once a renderer mounts
  let wakeLock = null;

  function loadSession() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch (e) { return null; }
  }
  function saveSession(s) {
    session = s;
    try {
      if (s) localStorage.setItem(STORE_KEY, JSON.stringify(s));
      else localStorage.removeItem(STORE_KEY);
    } catch (e) { /* private mode */ }
  }

  // ---- join ------------------------------------------------------------

  const urlCode = (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  $('code').value = urlCode || (session && session.code) || '';
  $('name').value = (session && session.name) || '';
  if (urlCode) setTimeout(function () { $('name').focus(); }, 50);

  const REJOIN_TRIES = 15; // ~30 s: after a server update the TV reopens the same room
  let rejoinTimer = null;

  function join(code, name, token, silent, attempt) {
    attempt = attempt || 0;
    clearTimeout(rejoinTimer);
    $('join-btn').disabled = true;
    socket.emit('player:join', { code: code, name: name, token: token }, function (res) {
      $('join-btn').disabled = false;
      // Rejoining after a restart: the room comes back once the TV reconnects, so keep trying a while.
      if (silent && res && /No room/.test(res.error || '') && attempt < REJOIN_TRIES) {
        $('me-conn').textContent = 'Waiting for the TV…';
        rejoinTimer = setTimeout(function () { join(code, name, token, true, attempt + 1); }, 2000);
        return;
      }
      if (!res || !res.ok) {
        if (!silent) $('join-error').textContent = (res && res.error) || 'Could not join.';
        if (silent) saveSession({ code: '', token: null, name: session ? session.name : '' });
        showJoin();
        return;
      }
      saveSession({ code: res.code, token: res.token, name: res.name });
      me = { slot: res.slot, name: res.name, code: res.code };
      $('me-conn').textContent = '';
      $('join-error').textContent = '';
      showController();
      // The room snapshot arrives just before this callback, so apply it now.
      if (state) applyState();
    });
  }

  $('join-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const code = $('code').value.trim().toUpperCase();
    const name = $('name').value.trim();
    if (!code || !name) return;
    // Reuse our token only when rejoining the same room.
    const token = session && session.code === code ? session.token : null;
    join(code, name, token, false);
    requestWakeLock();
  });

  socket.on('connect', function () {
    $('me-conn').textContent = '';
    // Auto-rejoin when we have a seat in this room (refresh, phone woke up, Wi-Fi blip).
    if (session && session.token && session.code && (!urlCode || urlCode === session.code)) {
      join(session.code, session.name, session.token, true);
    }
  });

  socket.on('disconnect', function () {
    $('me-conn').textContent = 'Reconnecting…';
  });

  socket.on('player:kicked', function (msg) {
    me = null;
    $('join-error').textContent = msg.reason;
    showJoin();
  });

  // ---- screens ---------------------------------------------------------

  function showJoin() {
    unmountGame();
    $('controller').classList.add('hidden');
    $('join-screen').classList.remove('hidden');
  }

  function showController() {
    $('join-screen').classList.add('hidden');
    $('controller').classList.remove('hidden');
    document.body.className = 'slot-' + me.slot;
    $('me-name').textContent = me.name;
    $('me-tag').textContent = 'P' + (me.slot + 1) + ' · ' + me.code;
  }

  $('menu-btn').addEventListener('click', function () { $('menu').classList.toggle('hidden'); });
  $('lobby-btn').addEventListener('click', function () {
    socket.emit('lobby:return');
    $('menu').classList.add('hidden');
  });
  $('leave-btn').addEventListener('click', function () {
    socket.emit('player:leave', null, function () {
      saveSession({ code: '', token: null, name: me ? me.name : '' });
      me = null;
      $('menu').classList.add('hidden');
      showJoin();
    });
  });

  // ---- lobby -----------------------------------------------------------

  const GROUPS = {
    competitive: '⚔️ Competitive <span>Head to head: one of you wins</span>',
    casual: '🎨 Casual <span>Play together, just for fun</span>',
  };

  function renderLobby() {
    const opponent = state.players[1 - me.slot];
    let status;
    if (!opponent) status = 'Waiting for an opponent to join…';
    else if (!opponent.connected) status = Ark.escapeHtml(opponent.name) + ' is reconnecting…';
    else status = 'You vs <strong>' + Ark.escapeHtml(opponent.name) + '</strong>. Pick a game!';
    $('lobby-status').innerHTML = status;
    const h2h = Ark.h2hHtml(state.players, state.h2h);
    $('h2h').innerHTML = h2h;
    $('h2h').classList.toggle('hidden', !h2h);

    const newest = Math.max.apply(null, state.games.map(function (g) { return g.lastPlayed || 0; }));
    $('phone-games').innerHTML =
      '<button data-game="random" class="random"' + (state.readyToPlay ? '' : ' disabled') + '><strong>🎲 Random game</strong><span>Can\'t decide? Let the hub pick.</span></button>' +
      state.games.map(function (g, i) {
      const heading = i === 0 || state.games[i - 1].category !== g.category
        ? '<h3 class="game-group">' + (GROUPS[g.category] || Ark.escapeHtml(g.category)) + '</h3>'
        : '';
      return (
        heading +
        '<button data-game="' + Ark.escapeHtml(g.id) + '"' + (state.readyToPlay ? '' : ' disabled') + '>' +
        '<strong>' + Ark.escapeHtml(g.name) + (newest && g.lastPlayed === newest ? ' <em class="tag">⏱ Last played</em>' : '') + '</strong>' +
        '<span>' + Ark.escapeHtml(g.tagline) + '</span>' +
        '</button>'
      );
    }).join('');
  }

  $('phone-games').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-game]');
    if (btn && !btn.disabled) socket.emit('lobby:start', { gameId: btn.getAttribute('data-game') });
  });

  // ---- game ------------------------------------------------------------

  const api = {
    send: function (input) { socket.emit('game:input', input); },
    vibrate: function (pattern) { if (navigator.vibrate) navigator.vibrate(pattern); },
    get slot() { return me ? me.slot : 0; },
  };

  function unmountGame() {
    if (current && current.renderer && current.renderer.unmount) current.renderer.unmount();
    current = null;
    $('phone-stage').innerHTML = '';
  }

  function mountGame(gameId) {
    unmountGame();
    const mounting = { gameId: gameId, renderer: null };
    current = mounting;
    Ark.loadRenderer('player', gameId).then(function (renderer) {
      if (current !== mounting) return;
      mounting.renderer = renderer;
      renderer.mount($('phone-stage'), api);
      if (lastView && lastView.gameId === gameId) renderer.update(lastView.view);
    }).catch(function (err) {
      $('phone-stage').textContent = err.message;
    });
  }

  socket.on('room:state', function (s) {
    state = s;
    if (me) applyState();
  });

  function applyState() {
    const s = state;
    const playing = s.phase === 'playing';
    $('phone-lobby').classList.toggle('hidden', playing);
    $('phone-stage').classList.toggle('hidden', !playing);
    $('lobby-btn').disabled = !playing;
    if (playing) {
      if (!current || current.gameId !== s.gameId) mountGame(s.gameId);
    } else {
      unmountGame();
      renderLobby();
    }
  }

  socket.on('game:view', function (msg) {
    lastView = msg;
    if (current && current.renderer && current.gameId === msg.gameId) current.renderer.update(msg.view);
  });

  // ---- keep the screen awake while playing -----------------------------

  function requestWakeLock() {
    if (!('wakeLock' in navigator) || wakeLock) return;
    navigator.wakeLock.request('screen').then(function (lock) {
      wakeLock = lock;
      lock.addEventListener('release', function () { wakeLock = null; });
    }).catch(function () { /* not allowed (e.g. plain http on iOS); fine */ });
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible' && me) requestWakeLock();
  });
  document.addEventListener('pointerdown', requestWakeLock, { once: true });
})();
