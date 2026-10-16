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
   *   });
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
    if (h.team.played) parts.push('🎨 ' + h.team.stars + '⭐ together');
    return parts.join(' · ');
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

  window.Ark = {
    watchVersion: watchVersion,
    h2hHtml: h2hHtml,
    escapeHtml: escapeHtml,
    register: register,
    loadRenderer: loadRenderer,
    loadCss: loadCss,
    loadScript: loadScript,
    scoreboardHtml: scoreboardHtml,
    colorFor: function (slot) { return slot === 0 ? 'var(--p1)' : 'var(--p2)'; },
  };
})();
