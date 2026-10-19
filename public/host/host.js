// TV screen: creates (or resumes) a room, shows the QR code and the lobby,
// and hands the stage to the current game's host renderer.
(function () {
  const STORE_KEY = 'ark.host';
  const socket = io();
  const $ = (id) => document.getElementById(id);
  Ark.watchVersion(socket, function (v) {
    $('version').textContent = 'v' + v.version + (v.commit && v.commit !== 'dev' ? ' · ' + v.commit.slice(0, 7) : '');
  });

  // Nobody uses a mouse on a TV: hide the pointer until it moves.
  let cursorTimer = null;
  window.addEventListener('mousemove', function () {
    document.body.classList.add('cursor-on');
    clearTimeout(cursorTimer);
    cursorTimer = setTimeout(function () { document.body.classList.remove('cursor-on'); }, 3000);
  });

  let state = null;
  let current = null; // { gameId, renderer } mounted on the stage
  let pendingView = null;
  let lastView = null; // newest view of the current game (controllers map buttons against it)
  let roomCode = null;
  let kickArmed = null; // a seat's ✕ tapped once: { slot, timer } (see kick below)
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
    socket.emit('host:resume', { code: prev.code, hostToken: prev.hostToken, origin: location.origin }, function (res) {
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
    const confirming = kickArmed && kickArmed.slot === slot;
    el.innerHTML =
      '<button class="kick' + (confirming ? ' armed' : '') + '" data-kick="' + slot + '" title="Remove this player">' + (confirming ? 'Remove?' : '✕') + '</button>' +
      label +
      '<span class="who">' + Ark.escapeHtml(p.name) + '</span>' +
      '<span class="status">' + (p.local ? '🎮 Controller · ' : '') + (p.connected ? 'Ready' : 'Reconnecting…') + '</span>';
  }

  const GROUPS = {
    competitive: '⚔️ Competitive <span>Head to head: one of you wins</span>',
    board: '🎲 Dice &amp; Board <span>Classic games, head to head</span>',
    casual: '🎨 Casual <span>Play together, just for fun</span>',
  };

  // The first lobby card picks a game at random (the server chooses, see Room#pickRandomGame).
  const RANDOM = { id: 'random', name: '🎲 Random game', tagline: "Can't decide? Let the hub pick one for you." };
  function lobbyCards() {
    return [RANDOM].concat(state.games);
  }

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
    $('tourney').innerHTML = Ark.tournamentHtml(state.players, state.tournament, { controls: true });

    const padFocus = Object.keys(padSeats).length > 0;
    const cards = lobbyCards();
    if (focus >= cards.length) focus = 0;
    const newest = Math.max.apply(null, state.games.map(function (g) { return g.lastPlayed || 0; }));
    const pads = Ark.controllerSeated(state);
    $('game-list').innerHTML = cards.map(function (g, i) {
      const heading = i > 0 && (i === 1 || cards[i - 1].category !== g.category)
        ? '<h3 class="game-group">' + (GROUPS[g.category] || Ark.escapeHtml(g.category)) + '</h3>'
        : '';
      const tag = newest && g.lastPlayed === newest ? '<em class="tag">⏱ Last played</em>' : '';
      return (
        heading +
        '<button class="game-card' + (g.id === 'random' ? ' random' : '') + (padFocus && i === focus ? ' pad-focus' : '') + (pads && g.phoneOnly ? ' phone-only' : '') + '" data-game="' + Ark.escapeHtml(g.id) + '"' + (state.readyToPlay && !(pads && g.phoneOnly) ? '' : ' disabled') + '>' +
        '<strong>' + Ark.escapeHtml(g.name) + tag + (pads && g.phoneOnly ? '<em class="tag">📱 Phones only</em>' : '') + '</strong>' +
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

  // Removing a player: tap ✕ on their seat, then "Remove?" within a few seconds.
  function kick(slot) {
    clearTimeout(kickArmed && kickArmed.timer);
    kickArmed = null;
    socket.emit('host:kick', { slot: slot });
  }
  document.querySelector('.seats').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-kick]');
    if (!btn) return;
    const slot = Number(btn.getAttribute('data-kick'));
    if (kickArmed && kickArmed.slot === slot) return kick(slot);
    clearTimeout(kickArmed && kickArmed.timer);
    kickArmed = { slot: slot, timer: setTimeout(function () { kickArmed = null; if (state) renderLobby(); }, 4000) };
    renderLobby();
  });
  Ark.bindTournament($('tourney'), socket);

  /** During a game the tournament score sits in the middle of the top bar. */
  function renderTourneyBar() {
    const t = state && state.tournament;
    const show = Boolean(state && state.phase === 'playing' && t && t.bestOf);
    $('tourney-bar').classList.toggle('hidden', !show);
    $('tourney-bar').innerHTML = show ? Ark.tournamentHtml(state.players, t, { compact: true }) : '';
  }

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

  // ---- music -------------------------------------------------------------
  // The lobby has its own laid-back tune; each game asks for a mood (see
  // MUSIC_MOODS in server/games/index.js). A game's setup screen and its
  // end screen get the lobby tune; the 🎵 button turns music on and off.

  function renderMusicButton() {
    const on = ArkMusic.isEnabled();
    $('music').classList.toggle('off', !on);
    $('music').title = on ? 'Music is on' : 'Music is off';
  }
  $('music').addEventListener('click', function () {
    ArkMusic.setEnabled(!ArkMusic.isEnabled());
  });
  ArkMusic.onChange(renderMusicButton);
  renderMusicButton();

  function updateMusic() {
    let mood = 'lobby';
    if (state && state.phase === 'playing' && lastView && lastView.phase !== 'setup' && lastView.phase !== 'over') {
      const game = (state.games || []).find(function (g) { return g.id === state.gameId; });
      if (game && game.music) mood = game.music;
    }
    ArkMusic.setMood(mood);
  }

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
    Object.keys(hubPads).forEach(function (k) { delete hubPads[k]; });
    $('stage').innerHTML = '';
    showHubSetup(null);
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
    renderTourneyBar();
    updateMusic();
    showHubSetup(Ark.setup.isHub(lastView) ? lastView : null);
  });

  socket.on('game:view', function (msg) {
    if (!current || current.gameId !== msg.gameId) return;
    const setup = Ark.setup.isHub(msg.view);
    if (!setup) playGameSounds(Ark.setup.isHub(lastView) ? null : lastView, msg.view);
    const wasSetup = Ark.setup.isHub(lastView);
    lastView = msg.view;
    updateMusic();
    showHubSetup(setup ? msg.view : null);
    if (setup !== wasSetup) renderPadFooter();
    if (setup) return; // the game hasn't started: the hub shows its setup screen
    if (current.renderer) current.renderer.update(msg.view);
    else pendingView = msg.view;
  });

  // ---- the hub's setup screen ------------------------------------------
  // For games that don't draw their own (wrapped with withSetup on the
  // server): pick settings from the phones or with a controller, then start.

  const hubPads = {}; // controller players: slot -> { row }
  let hubSetupKey = '';

  function showHubSetup(v) {
    const playing = Boolean(state && state.phase === 'playing');
    $('hub-setup').classList.toggle('hidden', !v || !playing);
    $('stage').classList.toggle('hidden', Boolean(v) || !playing);
    if (!v) {
      hubSetupKey = '';
      return;
    }
    const parts = Ark.setup.hubParts(v);
    const focus = Ark.setup.focus(parts.view, parts.rows, hubPads);
    const key = JSON.stringify([v.hubSetup.settings, focus]);
    if (key === hubSetupKey) return;
    hubSetupKey = key;
    const game = (state.games || []).find(function (g) { return g.id === state.gameId; });
    $('hub-setup').innerHTML =
      '<div class="hub-title">' + Ark.escapeHtml(game ? game.name : '') + '</div>' +
      '<p class="muted">Set up the match on your phone, or with a controller: ↑↓ picks a row, ←→ changes it. ' +
      '<strong>Start</strong> (or <strong>A</strong>) when you\'re both ready.</p>' +
      Ark.setup.html(parts.view, parts.rows, focus);
  }
  // ---- controllers -----------------------------------------------------
  // Controllers are read on this page (see gamepads.js). Their players are
  // "local" seats on the server; this page sends their input with pad:input.

  const PAD_KEY = 'ark.pads';
  let padSeats = {}; // pad index -> { slot, token, name? }
  let connectedPads = [];
  let focus = 0; // the game card controllers have selected in the lobby
  let padMessage = '';
  let padMessageTimer = null;

  const padName = function (idx) { return 'Controller ' + (idx + 1); };

  /** Seats held by phones that have disconnected. */
  function awayPhones() {
    if (!state) return [];
    return state.players.map(function (p, slot) { return p && !p.local && !p.connected ? slot : -1; }).filter(function (s) { return s !== -1; });
  }

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
      const seat = stored.pads[idx];
      socket.emit('pad:join', { name: seat.name || padName(Number(idx)), token: seat.token }, function (res) {
        if (!res || !res.ok) return;
        padSeats[idx] = { slot: res.slot, token: res.token, name: seat.name };
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
    else text = '🎮 ' + n + ' controller' + (n > 1 ? 's' : '') + ' connected · A join · B leave · Y change name · X tournament · D-pad + A pick a game' +
      (awayPhones().length ? ' · Back: free the seat of a phone that left' : '');
    $('pad-hint').textContent = text;
  }

  function renderPadFooter() {
    const el = $('pad-footer');
    const r = current && current.renderer;
    const anyPad = state && state.players.some(function (p) { return p && p.local; });
    const setup = Ark.setup.isHub(lastView);
    const show = Boolean(state && state.phase === 'playing' && anyPad && (setup || (r && r.padHint)));
    el.classList.toggle('hidden', !show);
    if (show) el.textContent = '🎮 ' + (setup ? '↑↓ pick a row · ←→ change it · A start' : r.padHint) + ' · Back: lobby';
  }

  /**
   * Controllers can't type, so Y cycles a controller player's name through
   * the names on the leaderboard (and back to "Controller N"). That way
   * their wins count for them.
   */
  function renamePad(idx, seat) {
    const other = state.players[1 - seat.slot];
    const taken = other ? other.name.toLowerCase() : null;
    const names = [];
    [padName(Number(idx))].concat(state.knownNames || []).forEach(function (n) {
      const k = n.toLowerCase();
      if (k !== taken && !names.some(function (m) { return m.toLowerCase() === k; })) names.push(n);
    });
    const now = state.players[seat.slot] ? state.players[seat.slot].name.toLowerCase() : '';
    const at = names.findIndex(function (n) { return n.toLowerCase() === now; });
    const name = names[(at + 1) % names.length];
    socket.emit('pad:rename', { slot: seat.slot, name: name }, function (res) {
      if (!res || !res.ok) return flashPad('🎮 ' + ((res && res.error) || "Couldn't rename."));
      seat.name = res.name;
      savePads();
      flashPad('🎮 Controller ' + (Number(idx) + 1) + ' is now playing as ' + res.name +
        (names.length > 1 ? ' · press Y again for another name' : ' · finish a game with a phone name to add more'));
    });
  }

  function joinPad(idx) {
    socket.emit('pad:join', { name: padName(idx) }, function (res) {
      if (!res || !res.ok) return flashPad('🎮 ' + ((res && res.error) || "Couldn't join."));
      padSeats[idx] = { slot: res.slot, token: res.token };
      savePads();
      ArkPads.rumble(idx, 150);
      if (state && state.phase !== 'playing') renderLobby(); // show the controller's focus right away
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
    if (!state || state.phase !== 'playing' || !r || !r.padPoll || !lastView || Ark.setup.isHub(lastView)) return;
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
      if (seat && Ark.setup.isHub(lastView)) {
        if (!hubPads[seat.slot]) hubPads[seat.slot] = { row: 0 };
        const parts = Ark.setup.hubParts(lastView);
        const input = Ark.setup.pad(btn, parts.view, parts.rows, hubPads[seat.slot]);
        if (input) socket.emit('pad:input', { slot: seat.slot, input: input });
        showHubSetup(lastView);
        return;
      }
      if (seat && lastView && lastView.hubSetup && lastView.phase === 'over' && btn === 'Y') {
        return socket.emit('pad:input', { slot: seat.slot, input: { type: 'setup' } });
      }
      const r = current && current.renderer;
      if (!seat || !r || !r.pad || !lastView) return;
      const input = r.pad(btn, lastView, seat.slot);
      if (input) {
        socket.emit('pad:input', { slot: seat.slot, input: input });
        ArkPads.rumble(idx, 60);
      }
      return;
    }

    // Lobby. Back (on any controller) frees the seats of phones that have gone.
    if (btn === 'BACK') {
      const away = awayPhones();
      away.forEach(function (slot) { socket.emit('host:kick', { slot: slot }); });
      return flashPad(away.length ? '🎮 Freed ' + away.length + ' seat' + (away.length > 1 ? 's' : '') : '🎮 No seats to free: everyone is here');
    }
    if (!seat) {
      if (btn === 'A' || btn === 'START') joinPad(idx);
      return;
    }
    const cards = lobbyCards();
    const n = cards.length;
    if (btn === 'Y') return renamePad(idx, seat);
    if (btn === 'X') {
      // Cycle the tournament: off, best of 3, 5, 7.
      const t = state.tournament;
      const lengths = (t && t.lengths) || [0, 3, 5, 7];
      const next = lengths[(lengths.indexOf(t ? t.bestOf : 0) + 1) % lengths.length];
      socket.emit('lobby:tournament', { bestOf: next });
      return flashPad('🏆 Tournament: ' + (next ? 'best of ' + next + ' games' : 'off') + ' · X to change');
    }
    if (btn === 'B') {
      socket.emit('pad:leave', { slot: seat.slot });
      delete padSeats[idx];
      savePads();
    } else if (btn === 'LEFT' || btn === 'UP') {
      focus = (focus + n - 1) % n;
    } else if (btn === 'RIGHT' || btn === 'DOWN') {
      focus = (focus + 1) % n;
    } else if (btn === 'A' || btn === 'START') {
      if (!state.readyToPlay) flashPad('🎮 Waiting for a second player.');
      else if (cards[focus].phoneOnly) flashPad('📱 ' + cards[focus].name + ' needs two phones (no controllers).');
      else socket.emit('lobby:start', { gameId: cards[focus].id });
      return;
    } else {
      return;
    }
    renderLobby();
  });
})();
