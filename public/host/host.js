// TV screen: creates (or resumes) a room, shows the QR code and the lobby,
// and hands the stage to the current game's host renderer.
(function () {
  const STORE_KEY = 'ark.host';
  const socket = io();
  const $ = (id) => document.getElementById(id);

  let state = null;
  let current = null; // { gameId, renderer } mounted on the stage
  let pendingView = null;
  let lastView = null; // newest view of the current game (controllers map buttons against it)
  let roomCode = null;
  const lastPolled = {}; // pad index -> last analog input sent (see padPoll below)

  // ---- room lifecycle --------------------------------------------------

  function saved() {
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || null; } catch (e) { return null; }
  }
  function save(data) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(data)); } catch (e) { /* private mode */ }
  }

  function onRoom(res) {
    save({ code: res.code, hostToken: res.hostToken });
    roomCode = res.code;
    restorePads(res.code);
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

  // The join address was changed in Settings: show the new QR code.
  socket.on('host:qr', function (msg) {
    if (msg && msg.qr) $('qr').src = msg.qr;
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
      '<span class="status">' + (p.local ? '🎮 Controller · ' : '') + (p.connected ? 'Ready' : 'Reconnecting…') + '</span>';
  }

  const GROUPS = {
    competitive: '⚔️ Competitive <span>Head to head: one of you wins</span>',
    casual: '🎨 Casual <span>Play together, just for fun</span>',
  };

  function renderLobby() {
    $('join-url').textContent = state.joinUrl ? state.joinUrl.replace(/\?.*$/, '') : '';
    $('join-warn').classList.toggle('hidden', !state.joinGuess);
    state.players.forEach(function (p, i) { renderSeat(i, p); });

    $('games-hint').textContent = state.readyToPlay
      ? 'Choose here, from either phone, or with a controller (D-pad + A).'
      : 'Games unlock once both players are in.';
    renderPadHint();
    const h2h = Ark.h2hHtml(state.players, state.h2h);
    $('h2h').innerHTML = h2h;
    $('h2h').classList.toggle('hidden', !h2h);

    const padFocus = Object.keys(padSeats).length > 0;
    if (focus >= state.games.length) focus = 0;
    $('game-list').innerHTML = state.games.map(function (g, i) {
      const heading = i === 0 || state.games[i - 1].category !== g.category
        ? '<h3 class="game-group">' + (GROUPS[g.category] || Ark.escapeHtml(g.category)) + '</h3>'
        : '';
      return (
        heading +
        '<button class="game-card' + (padFocus && i === focus ? ' pad-focus' : '') + '" data-game="' + Ark.escapeHtml(g.id) + '"' + (state.readyToPlay ? '' : ' disabled') + '>' +
        '<strong>' + Ark.escapeHtml(g.name) + '</strong>' +
        '<span>' + Ark.escapeHtml(g.tagline) + '</span>' +
        '</button>'
      );
    }).join('');
    // Keep the controller's pick in view now that the list scrolls.
    const focused = padFocus && $('game-list').querySelector('.pad-focus');
    if (focused && focused.scrollIntoView) focused.scrollIntoView({ block: 'nearest' });
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

  // ---- sound -------------------------------------------------------------
  // Effects come from two places: a few rules every game shares (countdowns,
  // points on the pip scoreboard, the end of a match) and the renderer's own
  // optional sounds(prev, view) hook, which returns effect names.

  function renderSoundButton() {
    const btn = $('sound');
    const off = ArkSound.isMuted();
    const locked = !off && !ArkSound.unlocked();
    btn.textContent = off ? '🔇' : locked ? '🔈 Tap for sound' : '🔊';
    btn.classList.toggle('attention', locked);
    btn.title = off ? 'Sound is off' : 'Sound is on';
  }
  $('sound').addEventListener('click', function () {
    // The click that switches audio on (see sound.js) isn't also a mute toggle.
    if (performance.now() - ArkSound.unlockAttemptAt() < 1000) return;
    ArkSound.setMuted(!ArkSound.isMuted());
  });
  ArkSound.onChange(renderSoundButton);
  renderSoundButton();

  function sum(a) {
    return a ? a.reduce(function (x, y) { return x + y; }, 0) : 0;
  }

  function playGameSounds(prev, v) {
    const names = [];
    if (prev) {
      if (v.countdown > 0 && v.countdown !== prev.countdown) names.push('tick');
      if (prev.countdown > 0 && !(v.countdown > 0) && v.phase !== 'over') names.push('go');
      if (v.winScore && sum(v.scores) > sum(prev.scores)) names.push('point');
      if (v.phase === 'over' && prev.phase !== 'over') names.push('fanfare');
    } else if (v.countdown > 0) {
      names.push('tick');
    }
    const r = current && current.renderer;
    if (prev && r && r.sounds) {
      try { (r.sounds(prev, v) || []).forEach(function (n) { names.push(n); }); } catch (e) { /* a sound bug never breaks the game */ }
    }
    names.forEach(ArkSound.play);
  }

  // ---- game stage ------------------------------------------------------

  function unmountGame() {
    if (current && current.renderer.unmount) current.renderer.unmount();
    current = null;
    pendingView = null;
    lastView = null;
    Object.keys(lastPolled).forEach(function (k) { delete lastPolled[k]; });
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
      renderPadFooter();
    }).catch(function (err) {
      stage.innerHTML = '<div class="loading">' + Ark.escapeHtml(err.message) + '</div>';
    });
  }

  function seated(st) {
    return st ? st.players.filter(Boolean).length : 0;
  }

  socket.on('room:state', function (s) {
    if (state) {
      if (seated(s) > seated(state)) ArkSound.play('join');
      else if (seated(s) < seated(state)) ArkSound.play('leave');
      if (s.phase === 'playing' && state.phase !== 'playing') ArkSound.play('start');
    }
    state = s;
    reconcilePads();
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
    renderPadFooter();
  });

  socket.on('game:view', function (msg) {
    if (!current || current.gameId !== msg.gameId) return;
    playGameSounds(lastView, msg.view);
    lastView = msg.view;
    if (current.renderer) current.renderer.update(msg.view);
    else pendingView = msg.view;
  });
  // ---- controllers -----------------------------------------------------
  // Controllers are read on this page (see gamepads.js). Their players are
  // "local" seats on the server; this page sends their input with pad:input.

  const PAD_KEY = 'ark.pads';
  let padSeats = {}; // pad index -> { slot, token }
  let connectedPads = [];
  let focus = 0; // the game card controllers have selected in the lobby
  let padMessage = '';
  let padMessageTimer = null;

  const padName = function (idx) { return 'Controller ' + (idx + 1); };

  function savePads() {
    // Until the room is known (a refresh is still resuming), there's nothing to save yet;
    // saving now would wipe the seats restorePads() is about to take back.
    if (!roomCode) return;
    try { localStorage.setItem(PAD_KEY, JSON.stringify({ code: roomCode, pads: padSeats })); } catch (e) { /* private mode */ }
  }

  // After a TV refresh, take the same seats back (only within the same room).
  function restorePads(code) {
    let stored = null;
    try { stored = JSON.parse(localStorage.getItem(PAD_KEY)); } catch (e) { /* ignore */ }
    padSeats = {};
    if (!stored || stored.code !== code) return savePads();
    Object.keys(stored.pads || {}).forEach(function (idx) {
      socket.emit('pad:join', { name: padName(Number(idx)), token: stored.pads[idx].token }, function (res) {
        if (!res || !res.ok) return;
        padSeats[idx] = { slot: res.slot, token: res.token };
        savePads();
      });
    });
  }

  // Drop seats the server no longer has (player left, or a phone took the seat over).
  function reconcilePads() {
    Object.keys(padSeats).forEach(function (idx) {
      const p = state.players[padSeats[idx].slot];
      if (!p || !p.local) delete padSeats[idx];
    });
    savePads();
  }

  function flashPad(msg) {
    padMessage = msg;
    clearTimeout(padMessageTimer);
    padMessageTimer = setTimeout(function () { padMessage = ''; renderPadHint(); }, 3000);
    renderPadHint();
  }

  function renderPadHint() {
    const n = connectedPads.length;
    let text;
    if (padMessage) text = padMessage;
    else if (!n) text = '🎮 Got a controller? Connect it to this screen and press A to join.';
    else text = '🎮 ' + n + ' controller' + (n > 1 ? 's' : '') + ' connected · A join · B leave · D-pad + A pick a game';
    $('pad-hint').textContent = text;
  }

  function renderPadFooter() {
    const el = $('pad-footer');
    const r = current && current.renderer;
    const anyPad = state && state.players.some(function (p) { return p && p.local; });
    const show = Boolean(state && state.phase === 'playing' && anyPad && r && r.padHint);
    el.classList.toggle('hidden', !show);
    if (show) el.textContent = '🎮 ' + r.padHint + ' · Back: lobby';
  }

  function joinPad(idx) {
    socket.emit('pad:join', { name: padName(idx) }, function (res) {
      if (!res || !res.ok) return flashPad('🎮 ' + ((res && res.error) || "Couldn't join."));
      padSeats[idx] = { slot: res.slot, token: res.token };
      savePads();
      ArkPads.rumble(idx, 150);
    });
  }

  ArkPads.onChange(function (list) {
    connectedPads = list;
    // A controller unplugged in the lobby gives up its seat; mid-game it keeps it.
    if (state && state.phase !== 'playing') {
      Object.keys(padSeats).forEach(function (idx) {
        if (list.indexOf(Number(idx)) === -1) {
          socket.emit('pad:leave', { slot: padSeats[idx].slot });
          delete padSeats[idx];
        }
      });
      savePads();
    }
    if (state && state.phase !== 'playing') renderLobby();
  });

  // Real-time games read held buttons / sticks every frame via the renderer's
  // padPoll(); we only send when the resulting input changes.
  ArkPads.onFrame(function () {
    const r = current && current.renderer;
    if (!state || state.phase !== 'playing' || !r || !r.padPoll || !lastView) return;
    Object.keys(padSeats).forEach(function (idx) {
      const input = r.padPoll({ held: ArkPads.held(Number(idx)), stick: ArkPads.stick(Number(idx)) }, lastView, padSeats[idx].slot);
      const key = input ? JSON.stringify(input) : '';
      if (!input || key === lastPolled[idx]) return;
      lastPolled[idx] = key;
      socket.emit('pad:input', { slot: padSeats[idx].slot, input: input });
    });
  });

  ArkPads.onPress(function (idx, btn) {
    if (!state) return;
    const seat = padSeats[idx];

    if (state.phase === 'playing') {
      if (btn === 'BACK') return socket.emit('lobby:return');
      const r = current && current.renderer;
      if (!seat || !r || !r.pad || !lastView) return;
      const input = r.pad(btn, lastView, seat.slot);
      if (input) {
        socket.emit('pad:input', { slot: seat.slot, input: input });
        ArkPads.rumble(idx, 60);
      }
      return;
    }

    // Lobby
    if (!seat) {
      if (btn === 'A' || btn === 'START') joinPad(idx);
      return;
    }
    const n = state.games.length;
    if (btn === 'B') {
      socket.emit('pad:leave', { slot: seat.slot });
      delete padSeats[idx];
      savePads();
    } else if (btn === 'LEFT' || btn === 'UP') {
      focus = (focus + n - 1) % n;
    } else if (btn === 'RIGHT' || btn === 'DOWN') {
      focus = (focus + 1) % n;
    } else if (btn === 'A' || btn === 'START') {
      if (state.readyToPlay) socket.emit('lobby:start', { gameId: state.games[focus].id });
      else flashPad('🎮 Waiting for a second player.');
      return;
    } else {
      return;
    }
    renderLobby();
  });
})();
