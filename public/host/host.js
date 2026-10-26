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
  let lobbyDrawn = false; // the lobby's first layout appears as it is, later changes animate
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
    $('room-note-code').textContent = res.code;
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
      '<span class="who"><button class="seat-avatar" data-profile="' + slot + '" title="Change avatar and colour">' + Ark.avatarHtml(p.profile) + '</button><span class="nm">' + Ark.escapeHtml(p.name) + '</span></span>' +
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
    // Both seats taken: the QR code steps aside and the game list gets the room.
    Ark.lobbyLayout($('lobby'), 'full', state.players.every(Boolean), document.querySelector('.join'),
      [document.querySelector('.players-col'), document.querySelector('.games')], lobbyDrawn);
    lobbyDrawn = true;
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
    if (!btn || btn.disabled) return;
    socket.emit('lobby:start', { gameId: btn.getAttribute('data-game') }, function (res) {
      if (res && res.error) flashPad('⚠️ ' + res.error);
    });
  });

  $('to-lobby').addEventListener('click', function () { socket.emit('lobby:return'); });

  // Removing a player: tap ✕ on their seat, then "Remove?" within a few seconds.
  function kick(slot) {
    clearTimeout(kickArmed && kickArmed.timer);
    kickArmed = null;
    socket.emit('host:kick', { slot: slot });
  }
  // A player's avatar and colour, picked here: click their avatar, or LB / RB on their controller.
  let picker = null; // { slot, pad (the controller using it, or null), sheet }
  function openPicker(slot, pad) {
    const p = state && state.players[slot];
    if (!p || picker) return;
    picker = { slot: slot, pad: pad === undefined ? null : pad };
    picker.sheet = Ark.profilePicker({
      profile: p.profile,
      title: p.name + '\'s avatar and colour',
      onPick: function (fields) {
        socket.emit('profile:set', Object.assign({ slot: slot }, fields), function (res) {
          if (res && res.error) flashPad('⚠️ ' + res.error);
        });
      },
      onClose: function () { picker = null; },
    });
  }
  document.querySelector('.seats').addEventListener('click', function (e) {
    const av = e.target.closest('[data-profile]');
    if (av) return openPicker(Number(av.getAttribute('data-profile')));
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

  // In the desktop app (window.arkDesktop, see desktop/preload.cjs) ⛶ switches the app's window
  // between full screen and windowed, and Quit closes it: tap it, then "Quit?" again within 3 s
  // (a quick double-click doesn't count as both taps).
  const desktop = window.arkDesktop;
  $('fullscreen').addEventListener('click', function () {
    if (desktop) return desktop.toggleFullScreen();
    const root = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen();
    else if (root.requestFullscreen) root.requestFullscreen();
  });
  if (desktop) {
    let armed = null;
    let armedAt = 0;
    $('quit').classList.remove('hidden');
    $('quit').addEventListener('click', function () {
      if (armed) {
        if (Date.now() - armedAt >= 400) desktop.quit();
        return;
      }
      armedAt = Date.now();
      $('quit').textContent = 'Quit?';
      $('quit').classList.add('armed');
      armed = setTimeout(function () {
        armed = null;
        $('quit').textContent = 'Quit';
        $('quit').classList.remove('armed');
      }, 3000);
    });
  }

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
    // A renderer still loading has nothing mounted yet (and won't: see mountGame).
    if (current && current.renderer && current.renderer.unmount) current.renderer.unmount();
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
      if (current !== mounting) return; // a game already left: the lobby shows no error
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
    // What's new is a lobby thing (see showNews).
    if (s.phase === 'playing' && newsOpen) closeNews();
    if (s.phase !== 'playing' && newsWaiting) showNews(newsWaiting);
    // The picker follows its seat: closed when that player leaves or a game starts.
    if (picker) {
      const p = s.players[picker.slot];
      if (!p || s.phase === 'playing') picker.sheet.close();
      else picker.sheet.update(p.profile);
    }
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
    // A tall setup scrolls: keep the controller's row in view.
    const row = $('hub-setup').querySelector('.row.focus');
    if (row && row.scrollIntoView) row.scrollIntoView({ block: 'nearest' });
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

  // Self-update (desktop app): a banner in the lobby. Tap it, or press RT on a controller.
  let update = { state: 'idle' };
  const UPDATE_TEXT = {
    available: function (u) { return '⬆ Version ' + u.version + ' is out · <strong>Update</strong>'; },
    downloading: function (u) { return 'Downloading version ' + u.version + '… ' + u.percent + ' %'; },
    ready: function (u) {
      return 'Version ' + u.version + ' is downloaded · <strong>' + (u.relaunch === false ? 'Install and close' : 'Restart now') + '</strong>';
    },
    error: function () { return 'Couldn\'t update · <strong>Download page</strong>'; },
  };
  function updateActionable() {
    return update.state === 'available' || update.state === 'ready' || update.state === 'error';
  }
  function renderUpdate() {
    const show = Boolean(UPDATE_TEXT[update.state]);
    $('update').classList.toggle('hidden', !show);
    if (!show) return;
    $('update').innerHTML = UPDATE_TEXT[update.state](update) +
      (updateActionable() && connectedPads.length ? ' <span class="pad-key">RT</span>' : '');
    $('update').disabled = !updateActionable();
    $('update').classList.toggle('busy', update.state === 'downloading');
  }
  if (desktop) {
    desktop.onUpdate(function (u) {
      update = u || { state: 'idle' };
      renderUpdate();
    });
    $('update').addEventListener('click', function () {
      if (updateActionable()) desktop.update();
    });
  }

  // What's new (desktop app): after an update, the notes since the version the app last ran
  // (CHANGELOG.md), once. Tapping the version number shows the current version's again. Lobby
  // only: one that arrives during a game waits for the lobby, and a game starting closes it.
  // A, B or Start on a controller closes it.
  let newsOpen = false;
  let newsWaiting = null;
  const inLobby = function () { return !state || state.phase !== 'playing'; };
  function newsLine(text) {
    return Ark.escapeHtml(text).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  }
  function showNews(news) {
    if (!news || !news.entries.length) return;
    if (!inLobby()) {
      newsWaiting = news;
      return;
    }
    newsWaiting = null;
    $('whats-new').innerHTML = '<div class="whats-new-card panel">' +
      '<h2>What\'s new in v' + Ark.escapeHtml(news.version) + '</h2>' +
      news.entries.map(function (e) {
        return (news.entries.length > 1 ? '<h3>v' + Ark.escapeHtml(e.version) + '</h3>' : '') +
          '<ul>' + e.items.map(function (item) { return '<li>' + newsLine(item) + '</li>'; }).join('') + '</ul>';
      }).join('') +
      '<button id="whats-new-ok" class="primary">Got it</button>' +
      '<p class="muted">🎮 A or B to close</p></div>';
    $('whats-new').classList.remove('hidden');
    newsOpen = true;
    $('whats-new-ok').addEventListener('click', closeNews);
  }
  function closeNews() {
    $('whats-new').classList.add('hidden');
    newsOpen = false;
  }
  function loadNews(since) {
    return fetch('/whats-new.json' + (since ? '?since=' + encodeURIComponent(since) : ''))
      .then(function (r) { return r.json(); });
  }
  if (desktop) {
    desktop.lastRun().then(function (run) {
      if (!run) return null;
      // The notes since the last version (none if it's the same one). An app from before the
      // version was kept: this version's. A brand new install: nothing.
      if (run.previous) return loadNews(run.previous).then(showNews);
      if (run.ranBefore) return loadNews('').then(showNews);
      return null;
    }).catch(function () {});
    $('version').classList.add('tappable');
    $('version').addEventListener('click', function () {
      if (inLobby()) loadNews('').then(showNews).catch(function () {});
    });
  }

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
    else text = '🎮 ' + n + ' controller' + (n > 1 ? 's' : '') + ' connected · A join · B leave · Y change name · LB / RB avatar · X tournament · D-pad + A pick a game' +
      (awayPhones().length ? ' · Back: free the seat of a phone that left' : '');
    $('pad-hint').textContent = text;
    renderUpdate(); // its RT tag shows while a controller is connected
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

  // Ready-made names for controller players, after the leaderboard's.
  const PAD_NAMES = ['Ace', 'Blaze', 'Comet', 'Dash', 'Echo', 'Flash', 'Ghost', 'Hero', 'Jet', 'Nova', 'Pixel', 'Rocket', 'Turbo', 'Zap'];

  /**
   * Controllers can't type, so Y cycles a controller player's name through
   * the names on the leaderboard (so their wins count for them), then some
   * ready-made ones, and back to "Controller N".
   */
  function renamePad(idx, seat) {
    const other = state.players[1 - seat.slot];
    const taken = other ? other.name.toLowerCase() : null;
    const names = [];
    [padName(Number(idx))].concat(state.knownNames || [], PAD_NAMES).forEach(function (n) {
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
        ' · press Y again for another name');
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
    if (newsOpen) {
      if (btn === 'A' || btn === 'B' || btn === 'START') closeNews();
      return;
    }
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

    if (picker && btn === 'BACK') return picker.sheet.close();
    // RT (any controller) presses the update banner.
    if (btn === 'RT' && desktop && updateActionable()) return desktop.update();
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
    // The picker takes the controller that opened it (another controller's B closes it too).
    if (picker) {
      if (picker.pad === null || picker.pad === Number(idx)) picker.sheet.press(btn);
      else if (btn === 'B') picker.sheet.close();
      return;
    }
    if (btn === 'LB' || btn === 'RB') return openPicker(seat.slot, Number(idx));
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
    } else if (btn === 'LEFT') {
      focus = (focus + n - 1) % n;
    } else if (btn === 'RIGHT') {
      focus = (focus + 1) % n;
    } else if (btn === 'UP' || btn === 'DOWN') {
      // Up and down go to the card above or below on screen, not the next in the list.
      focus = Ark.stepVertical($('game-list').querySelectorAll('.game-card'), focus, btn === 'UP' ? -1 : 1);
    } else if (btn === 'A' || btn === 'START') {
      if (!state.readyToPlay) flashPad('🎮 Waiting for a second player.');
      else if (cards[focus].phoneOnly) flashPad('📱 ' + cards[focus].name + ' needs two phones (no controllers).');
      else socket.emit('lobby:start', { gameId: cards[focus].id }, function (res) {
        if (res && res.error) flashPad('⚠️ ' + res.error);
      });
      return;
    } else {
      return;
    }
    renderLobby();
  });
})();
