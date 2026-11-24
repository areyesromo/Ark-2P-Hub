// Phone controller: join a room, pick a game, then hand the screen to the
// current game's player renderer. Rejoins automatically after the phone
// sleeps or the page is refreshed.
//
// At /phone it's phone only: no TV and no room code. The phone opens a room of its own
// (phone:create) and plays the 1 player games whose phone screen shows the whole game, drawing
// the TV's picture above its controls for the arcade ones ('split'). It keeps its seat apart
// from the TV one, and plays the sounds itself.
(function () {
  const NO_TV = /^\/phone\/?$/.test(location.pathname);
  const STORE_KEY = NO_TV ? 'ark.phone' : 'ark.player';
  const COOKIE = NO_TV ? 'ark_phone' : 'ark_player'; // a backup of the seat (see loadSession)
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
  let fullView = null; // the last whole view, to fill in the big fields the server leaves out while unchanged (`kept`)
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

  const urlCode = NO_TV ? '' : (new URLSearchParams(location.search).get('room') || '').toUpperCase();
  if (NO_TV) {
    document.body.classList.add('no-tv');
    $('code').required = false;
    $('code-label').classList.add('hidden');
    $('join-mode').innerHTML = '📱 Phone only: the 1 player games, no TV needed. <a href="/play/">Got a TV? Join its room instead</a>';
    $('join-btn').textContent = 'Play';
    document.title = 'Ark 2P Hub · Phone';
  }
  // Joining over the internet: the invite's key, from the TV's link (kept with the seat, so the
  // phone gets back in after it sleeps). At home it isn't needed.
  const inviteKey = new URLSearchParams(location.search).get('k') || (session && session.key) || null;
  $('code').value = urlCode || (session && session.code) || '';
  $('name').value = (session && session.name) || '';
  if (urlCode) setTimeout(function () { $('name').focus(); }, 50);

  const REJOIN_TRIES = 15; // ~30 s: after a server update the TV reopens the same room
  let rejoinTimer = null;

  function join(code, name, token, silent, attempt) {
    attempt = attempt || 0;
    clearTimeout(rejoinTimer);
    $('join-btn').disabled = true;
    socket.emit('player:join', { code: code, name: name, token: token, key: inviteKey }, function (res) {
      $('join-btn').disabled = false;
      // Phone only: the room went with a server restart, and there's no TV to bring it back. Open a new one.
      if (NO_TV && silent && res && /No room/.test(res.error || '')) return create(name, true);
      // Rejoining after a restart: the room comes back once the TV reconnects, so keep trying a while.
      if (silent && res && /No room/.test(res.error || '') && attempt < REJOIN_TRIES) {
        $('me-conn').textContent = 'Waiting for the TV…';
        rejoinTimer = setTimeout(function () { join(code, name, token, true, attempt + 1); }, 2000);
        return;
      }
      seated(res, silent);
    });
  }

  /** Phone only: open a room of our own and take its seat. */
  function create(name, silent) {
    $('join-btn').disabled = true;
    socket.emit('phone:create', { name: name }, function (res) {
      $('join-btn').disabled = false;
      seated(res, silent);
    });
  }

  /** The answer to a join (or a phone-only create): in, or back to the form. */
  function seated(res, silent) {
    if (!res || !res.ok) {
      if (!silent) $('join-error').textContent = (res && res.error) || 'Could not join.';
      if (silent) saveSession({ code: '', token: null, name: session ? session.name : '' });
      showJoin();
      return;
    }
    saveSession({ code: res.code, token: res.token, name: res.name, key: inviteKey });
    me = { slot: res.slot, name: res.name, code: res.code };
    $('me-conn').textContent = '';
    $('join-error').textContent = '';
    showController();
    // The room snapshot arrives just before this callback, so apply it now.
    if (state) applyState();
  }

  $('join-form').addEventListener('submit', function (e) {
    e.preventDefault();
    const code = $('code').value.trim().toUpperCase();
    const name = $('name').value.trim();
    if (NO_TV && name) {
      // Back into our own room while we still have it (same name), else a new one.
      if (session && session.token && session.code && session.name === name) join(session.code, name, session.token, true);
      else create(name, false);
      requestWakeLock();
      return;
    }
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
    fullView = null; // (the server sends a whole view when we're back)
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
    if (picker) picker.close();
    $('controller').classList.add('hidden');
    $('join-screen').classList.remove('hidden');
    syncZoom();
  }

  function showController() {
    $('join-screen').classList.add('hidden');
    $('controller').classList.remove('hidden');
    document.body.className = 'slot-' + me.slot + (NO_TV ? ' no-tv' : '');
    $('me-name').textContent = me.name;
    $('me-tag').textContent = NO_TV ? '📱 Phone' : 'P' + (me.slot + 1) + ' · ' + me.code;
    // Settings is Player 1's, at home (over the internet it stays shut: see app.js).
    $('settings-btn').classList.toggle('hidden', me.slot !== 0 || Boolean(inviteKey));
  }

  $('settings-btn').addEventListener('click', function () {
    $('menu').classList.add('hidden');
    $('settings-frame').src = '/admin/?embed=1';
    $('settings-sheet').classList.remove('hidden');
  });
  $('settings-close').addEventListener('click', function () {
    $('settings-sheet').classList.add('hidden');
    $('settings-frame').src = 'about:blank';
  });

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
    ...Ark.SOLO_GROUPS, // the solo games (the lobby's 1 player mode)
    competitive: '⚔️ Competitive <span>Head to head: one of you wins</span>',
    board: '🎲 Dice &amp; Board <span>Classic games, head to head</span>',
    casual: '🎨 Casual <span>Play together, just for fun</span>',
  };

  let openFolder = null; // the lobby folder open on this phone, or null
  function renderLobby() {
    const opponent = state.players[1 - me.slot];
    const solo = state.mode === 'solo';
    document.querySelectorAll('#mode-pick [data-mode]').forEach(function (b) { b.classList.toggle('on', b.getAttribute('data-mode') === state.mode); });
    let status;
    if (NO_TV) status = 'Pick a game and chase your best. <small>Phone only: these games need no TV.</small>';
    else if (solo) status = 'Solo games: pick one and chase your best.' + (opponent && !opponent.bot ? '<br><small>Whoever picks a game plays it; the other phone watches.</small>' : '');
    else if (!opponent) status = 'Waiting for an opponent to join…<br>No one around? Play the 🤖 computer: ' + Ark.botLevelsHtml(null);
    else if (opponent.bot) status = 'You vs the 🤖 <strong>computer</strong>: ' + Ark.botLevelsHtml(opponent.bot, true) + '<br><small>Games marked 🤖 Vs computer can be played against it.</small>';
    else if (!opponent.connected) status = Ark.escapeHtml(opponent.name) + ' is reconnecting…';
    else status = 'You vs <strong>' + Ark.escapeHtml(opponent.name) + '</strong>. Pick a game!';
    $('lobby-status').innerHTML = status;
    const h2h = Ark.h2hHtml(state.players, state.h2h);
    $('h2h').innerHTML = h2h;
    $('h2h').classList.toggle('hidden', !h2h || solo);
    // The 1 player lobby: your solo pages (stats, achievements, unlocks, the daily calendar).
    $('solo-links').classList.toggle('hidden', !solo);
    document.querySelectorAll('#solo-links [data-solo]').forEach(function (a) { a.href = a.getAttribute('data-solo') + '?name=' + encodeURIComponent(me.name); });
    $('tourney').innerHTML = solo ? '' : Ark.tournamentHtml(state.players, state.tournament, { controls: true });

    const newest = Math.max.apply(null, state.games.map(function (g) { return g.lastPlayed || 0; }));
    const pads = Ark.controllerSeated(state);
    const games = Ark.lobbyEntries(state.games, openFolder);
    const inFolder = Boolean(games[0] && games[0].back);
    if (!inFolder) openFolder = null;
    $('phone-games').innerHTML =
      (inFolder ? '' : '<button data-game="random" class="random"' + (state.readyToPlay ? '' : ' disabled') + '><strong>🎲 Random game</strong><span>Can\'t decide? Let the hub pick.</span></button>') +
      // The 1 player lobby: today's daily challenge.
      (!inFolder && solo && state.daily && state.daily.playable !== false ? (function (d) {
        return '<button data-game="daily" class="random daily' + (d.done ? ' done' : '') + '"' + (state.readyToPlay ? '' : ' disabled') + '><strong>' + d.name + '</strong><span>' + d.tagline + '</span></button>';
      })(Ark.dailyCard(state.daily)) : '') +
      games.map(function (g, i) {
      if (g.back) return '<button data-back class="random back"><strong>' + Ark.escapeHtml(g.name) + '</strong><span>' + Ark.escapeHtml(g.tagline) + '</span></button>';
      if (g.folderCard) {
        return (i === 0 || games[i - 1].category !== g.category ? '<h3 class="game-group">' + GROUPS[g.category] + '</h3>' : '') +
          '<button data-folder="' + Ark.escapeHtml(g.folderCard) + '" class="folder"><strong>' + Ark.escapeHtml(g.name) + (newest && g.lastPlayed === newest ? ' <em class="tag">⏱ Last played</em>' : '') + '</strong><span>' + Ark.escapeHtml(g.tagline) + '</span></button>';
      }
      const heading = !inFolder && (i === 0 || games[i - 1].category !== g.category)
        ? '<h3 class="game-group">' + (GROUPS[g.category] || Ark.escapeHtml(g.category)) + '</h3>'
        : '';
      const botTag = Ark.botTag(state, g); // (with the computer seated, a game it can't play is greyed out)
      const off = (pads && g.phoneOnly) || Boolean(botTag);
      return (
        heading +
        '<button data-game="' + Ark.escapeHtml(g.id) + '"' + (off ? ' class="phone-only"' : '') + (state.readyToPlay && !off ? '' : ' disabled') + '>' +
        '<strong>' + Ark.escapeHtml(g.name) + (newest && g.lastPlayed === newest ? ' <em class="tag">⏱ Last played</em>' : '') + (pads && g.phoneOnly ? ' <em class="tag">📱 Phones only</em>' : botTag ? ' ' + botTag : ' ' + Ark.practiceTag(state, g)) + Ark.onlineTag(state, g) + Ark.gameLabels(g) + '</strong>' +
        '<span>' + Ark.escapeHtml(g.blurb || g.tagline) + '</span>' +
        (g.solo && Ark.bestLine(g) ? '<em class="best">' + Ark.bestLine(g) + '</em>' : '') +
        '</button>'
      );
    }).join('');
  }

  // The lobby's 2 players / 1 player switch: which games it lists (the 1v1 ones, or the solo ones).
  $('mode-pick').addEventListener('click', function (e) {
    const b = e.target.closest('[data-mode]');
    if (!b || !state || b.getAttribute('data-mode') === state.mode) return;
    openFolder = null;
    socket.emit('lobby:mode', { mode: b.getAttribute('data-mode') }, function (res) {
      if (res && res.error) alert(res.error);
    });
  });

  Ark.bindTournament($('tourney'), socket);

  // The computer opponent: a level button seats it (or changes its level), ✕ sends it away.
  $('lobby-status').addEventListener('click', function (e) {
    const lvl = e.target.closest('[data-bot]');
    if (lvl) return socket.emit('bot:join', { level: lvl.getAttribute('data-bot') }, function (res) { if (res && res.error) alert(res.error); });
    if (e.target.closest('[data-bot-leave]')) socket.emit('bot:leave');
  });

  /** At the end of a match the phones show the tournament score too. */
  function renderTourneyBar() {
    const t = state && state.tournament;
    const show = Boolean(state && state.phase === 'playing' && t && t.bestOf && lastView && lastView.gameId === state.gameId && lastView.view.phase === 'over');
    $('tourney-bar').classList.toggle('hidden', !show);
    $('tourney-bar').innerHTML = show ? Ark.tournamentHtml(state.players, t, { compact: true }) : '';
  }

  $('phone-games').addEventListener('click', function (e) {
    const folder = e.target.closest('[data-folder]');
    if (folder || e.target.closest('[data-back]')) {
      openFolder = folder ? folder.getAttribute('data-folder') : null;
      renderLobby();
      return window.scrollTo(0, $('phone-games').offsetTop - 12);
    }
    const btn = e.target.closest('[data-game]');
    if (!btn || btn.disabled) return;
    socket.emit('lobby:start', { gameId: btn.getAttribute('data-game') }, function (res) {
      if (res && res.error) alert(res.error); // e.g. a controller joined a moment ago
    });
  });

  // ---- game ------------------------------------------------------------

  // Screen first, server later: a tap that sends a move shows on the button straight away (it
  // looks pressed, "sent"), until the server's next view, or a second at most (a move it refused
  // sends no view). Over the internet that's a tenth of a second or more saved. The game's own
  // look for the move follows with the view. (Action games' controls go on touch, not taps.)
  let tapped = null;
  let sentTimer = null;
  const SENT_MS = 1000;
  $('phone-stage').addEventListener('click', function (e) {
    tapped = { el: e.target.closest('button, [data-choice], [data-card], [data-pick], [data-col], [data-i], [data-side], [data-c]'), at: performance.now() };
  }, true);
  function clearSent() {
    clearTimeout(sentTimer);
    sentTimer = null;
    document.querySelectorAll('#phone-stage .ark-sent').forEach(function (el) { el.classList.remove('ark-sent'); });
  }
  function markSent() {
    if (!tapped || !tapped.el || performance.now() - tapped.at > 300 || !tapped.el.isConnected) return;
    tapped.el.classList.add('ark-sent');
    tapped = null;
    clearTimeout(sentTimer);
    sentTimer = setTimeout(clearSent, SENT_MS);
  }

  const api = {
    send: function (input) {
      socket.emit('game:input', input);
      markSent();
    },
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
      return 'https://' + location.host + (NO_TV ? '/phone' : '/play/') + '?' + q.toString();
    },
  };

  function unmountGame() {
    if (current && current.renderer && current.renderer.unmount) current.renderer.unmount();
    if (current && current.split && current.tv && current.tv.unmount) current.tv.unmount();
    Ark.phoneClock(0); // a game's clock doesn't outlive it
    current = null;
    $('phone-stage').innerHTML = '';
    $('phone-stage').classList.remove('split');
    showSolo(null);
  }

  /** The running game's lobby entry (its name, whether it's a solo game, how it's scored). */
  function currentGame() {
    return state && (state.games || []).find(function (g) { return g.id === state.gameId; });
  }

  /**
   * A solo game (the lobby's 1 player mode): the phone whose game it is gets the hub's end screen
   * (score, best, what it unlocked, play again); the other phone just watches. The game's own
   * screen shows the rest of the time. Returns true when the game's screen is covered.
   */
  let soloKey = '';
  function showSolo(v) {
    const g = v && currentGame();
    const solo = Boolean(g && g.solo && state && state.phase === 'playing');
    const watching = solo && v.watching;
    const over = solo && !watching && v.phase === 'over';
    $('solo-watch').classList.toggle('hidden', !watching);
    $('run-over').classList.toggle('hidden', !over);
    if (watching) {
      const p = state.players[v.soloSlot];
      const html = '<div>👀 Watching</div><strong>' + Ark.escapeHtml(p ? p.name : '') + '</strong><div>play ' + Ark.escapeHtml(g.name) + (v.variant ? ' · ' + Ark.escapeHtml(v.variant) : '') + '</div>' +
        (v.phase === 'over' ? '<div class="ro-score">' + Ark.formatScore(v.score, g.score.unit) + '</div>' : '');
      if ($('solo-watch').innerHTML !== html) $('solo-watch').innerHTML = html;
    }
    if (over) {
      const r = current && current.renderer;
      const tv = current && current.tv;
      let extra = '';
      try {
        // Phone only: the game's line comes from its TV renderer, which reads the TV's view (a split game has it).
        extra = r && r.overHtml ? r.overHtml(v) : tv && tv.overHtml ? tv.overHtml(lastView && lastView.tv ? lastView.tv : v) : '';
      } catch (e) { /* the end screen shows without it */ }
      const html = Ark.soloOverHtml(v, g, extra) + (v.daily
        ? '<div class="ro-extra">📅 That was today\'s challenge. A new one comes at midnight (UTC).</div><button class="primary rematch" data-ro="lobby">Pick another game</button>'
        : '<button class="primary rematch" data-ro="rematch">Play again</button>' +
          '<div class="ro-row">' + (v.hubSetup ? '<button class="ghost" data-ro="setup">⚙ Change settings</button>' : '') +
          '<button class="ghost" data-ro="lobby">Pick another game</button></div>');
      if (html !== soloKey) {
        soloKey = html;
        $('run-over').innerHTML = html;
        if (v.record && ((v.record.newBest && v.record.score !== null) || (v.record.unlocked && v.record.unlocked.length))) api.vibrate([60, 40, 60, 40, 120]);
      }
    } else soloKey = '';
    const covered = watching || over;
    if (state && state.phase === 'playing' && !Ark.setup.isHub(v)) $('phone-stage').classList.toggle('hidden', covered);
    return covered;
  }
  $('run-over').addEventListener('click', function (e) {
    const btn = e.target.closest('[data-ro]');
    if (!btn) return;
    if (btn.getAttribute('data-ro') === 'lobby') socket.emit('lobby:return');
    else api.send({ type: btn.getAttribute('data-ro') });
  });

  function mountGame(gameId) {
    unmountGame();
    const game = currentGame();
    // Phone only and a 'split' game (the arcade ones): the TV's picture on top, the phone's controls below.
    const split = NO_TV && Boolean(game && game.phone === 'split');
    const mounting = { gameId: gameId, renderer: null, tv: null, split: split };
    current = mounting;
    const stage = $('phone-stage');
    stage.classList.toggle('split', split);
    if (split) stage.innerHTML = '<div class="split-tv"></div><div class="split-pad"></div>';
    // Phone only: there's no TV, so borrow its renderer for the sounds and the end screen's line
    // (and, split, to draw the picture).
    if (NO_TV) {
      Ark.loadRenderer('host', gameId).then(function (tv) {
        if (current !== mounting) return;
        if (split) {
          tv.mount(stage.querySelector('.split-tv'), { players: state.players });
          if (lastView && lastView.gameId === gameId && lastView.tv && !Ark.setup.isHub(lastView.tv)) tv.update(lastView.tv);
        }
        mounting.tv = tv;
      }).catch(function () { /* no sounds, that's all */ });
    }
    Ark.loadRenderer('player', gameId).then(function (renderer) {
      if (current !== mounting) return;
      mounting.renderer = renderer;
      renderer.mount(split ? stage.querySelector('.split-pad') : stage, api);
      if (lastView && lastView.gameId === gameId && !Ark.setup.isHub(lastView.view) && !lastView.view.watching) renderer.update(lastView.view);
      syncZoom();
    }).catch(function (err) {
      $('phone-stage').textContent = err.message;
    });
  }

  socket.on('room:state', function (s) {
    state = s;
    if (s.phase !== 'playing') document.body.classList.remove('match-over');
    if (me) applyState();
    if (me) Ark.showTrophies(s, me.slot, me.name); // (your new trophies)
  });

  // Your avatar and colour, in the header (your P1 / P2 colour stays the phone's, as in the games).
  let picker = null;
  function renderMe() {
    const p = state && me && state.players[me.slot];
    const profile = p && p.name === me.name ? p.profile : null;
    if (!profile) return;
    $('me-avatar').innerHTML = Ark.avatarHtml(profile);
    if (picker) picker.update(profile);
  }
  function openPicker() {
    const p = state && me && state.players[me.slot];
    $('menu').classList.add('hidden');
    if (!p || picker) return;
    picker = Ark.profilePicker({
      profile: p.profile,
      onPick: function (fields) {
        socket.emit('profile:set', fields, function (res) {
          if (res && res.error) alert(res.error);
        });
      },
      onClose: function () { picker = null; },
    });
  }
  $('me-avatar').addEventListener('click', openPicker);
  $('profile-btn').addEventListener('click', openPicker);
  // Your trophies: every one, the ones you've got lit (a page of its own, back here after).
  $('trophies-btn').addEventListener('click', function () {
    if (me) location.href = '/trophies/?name=' + encodeURIComponent(me.name);
  });

  function applyState() {
    const s = state;
    renderMe();
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
    if (msg.kept) {
      if (!fullView || fullView.gameId !== msg.gameId) return socket.emit('game:resync');
      const view = Object.assign({}, msg.view);
      msg.kept.forEach(function (key) { view[key] = fullView.view[key]; });
      msg = { gameId: msg.gameId, view: view, tv: msg.tv };
    }
    const old = lastView && lastView.gameId === msg.gameId ? lastView : null;
    fullView = msg;
    lastView = msg;
    const v = msg.view;
    // Phone only: the sounds go by the TV's view when there is one (the TV renderer's sounds() expects it).
    if (NO_TV) playSounds(old && (msg.tv ? old.tv : old.view), msg.tv || v);
    if (msg.tv && current && current.split && current.tv && current.gameId === msg.gameId && !Ark.setup.isHub(msg.tv)) current.tv.update(msg.tv);
    showHubSetup(Ark.setup.isHub(v) ? v : null);
    const g = currentGame();
    // (a solo game's end screen has its own Change settings)
    $('hub-change').classList.toggle('hidden', !(v.hubSetup && v.phase === 'over') || Boolean(g && g.solo));
    document.body.classList.toggle('match-over', v.phase === 'over'); // (for the themes)
    renderTourneyBar();
    if (showSolo(v)) {
      if (current && current.renderer && current.gameId === msg.gameId && !v.watching) current.renderer.update(v);
      return;
    }
    if (Ark.setup.isHub(v)) return; // the game hasn't started: the hub shows its setup screen
    if (sentTimer) clearSent(); // (the server's word: the game draws the move itself now)
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
      if (preview) preview.stop();
      preview = null;
      previewFor = null;
      return;
    }
    const game = state && (state.games || []).find(function (g) { return g.id === state.gameId; });
    // The game's preview (its picture and the dialog box: tap it for the next) is drawn once, so the
    // box keeps turning while the settings under it change.
    if (previewFor !== state.gameId || !$('hub-setup').querySelector('.hub-settings')) {
      if (preview) preview.stop();
      previewFor = state.gameId;
      hubSetupKey = '';
      $('hub-setup').innerHTML =
        '<div class="hub-title">' + Ark.escapeHtml(game ? game.name : '') + '</div>' +
        (game && game.blurb ? '<p class="hub-blurb">' + Ark.escapeHtml(game.blurb) + '</p>' : '') +
        '<div class="hub-cols"><div class="hub-preview"></div><div class="hub-settings"></div></div>';
      preview = Ark.preview.open($('hub-setup').querySelector('.hub-preview'), game);
    }
    const key = JSON.stringify(v.hubSetup.settings);
    if (key === hubSetupKey) return;
    hubSetupKey = key;
    const parts = Ark.setup.hubParts(v);
    $('hub-setup').querySelector('.hub-settings').innerHTML =
      '<p class="muted">' + (game && game.solo ? 'Pick the settings, then start.' : 'Pick the settings (either of you can), then start.') + '</p>' +
      Ark.setup.html(parts.view, parts.rows) +
      '<button class="primary hub-go">Start</button>';
  }
  Ark.setup.bind($('hub-setup'), api);
  let preview = null; // the game's preview above its settings (Ark.preview), and which game it's for
  let previewFor = null;
  $('hub-setup').addEventListener('click', function (e) {
    if (e.target.closest('.hub-go')) api.send({ type: 'go' });
  });
  $('hub-change').addEventListener('click', function () { api.send({ type: 'setup' }); });

  // ---- sound (phone only) ---------------------------------------------------
  // With a TV, the TV plays the sounds. Without one, the phone does: the same shared
  // effects (the countdown, the end of a run) and the game's own, from its TV renderer.

  if (NO_TV) {
    Ark.loadScript('/host/sound.js').then(function () {
      const btn = $('sound-btn');
      btn.classList.remove('hidden');
      const label = function () { btn.textContent = ArkSound.isMuted() ? '🔇 Sound is off' : '🔊 Sound is on'; };
      btn.addEventListener('click', function () { ArkSound.setMuted(!ArkSound.isMuted()); });
      ArkSound.onChange(label);
      label();
    });
  }

  function playSounds(prev, v) {
    if (!window.ArkSound || !v || Ark.setup.isHub(v)) return;
    const names = [];
    if (prev && !Ark.setup.isHub(prev)) {
      if (v.countdown > 0 && v.countdown !== prev.countdown) names.push('tick');
      if (prev.countdown > 0 && !(v.countdown > 0) && v.phase !== 'over') names.push('go');
      if (v.phase === 'over' && prev.phase !== 'over') names.push('fanfare');
      const tv = current && current.tv;
      if (tv && tv.sounds) {
        try { (tv.sounds(prev, v) || []).forEach(function (n) { names.push(n); }); } catch (e) { /* a sound bug never breaks the game */ }
      }
    } else if (v.countdown > 0) {
      names.push('tick');
    }
    names.forEach(ArkSound.play);
  }

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
