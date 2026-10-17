(function () {
  Ark.loadCss('/games/word-race/style.css');
  const gridReady = Ark.loadScript('/games/word-race/grid.js');
  const esc = Ark.escapeHtml;
  const MOVES = { UP: [-1, 0], DOWN: [1, 0], LEFT: [0, -1], RIGHT: [0, 1] }; // [rows, cols]
  const SUBMIT = ['Y', 'X', 'RB', 'RT'];

  let root = null;
  let view = null;
  let viewAt = 0;
  let loaded = false;
  let raf = null;
  let textKey = '';
  const pads = {}; // controller players: slot -> { cursor, path, row (setup screen) }

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function padOf(slot) {
    if (!pads[slot]) pads[slot] = { cursor: 0, path: [], row: 0 };
    return pads[slot];
  }

  function wordList(v, slot) {
    const t = v.result.tally[slot];
    if (!t.length) return '<p class="muted">No words</p>';
    return '<ul>' + t.map(function (w) {
      return '<li class="' + (w.shared ? 'shared' : '') + '">' + esc(w.word.toUpperCase()) + '<em>' + (w.shared ? '×' : '+' + w.points) + '</em></li>';
    }).join('') + '</ul>';
  }

  function side(v, slot) {
    let body;
    if (v.phase === 'setup') {
      body = '<div class="muted">' + (v.players[slot].local ? '🎮 controller' : '📱 phone') + '</div>';
    } else if (v.result) {
      body = '<div class="pts">' + v.result.points[slot] + ' pts</div>' + wordList(v, slot);
    } else {
      body = '<div class="count">' + v.counts[slot] + '</div><div class="muted">word' + (v.counts[slot] === 1 ? '' : 's') + ' found</div>';
    }
    return '<div class="wr-side p' + (slot + 1) + '"><div class="name">' + nameOf(v, slot) + '</div>' + body + '</div>';
  }

  function setup(v) {
    const focus = {};
    [0, 1].forEach(function (slot) {
      if (!v.players[slot].local) return;
      const key = ArkWords.KEYS[padOf(slot).row];
      focus[key] = (focus[key] ? focus[key] + ' ' : '') + 'p' + (slot + 1);
    });
    return '<div class="wr-center"><div class="wr-banner">Set up the match</div>' + ArkWords.setupHtml(v, focus) +
      '<div class="sub">Change it on your phone, or with a controller: ↑↓ picks a row, ←→ changes it. ' +
      '<strong>Start</strong> (or <strong>A</strong>) when you\'re both ready.</div></div>';
  }

  function middle(v) {
    if (v.phase === 'setup') return loaded ? setup(v) : '';
    if (v.phase === 'countdown') {
      return '<div class="wr-center"><div class="big">' + (v.countdown || '') + '</div><div class="sub">Round ' + v.round +
        ': find words by joining touching letters. Words you both find cancel out!</div>' +
        (loaded ? '<div class="sub">' + ArkWords.summary(v) + '</div>' : '') + '</div>';
    }
    if (!loaded || !v.grid) return '';
    const paths = [];
    const cursors = [];
    if (v.phase === 'play') {
      [0, 1].forEach(function (slot) {
        if (!v.players[slot].local) return;
        const p = padOf(slot);
        paths.push({ path: p.path, cls: 'p' + (slot + 1) });
        cursors.push({ i: p.cursor, cls: 'p' + (slot + 1) });
      });
    }
    let banner = '';
    if (v.phase === 'reveal' || v.phase === 'over') {
      const r = v.result;
      banner = r.winner === null ? 'Round ' + v.round + ': a draw!' : nameOf(v, r.winner) + ' takes round ' + v.round + '!';
      if (v.phase === 'over') {
        banner = v.draw ? "🤝 It's a draw!" : '🏆 ' + nameOf(v, v.winner) + ' wins the match!';
        banner += '<div class="sub">Rematch, change the settings (🎮 Y) or head back to the lobby from your phones or controllers.</div>';
      }
      banner = '<div class="wr-banner">' + banner + '<div class="sub">' + v.possible + ' words were hiding in this grid</div></div>';
    }
    return ArkWords.gridHtml(v.grid, v.size, paths, cursors) + '<div class="wr-bar"><div class="fill"></div></div>' + banner;
  }

  function render() {
    if (!root || !view) return;
    const v = view;
    const key = JSON.stringify([v.phase, v.round, v.countdown, v.counts, v.scores, Boolean(v.result), v.settings, loaded, pads]);
    if (key === textKey) return;
    textKey = key;
    root.innerHTML =
      Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="wr-main">' + side(v, 0) + '<div class="wr-mid">' + middle(v) + '</div>' + side(v, 1) + '</div>';
  }

  // The clock bar runs smoothly between the once-a-second views.
  function tick() {
    raf = requestAnimationFrame(tick);
    if (!root || !view) return;
    const bar = root.querySelector('.wr-bar .fill');
    if (!bar) return;
    const frac = view.phase === 'play' ? Math.max(0, view.timeLeftMs - (performance.now() - viewAt)) / view.playMs : 0;
    bar.style.width = (frac * 100).toFixed(2) + '%';
    bar.classList.toggle('low', frac < 0.15);
  }

  Ark.register('host', 'word-race', {
    padHint: 'Setup: ↑↓ row, ←→ change, A start · Game: D-pad moves, A adds a letter, B takes one back, Y sends the word (your opponent sees your trace on the TV)',
    // Sound: a blip for every word found, a chime when the words are revealed.
    sounds: function (prev, v) {
      const out = [];
      if (v.phase === 'play' && v.counts[0] + v.counts[1] > prev.counts[0] + prev.counts[1]) out.push('eat');
      if (v.phase === 'reveal' && prev.phase !== 'reveal') out.push('reveal');
      return out;
    },
    pad: function (btn, v, slot) {
      const p = padOf(slot);
      if (v.phase === 'setup') {
        if (btn === 'A' || btn === 'START') return { type: 'go' };
        if (btn === 'UP' || btn === 'DOWN') {
          p.row = (p.row + (btn === 'UP' ? -1 : 1) + ArkWords.KEYS.length) % ArkWords.KEYS.length;
          render();
          return null;
        }
        if (btn === 'LEFT' || btn === 'RIGHT') {
          const key = ArkWords.KEYS[p.row];
          const list = ArkWords.choices(v, key);
          const i = Math.min(list.length - 1, Math.max(0, list.indexOf(v.settings[key]) + (btn === 'LEFT' ? -1 : 1)));
          return { type: 'setting', key: key, value: list[i] };
        }
        return null;
      }
      if (v.phase === 'over') {
        if (btn === 'A' || btn === 'START') return { type: 'rematch' };
        return btn === 'Y' ? { type: 'setup' } : null;
      }
      if (v.phase !== 'play') return null;
      const n = v.size;
      if (MOVES[btn]) {
        const r = Math.min(n - 1, Math.max(0, Math.floor(p.cursor / n) + MOVES[btn][0]));
        const c = Math.min(n - 1, Math.max(0, (p.cursor % n) + MOVES[btn][1]));
        p.cursor = r * n + c;
      } else if (btn === 'A') {
        const last = p.path[p.path.length - 1];
        if (p.path.indexOf(p.cursor) === -1 && (last === undefined || ArkWords.adjacent(last, p.cursor, n))) p.path.push(p.cursor);
      } else if (btn === 'B') {
        p.path.pop();
      } else if (SUBMIT.indexOf(btn) !== -1 && p.path.length) {
        const path = p.path;
        p.path = [];
        render();
        return { type: 'word', path: path };
      }
      render();
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'wr-host';
      el.appendChild(root);
      raf = requestAnimationFrame(tick);
      gridReady.then(function () {
        loaded = true;
        render();
      });
    },
    update: function (v) {
      if (view && v.round !== view.round) {
        // New round (maybe a new grid size): clear traces, cursors back to the second tile of the second row.
        Object.keys(pads).forEach(function (k) {
          pads[k].path = [];
          pads[k].cursor = v.size + 1;
        });
      }
      view = v;
      viewAt = performance.now();
      render();
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = view = null;
      textKey = '';
      Object.keys(pads).forEach(function (k) { delete pads[k]; });
    },
  });
})();
