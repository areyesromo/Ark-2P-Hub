// Small helpers shared by the TV page, the phone page and the game renderers.
// Kept to plain ES2017 so it runs on older smart-TV browsers.
(function () {
  const renderers = { host: {}, player: {} };
  const loading = {};

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Game renderers register themselves from /games/<id>/<kind>.js:
   *
   *   Ark.register('player', 'reaction-duel', {
   *     mount(el, api) { ... },   // build the DOM once
   *     update(view) { ... },     // called with every new view from the server
   *     unmount() { ... },        // optional cleanup
   *     zoomable(view) { ... },   // optional, phones: true on menu screens the game draws itself
   *   });                         // (its own setup), so pinch zoom stays on there
   */
  function register(kind, gameId, renderer) {
    renderers[kind][gameId] = renderer;
  }

  /** Load a game's renderer script on demand. Resolves to the renderer. */
  function loadRenderer(kind, gameId) {
    if (renderers[kind][gameId]) return Promise.resolve(renderers[kind][gameId]);
    const key = kind + ':' + gameId;
    if (!loading[key]) {
      loading[key] = new Promise(function (resolve, reject) {
        const s = document.createElement('script');
        s.src = '/games/' + encodeURIComponent(gameId) + '/' + kind + '.js';
        s.onload = function () {
          if (renderers[kind][gameId]) resolve(renderers[kind][gameId]);
          else reject(new Error('Renderer did not register: ' + key));
        };
        s.onerror = function () {
          delete loading[key];
          reject(new Error('Could not load ' + s.src));
        };
        document.head.appendChild(s);
      });
    }
    return loading[key];
  }

  /** Load a helper script once (e.g. drawing code shared by a game's TV and phone renderers). */
  const scripts = {};
  function loadScript(src) {
    if (!scripts[src]) {
      scripts[src] = new Promise(function (resolve, reject) {
        const s = document.createElement('script');
        s.src = src;
        s.onload = resolve;
        s.onerror = function () {
          delete scripts[src];
          reject(new Error('Could not load ' + src));
        };
        document.head.appendChild(s);
      });
    }
    return scripts[src];
  }

  /** Add a game's stylesheet once. */
  function loadCss(href) {
    if (document.querySelector('link[data-ark-css="' + href + '"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = href;
    link.setAttribute('data-ark-css', href);
    document.head.appendChild(link);
  }

  /** Scoreboard markup used by game screens on the TV. */
  function scoreboardHtml(players, scores, winScore, round) {
    function side(slot) {
      let pips = '';
      for (let i = 0; i < winScore; i++) {
        pips += '<span class="pip' + (i < scores[slot] ? ' on' : '') + '"></span>';
      }
      return (
        '<div class="side p' + (slot + 1) + '-text' + (slot === 1 ? ' right' : '') + '">' +
        '<span class="name">' + escapeHtml(players[slot].name) + '</span>' +
        '<span class="pips">' + pips + '</span>' +
        '</div>'
      );
    }
    return (
      '<div class="scoreboard">' + side(0) +
      (round ? '<span class="round">Round ' + round + '</span>' : '') +
      side(1) + '</div>'
    );
  }

  /**
   * One-line head-to-head record between the two seated players, from the
   * room state (state.h2h, oriented player 1 vs player 2). Empty when not
   * both seats are taken.
   */
  function h2hHtml(players, h) {
    if (!h || !players[0] || !players[1]) return '';
    const a = '<span class="p1-text">' + escapeHtml(players[0].name) + '</span>';
    const b = '<span class="p2-text">' + escapeHtml(players[1].name) + '</span>';
    if (!h.played && !h.team.played) return '🏆 First time ' + a + ' and ' + b + ' have played here. Good luck!';
    const parts = [];
    if (h.played) {
      parts.push('🏆 ' + a + ' <strong>' + h.wins[0] + ' – ' + h.wins[1] + '</strong> ' + b +
        (h.draws ? ' <span class="muted">(' + h.draws + ' draw' + (h.draws === 1 ? '' : 's') + ')</span>' : ''));
      const last = h.recent[0];
      if (last) {
        const who = last.winner === null ? 'draw' : (last.winner === 0 ? a : b) + ' won';
        parts.push('<span class="muted">last: ' + escapeHtml(last.name) + ', ' + who + (last.scores ? ' ' + last.scores.join('–') : '') + '</span>');
      }
    }
    if (h.titles && (h.titles[0] || h.titles[1])) parts.push('🏆 tournaments ' + a + ' <strong>' + h.titles[0] + ' – ' + h.titles[1] + '</strong> ' + b);
    if (h.cups && (h.cups[0] || h.cups[1])) parts.push('🏅 kart cups ' + a + ' <strong>' + h.cups[0] + ' – ' + h.cups[1] + '</strong> ' + b);
    if (h.team.played) parts.push('🎨 ' + h.team.stars + '⭐ together');
    return parts.join(' · ');
  }

  /**
   * The tournament (best of N games, see server/tournament.js) from the room
   * state. opts.controls adds the length buttons and "start over"
   * (data-tourney="0|3|5|7|reset"); opts.compact is the one-line version for
   * the TV during a game. Empty when it's off and there are no controls.
   */
  function tournamentHtml(players, t, opts) {
    opts = opts || {};
    if (!t || (!t.bestOf && !opts.controls)) return '';
    const name = function (slot) {
      return '<span class="p' + (slot + 1) + '-text">' + escapeHtml(players[slot] ? players[slot].name : 'Player ' + (slot + 1)) + '</span>';
    };
    const pips = function (slot) {
      let html = '';
      for (let i = 0; i < t.target; i++) html += '<i class="pip' + (i < t.wins[slot] ? ' p' + (slot + 1) : '') + '"></i>';
      return '<span class="pips">' + html + '</span>';
    };
    const score = t.bestOf
      ? '<div class="t-score">' + name(0) + ' ' + pips(0) + ' <strong>' + t.wins[0] + ' – ' + t.wins[1] + '</strong> ' + pips(1) + ' ' + name(1) + '</div>'
      : '';
    const champ = t.champion === 0 || t.champion === 1
      ? '<div class="t-champ">🏆 ' + name(t.champion) + ' wins the tournament ' + t.wins[t.champion] + '–' + t.wins[1 - t.champion] + '!</div>'
      : '';
    const head = '<div class="t-head">🏆 Tournament' + (t.bestOf
      ? ' <span class="muted">best of ' + t.bestOf + ' games · first to ' + t.target + (champ ? ' · the next game starts a new one' : '') + '</span>'
      : ' <span class="muted">· a series across games, off for now</span>') + '</div>';
    if (opts.compact) return '<div class="ark-tourney compact">' + (champ || score) + '</div>';
    let html = head;
    if (opts.controls) {
      html += '<div class="t-lengths">' + (t.lengths || [0, 3, 5, 7]).map(function (n) {
        return '<button class="ghost' + (n === t.bestOf ? ' on' : '') + '" data-tourney="' + n + '">' + (n ? 'Best of ' + n : 'Off') + '</button>';
      }).join('') + '</div>';
    }
    html += champ + score;
    if (t.games && t.games.length) {
      html += '<div class="t-games">' + t.games.map(function (g) {
        return '<span class="chip' + (g.winner === null ? '' : ' p' + (g.winner + 1)) + '">' + escapeHtml(g.game) + ' · ' +
          (g.winner === null ? 'draw' : escapeHtml(players[g.winner] ? players[g.winner].name : 'P' + (g.winner + 1))) + '</span>';
      }).join('') + '</div>';
      if (opts.controls) html += '<button class="ghost t-reset" data-tourney="reset">↺ Start over</button>';
    }
    return '<div class="ark-tourney' + (t.bestOf ? ' on' : '') + '">' + html + '</div>';
  }

  /** Clicks on tournament controls (see tournamentHtml) -> the lobby:tournament event. */
  function bindTournament(el, socket) {
    el.addEventListener('click', function (e) {
      const btn = e.target.closest('[data-tourney]');
      if (!btn) return;
      const v = btn.getAttribute('data-tourney');
      socket.emit('lobby:tournament', v === 'reset' ? { reset: true } : { bestOf: Number(v) });
    });
  }

  // ---- setup screens (match settings picked before a game starts) ----
  // A game's views carry `settings` ({ key: value }) and `options`
  // ({ key: [values] }, see server/games/options.js). rows describes how to
  // show them: [{ key, title, fmt(value) -> label }].

  /** Each option's values, smallest first. */
  function setupChoices(v, key) {
    return v.options[key].slice().sort(function (a, b) { return a - b; });
  }

  /**
   * The settings as rows of buttons (phones tap them: data-key / data-value).
   * focus: { key: 'p1 p2' } outlines the rows controller players are on (TV).
   */
  function setupHtml(v, rows, focus) {
    return '<div class="ark-setup">' + rows.map(function (row) {
      const f = focus && focus[row.key] ? ' focus ' + focus[row.key] : '';
      return '<div class="row' + f + '"><div class="title">' + row.title + '</div><div class="seg">' +
        setupChoices(v, row.key).map(function (value) {
          const on = v.settings[row.key] === value;
          return '<button type="button" class="opt' + (on ? ' on' : '') + '" aria-pressed="' + on + '" data-key="' + row.key + '" data-value="' + value + '">' +
            row.fmt(value) + '</button>';
        }).join('') + '</div></div>';
    }).join('') + '</div>';
  }

  /** One line summing the settings up, e.g. "5×5 · 2 min · Best of 3". */
  function setupSummary(v, rows) {
    return rows.map(function (row) { return row.fmt(v.settings[row.key]); }).join(' · ');
  }

  /**
   * A controller on the setup screen: ↑↓ picks a row (state.row, kept by the
   * renderer per player), ←→ changes it, A / Start begins. Returns the input
   * to send, or null (call render again if state.row changed).
   */
  function setupPad(btn, v, rows, state) {
    if (btn === 'A' || btn === 'START') return { type: 'go' };
    if (btn === 'UP' || btn === 'DOWN') {
      state.row = ((state.row || 0) + (btn === 'UP' ? -1 : 1) + rows.length) % rows.length;
      return null;
    }
    if (btn === 'LEFT' || btn === 'RIGHT') {
      const key = rows[state.row || 0].key;
      const list = setupChoices(v, key);
      // Wraps round, so the far end of a long list is one press away.
      const i = (list.indexOf(v.settings[key]) + (btn === 'LEFT' ? -1 : 1) + list.length) % list.length;
      return { type: 'setting', key: key, value: list[i] };
    }
    return null;
  }

  /** The focus map for setupHtml from controller players' rows: pads = { slot: { row } }. */
  function setupFocus(v, rows, pads) {
    const focus = {};
    [0, 1].forEach(function (slot) {
      if (!v.players[slot].local) return;
      const key = rows[(pads[slot] && pads[slot].row) || 0].key;
      focus[key] = (focus[key] ? focus[key] + ' ' : '') + 'p' + (slot + 1);
    });
    return focus;
  }

  /**
   * The hub's own setup screen, for games wrapped with withSetup on the server
   * (their views carry hubSetup: { rows, settings, options }).
   */
  function isHubSetup(v) {
    return Boolean(v && v.hubSetup && v.phase === 'setup');
  }

  /** hubSetup's rows ({ key, title, labels }) as setupHtml rows, plus a view-like object for it. */
  function hubSetupParts(v) {
    const h = v.hubSetup;
    return {
      rows: h.rows.map(function (r) { return { key: r.key, title: escapeHtml(r.title), fmt: function (value) { return escapeHtml(r.labels[value] || String(value)); } }; }),
      view: { settings: h.settings, options: h.options, players: v.players },
    };
  }

  /** Phones: send a setting when one of setupHtml's buttons inside `el` is tapped. */
  function bindSetup(el, api) {
    el.addEventListener('click', function (e) {
      const btn = e.target.closest && e.target.closest('.ark-setup .opt');
      if (!btn) return;
      // Numbers go as numbers; word choices ('fast', '3d') as they are.
      const raw = btn.getAttribute('data-value');
      api.send({ type: 'setting', key: btn.getAttribute('data-key'), value: raw !== '' && !isNaN(raw) ? Number(raw) : raw });
      if (api.vibrate) api.vibrate(8);
    });
  }

  /**
   * Reload the page when the server comes back as a newer version (after an
   * update, e.g. the Pi's auto-update), so screens never run stale code.
   * onVersion(v) is called with /version's answer.
   */
  function watchVersion(socket, onVersion) {
    let loaded = null;
    const stamp = function (v) { return v.version + '|' + v.commit + '|' + v.built; };
    function check() {
      fetch('/version', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (v) {
        if (onVersion) onVersion(v);
        if (loaded === null) loaded = stamp(v);
        else if (stamp(v) !== loaded) location.reload();
      }).catch(function () { /* server still starting; the next connect checks again */ });
    }
    check();
    socket.on('connect', check);
  }

  /** True when a controller (plugged into the TV) holds a seat: phone-only games are off then. */
  function controllerSeated(state) {
    return Boolean(state && state.players && state.players.some(function (p) { return p && p.local; }));
  }

  // ---- the TV lobby's layout change (QR code panel on / off) ----

  const switching = new WeakMap(); // lobby -> the layout it's on its way to, while the panel fades out
  const reducedMotion = function () { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; };

  /**
   * Turn the lobby's `cls` layout on or off, animated: going on, `leaving`
   * (the QR panel) fades out to the left, then the `moving` blocks (the
   * players, the game list) glide from where they were to their new place:
   * a block that grows unfolds from its old size, a smaller one slides
   * across. Going off, the blocks glide back and the panel fades in.
   * No animation while the lobby is hidden, the first time, or for players
   * who ask their device for less motion.
   */
  function lobbyLayout(lobby, cls, on, leaving, moving, animate) {
    const busy = switching.has(lobby);
    if (busy) switching.set(lobby, on);
    if (busy || lobby.classList.contains(cls) === on) return;
    if (!animate || reducedMotion() || !lobby.getClientRects().length || !leaving.animate) {
      lobby.classList.toggle(cls, on);
      return;
    }
    const ease = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
    function glide(target) {
      const before = moving.map(function (el) { return el.getBoundingClientRect(); });
      lobby.classList.toggle(cls, target);
      moving.forEach(function (el, i) {
        const a = before[i];
        const b = el.getBoundingClientRect();
        const from = { transform: 'translate(' + (a.left - b.left) + 'px, ' + (a.top - b.top) + 'px)' };
        const to = { transform: 'none' };
        if (a.width < b.width - 1 || a.height < b.height - 1) {
          // Growing: show only its old size at first, then open it up (no stretched text).
          const r = getComputedStyle(el).borderTopLeftRadius || '0px';
          from.clipPath = 'inset(0 ' + Math.max(0, b.width - a.width) + 'px ' + Math.max(0, b.height - a.height) + 'px 0 round ' + r + ')';
          to.clipPath = 'inset(0 0 0 0 round ' + r + ')';
        }
        el.animate([from, to], { duration: 520, easing: ease });
      });
      if (!target) leaving.animate([{ opacity: 0, transform: 'translateX(-3rem)' }, { opacity: 1, transform: 'none' }], { duration: 420, delay: 120, easing: 'ease-out', fill: 'backwards' });
    }
    if (!on) return glide(false);
    switching.set(lobby, true);
    leaving.animate([{ opacity: 1 }, { opacity: 0, transform: 'translateX(-3rem) scale(0.96)' }], { duration: 260, easing: 'ease-in' }).onfinish = function () {
      const target = switching.get(lobby);
      switching.delete(lobby);
      if (target) glide(true);
    };
  }

  window.Ark = {
    lobbyLayout: lobbyLayout,
    watchVersion: watchVersion,
    h2hHtml: h2hHtml,
    tournamentHtml: tournamentHtml,
    bindTournament: bindTournament,
    escapeHtml: escapeHtml,
    controllerSeated: controllerSeated,
    register: register,
    loadRenderer: loadRenderer,
    loadCss: loadCss,
    loadScript: loadScript,
    scoreboardHtml: scoreboardHtml,
    setup: { html: setupHtml, summary: setupSummary, pad: setupPad, focus: setupFocus, bind: bindSetup, choices: setupChoices, isHub: isHubSetup, hubParts: hubSetupParts },
    colorFor: function (slot) { return slot === 0 ? 'var(--p1)' : 'var(--p2)'; },
  };
})();
