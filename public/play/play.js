// Phone controller: join a room, pick a game, then hand the screen to the
// current game's player renderer. Rejoins automatically after the phone
// sleeps or the page is refreshed.
(function () {
  const STORE_KEY = 'ark.player';
  const COOKIE = 'ark_player'; // a backup of the seat (see loadSession)
  const socket = io();
  const $ = (id) => document.getElementById(id);
  Ark.watchVersion(socket);

  // Arriving from the "switch to the secure page" link (see api.secureUrl):
  // take the seat over with the token it carries, and the preferences.
  (function adoptSecureLink() {
    const q = new URLSearchParams(location.search);
    const token = q.get('token');
    if (!token) return;
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ code: (q.get('room') || '').toUpperCase(), token: token, name: q.get('name') || '' }));
      q.getAll('pref').forEach(function (p) {
        const at = p.indexOf(':');
        const key = p.slice(0, at);
        if (at > 0 && /^ark\.[a-z.]+$/.test(key) && key !== STORE_KEY) localStorage.setItem(key, p.slice(at + 1));
      });
    } catch (e) { /* private mode */ }
    if (history.replaceState) history.replaceState(null, '', location.pathname + '?room=' + encodeURIComponent(q.get('room') || ''));
  })();

  let session = loadSession(); // { code, token, name } once joined
  let me = null; // { slot, name, code }
  let state = null;
  let current = null; // { gameId, renderer }
  let lastView = null; // newest game view, kept so it can be applied once a renderer mounts
  let wakeLock = null;

  // The seat is kept in localStorage, with a cookie as a backup: some phone
  // browsers (in-app QR viewers, private tabs) lose one but not the other on a reload.
  function loadSession() {
    try {
      const s = JSON.parse(localStorage.getItem(STORE_KEY));
      if (s) return s;
    } catch (e) { /* private mode */ }
    const m = document.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=([^;]*)'));
    try { return m ? JSON.parse(decodeURIComponent(m[1])) : null; } catch (e) { return null; }
  }
  function saveSession(s) {
    session = s;
    try {
      if (s) localStorage.setItem(STORE_KEY, JSON.stringify(s));
      else localStorage.removeItem(STORE_KEY);
    } catch (e) { /* private mode */ }
    document.cookie = COOKIE + '=' + (s ? encodeURIComponent(JSON.stringify(s)) + '; max-age=86400' : '; max-age=0') + '; path=/; SameSite=Lax';
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

  // "Still there?" from the server, when someone joins under our name (see player:join).
  socket.on('player:ping', function (ack) { if (typeof ack === 'function') ack(true); });

  // Leaving or reloading the page: say so now, so the TV doesn't wait to notice.
  window.addEventListener('pagehide', function () { socket.disconnect(); });
  window.addEventListener('pageshow', function (e) { if (e.persisted) socket.connect(); }); // back from the leaderboard

  socket.on('disconnect', function () {
    $('me-conn').textContent = 'Reconnecting…';
  });

  socket.on('player:kicked', function (msg) {
    // Removed by the TV: forget the seat, so we don't rejoin by ourselves.
    if (msg.removed) saveSession({ code: '', token: null, name: session ? session.name : '' });
    me = null;
    $('join-error').textContent = msg.reason;
    showJoin();
  });

  // ---- screens ---------------------------------------------------------

  function showJoin() {
    unmountGame();
    $('controller').classList.add('hidden');
    $('join-screen').classList.remove('hidden');
    syncZoom();
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
  // Does this phone buzz? Games vibrate for bites, hits and wins; some phones can't, or won't.
  $('buzz-btn').addEventListener('click', function () {
    const ok = navigator.vibrate ? navigator.vibrate([120, 60, 120]) : null;
    const msg = $('buzz-msg');
    msg.classList.remove('hidden');
    msg.textContent = ok === null
      ? "This browser can't vibrate (iPhones don't let web pages buzz, and Firefox doesn't either)."
      : ok
        ? 'Felt a buzz? Then games can vibrate. Nothing? Check that vibration / haptics is on in the phone\'s settings, and that it isn\'t in battery-saver or silent mode.'
        : 'The phone refused to vibrate: try again after tapping the screen, and check battery saver and vibration settings.';
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
    board: '🎲 Dice &amp; Board <span>Classic games, head to head</span>',
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
    $('tourney').innerHTML = Ark.tournamentHtml(state.players, state.tournament, { controls: true });

    const newest = Math.max.apply(null, state.games.map(function (g) { return g.lastPlayed || 0; }));
    const pads = Ark.controllerSeated(state);
    $('phone-games').innerHTML =
      '<button data-game="random" class="random"' + (state.readyToPlay ? '' : ' disabled') + '><strong>🎲 Random game</strong><span>Can\'t decide? Let the hub pick.</span></button>' +
      state.games.map(function (g, i) {
      const heading = i === 0 || state.games[i - 1].category !== g.category
        ? '<h3 class="game-group">' + (GROUPS[g.category] || Ark.escapeHtml(g.category)) + '</h3>'
        : '';
      return (
        heading +
        '<button data-game="' + Ark.escapeHtml(g.id) + '"' + (pads && g.phoneOnly ? ' class="phone-only"' : '') + (state.readyToPlay && !(pads && g.phoneOnly) ? '' : ' disabled') + '>' +
        '<strong>' + Ark.escapeHtml(g.name) + (newest && g.lastPlayed === newest ? ' <em class="tag">⏱ Last played</em>' : '') + (pads && g.phoneOnly ? ' <em class="tag">📱 Phones only</em>' : '') + '</strong>' +
        '<span>' + Ark.escapeHtml(g.tagline) + '</span>' +
        '</button>'
      );
    }).join('');
  }

  Ark.bindTournament($('tourney'), socket);

  /** At the end of a match the phones show the tournament score too. */
  function renderTourneyBar() {
    const t = state && state.tournament;
    const show = Boolean(state && state.phase === 'playing' && t && t.bestOf && lastView && lastView.gameId === state.gameId && lastView.view.phase === 'over');
    $('tourney-bar').classList.toggle('hidden', !show);
    $('tourney-bar').innerHTML = show ? Ark.tournamentHtml(state.players, t, { compact: true }) : '';
  }

  $('phone-games').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-game]');
    if (!btn || btn.disabled) return;
    socket.emit('lobby:start', { gameId: btn.getAttribute('data-game') }, function (res) {
      if (res && res.error) alert(res.error); // e.g. a controller joined a moment ago
    });
  });

  // ---- game ------------------------------------------------------------

  const api = {
    send: function (input) { socket.emit('game:input', input); },
    vibrate: function (pattern) { if (navigator.vibrate) navigator.vibrate(pattern); },
    get slot() { return me ? me.slot : 0; },
    /**
     * This page over https (same seat, same address), for things phones only
     * allow on secure pages (the motion sensor). prefs: { 'ark.key': value }
     * to carry over (each address keeps its own). null when already secure.
     */
    secureUrl: function (prefs) {
      if (location.protocol === 'https:' || !session || !session.token) return null;
      const q = new URLSearchParams({ room: session.code, name: session.name, token: session.token });
      Object.keys(prefs || {}).forEach(function (k) { q.append('pref', k + ':' + prefs[k]); });
      return 'https://' + location.host + '/play/?' + q.toString();
    },
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
      if (lastView && lastView.gameId === gameId && !Ark.setup.isHub(lastView.view)) renderer.update(lastView.view);
      syncZoom();
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
    renderTourneyBar();
    showHubSetup(playing && lastView && Ark.setup.isHub(lastView.view) && lastView.gameId === s.gameId ? lastView.view : null);
    if (playing) {
      if (!current || current.gameId !== s.gameId) mountGame(s.gameId);
    } else {
      unmountGame();
      renderLobby();
    }
    syncZoom();
  }

  // Pinch zoom stays on for the join form, the lobby and setup screens (low vision), and is
  // switched off only while a game's own screen is up, where a stray pinch mid-race would wreck it.
  // A game that draws its own setup screen says so with its renderer's zoomable(view).
  const viewport = document.querySelector('meta[name="viewport"]');
  const zoomable = viewport.getAttribute('content');
  function syncZoom() {
    const r = current && current.renderer;
    const menu = Boolean(r && r.zoomable && lastView && lastView.gameId === current.gameId && r.zoomable(lastView.view));
    // The stage keeps its old state while the whole controller is hidden (back on the join form).
    const locked = !menu && !$('controller').classList.contains('hidden') && !$('phone-stage').classList.contains('hidden');
    const content = locked ? zoomable + ', maximum-scale=1, user-scalable=no' : zoomable;
    if (viewport.getAttribute('content') !== content) viewport.setAttribute('content', content); // views come many times a second
  }

  socket.on('game:view', function (msg) {
    lastView = msg;
    const v = msg.view;
    showHubSetup(Ark.setup.isHub(v) ? v : null);
    $('hub-change').classList.toggle('hidden', !(v.hubSetup && v.phase === 'over'));
    renderTourneyBar();
    if (Ark.setup.isHub(v)) return; // the game hasn't started: the hub shows its setup screen
    if (current && current.renderer && current.gameId === msg.gameId) current.renderer.update(v);
    syncZoom();
  });

  // The setup screen for games that don't draw their own (see withSetup on the server).
  let hubSetupKey = '';
  function showHubSetup(v) {
    $('hub-setup').classList.toggle('hidden', !v);
    if (state && state.phase === 'playing') $('phone-stage').classList.toggle('hidden', Boolean(v));
    syncZoom();
    if (!v) {
      hubSetupKey = '';
      $('hub-change').classList.add('hidden');
      return;
    }
    const key = JSON.stringify(v.hubSetup.settings);
    if (key === hubSetupKey) return;
    hubSetupKey = key;
    const game = state && (state.games || []).find(function (g) { return g.id === state.gameId; });
    const parts = Ark.setup.hubParts(v);
    $('hub-setup').innerHTML =
      '<div class="hub-title">' + Ark.escapeHtml(game ? game.name : '') + '</div>' +
      '<p class="muted">Pick the settings (either of you can), then start.</p>' +
      Ark.setup.html(parts.view, parts.rows) +
      '<button class="primary hub-go">Start</button>';
  }
  Ark.setup.bind($('hub-setup'), api);
  $('hub-setup').addEventListener('click', function (e) {
    if (e.target.closest('.hub-go')) api.send({ type: 'go' });
  });
  $('hub-change').addEventListener('click', function () { api.send({ type: 'setup' }); });

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
