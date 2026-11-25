// In the 1 player mode (view.solo) the game is Word Search: its screens are in search.js (ArkWordSearch).
(function () {
  const soloReady = Ark.loadScript('/games/word-hunt/search.js');
  let alone = null; // { el, api, on, view }: handing over to Word Search' screen
  Ark.loadCss('/games/word-hunt/style.css');
  const ready = Ark.loadScript('/games/word-hunt/board.js');
  const esc = Ark.escapeHtml;
  const MOVES = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] };

  let root = null;
  let view = null;
  let key = '';
  let nope = [0, 0];
  const pads = {}; // controller players: slot -> { x, y, from }

  function padOf(slot) {
    if (!pads[slot]) pads[slot] = { x: slot ? view.n - 1 : 0, y: Math.floor(view.n / 2), from: null };
    return pads[slot];
  }

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function side(v, slot) {
    return '<div class="wh-side p' + (slot + 1) + '"><div class="name">' + nameOf(v, slot) + '</div><div class="count">' + v.counts[slot] + '</div>' +
      '<div class="muted">' + (v.mode === 'race' ? 'of ' + v.words.length + ' words' : 'word' + (v.counts[slot] === 1 ? '' : 's') + ' · need ' + Math.ceil((v.words.length + 1) / 2)) + '</div></div>';
  }

  function banner(v) {
    const r = v.result;
    if (v.phase === 'over') {
      return '<div class="wh-banner"><span class="ark-result">🏆 ' + nameOf(v, v.winner) + ' wins ' + v.scores[v.winner] + ' : ' + v.scores[1 - v.winner] + '!</span>' +
        '<div class="sub">Words found: ' + v.totalWords[0] + ' – ' + v.totalWords[1] + ' · Rematch (🎮 A), settings (🎮 Y) or back to the lobby.</div></div>';
    }
    if (v.phase === 'result' && r) {
      return '<div class="wh-banner">' + (r.winner === null ? '🤝 Level on words: nobody takes this grid' : nameOf(v, r.winner) + ' takes the grid, ' + r.words[r.winner] + ' : ' + r.words[1 - r.winner]) +
        (r.missed.length ? '<div class="sub">Outlined: the words nobody found</div>' : '') + '</div>';
    }
    return '';
  }

  function render() {
    const v = view;
    if (!root || !v || !window.ArkHunt) return;
    const marks = [];
    if (v.phase === 'play') {
      [0, 1].forEach(function (slot) {
        if (!v.players[slot].local || v.players[slot].bot) return; // (the computer has no cursor)
        const p = padOf(slot);
        const at = p.y * v.n + p.x;
        marks.push({ slot: slot, cursor: at, from: p.from, to: at });
      });
    }
    const k = JSON.stringify([v.phase, v.round, v.scores, v.grid, v.found, v.words, v.counts, v.nope, v.result, marks]);
    if (k === key) return;
    key = k;
    if (v.phase === 'countdown') {
      root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
        '<div class="wh-center"><div class="big">Grid ' + v.round + '</div><div class="sub">' + esc(v.sizeName) + (v.mode === 'race' ? ' · Race: your own board each, on your phone. First to find every word takes the grid.' : ' · mark a hidden word from its first letter to its last. First to mark it gets it.') + '</div></div>';
      return;
    }
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      // The time left while playing; the grid's result in the same place after.
      (v.phase === 'play' ? '<div class="wh-bar"><span style="width:' + (100 * v.timeLeft) / v.gridMs + '%;animation-duration:' + v.timeLeft + 'ms"></span></div>' : banner(v)) +
      '<div class="wh-main">' + side(v, 0) + '<div class="wh-mid"><div class="wh-field">' + window.ArkHunt.html(v, marks) + '</div>' + window.ArkHunt.words(v) + '</div>' + side(v, 1) + '</div>';
    // A mark that wasn't a word shakes that player's side.
    [0, 1].forEach(function (slot) {
      if (v.nope[slot] > nope[slot]) root.querySelector('.wh-side.p' + (slot + 1)).classList.add('shake');
    });
    nope = v.nope.slice();
  }

  const duel = {
    sounds: function (prev, v) {
      if (v.phase === 'play' && prev.phase !== 'play') return ['go'];
      if (v.counts[0] + v.counts[1] > prev.counts[0] + prev.counts[1]) return ['correct']; // (in Race the TV doesn't see where)
      if (v.nope[0] + v.nope[1] > prev.nope[0] + prev.nope[1]) return ['wrong'];
      return [];
    },
    padHint: 'D-pad moves · A on a word\'s first letter, then A on its last · B lets go · End: A rematch, Y settings',
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'play') return null;
      const p = padOf(slot);
      if (MOVES[btn]) {
        p.x = (p.x + MOVES[btn][0] + v.n) % v.n;
        p.y = (p.y + MOVES[btn][1] + v.n) % v.n;
      } else if (btn === 'B') p.from = null;
      else if (btn === 'A') {
        const at = p.y * v.n + p.x;
        if (p.from === null || p.from === at) p.from = p.from === at ? null : at;
        else {
          const input = { type: 'mark', a: p.from, b: at };
          p.from = null;
          render();
          return window.ArkHunt.line(v.n, input.a, input.b) ? input : null;
        }
      }
      render();
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'wh-host';
      el.appendChild(root);
      ready.then(render);
    },
    update: function (v) {
      // A new grid (or a new size): cursors back to the start.
      if (!view || view.round !== v.round || view.n !== v.n) {
        Object.keys(pads).forEach(function (k) { delete pads[k]; });
        nope = v.nope.slice();
      }
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      key = '';
      Object.keys(pads).forEach(function (k) { delete pads[k]; });
    },
  };

  /** 1 player: show Word Search' screen in place of the 2 player one (once the script is in). */
  function toSolo(v) {
    if (!alone) return false;
    alone.view = v;
    if (!alone.on && window.ArkWordSearch) {
      alone.on = true;
      duel.unmount();
      alone.el.innerHTML = '';
      ArkWordSearch.host.mount(alone.el, alone.api);
    }
    if (alone.on) ArkWordSearch.host.update(v);
    return true;
  }
  const solo = (v) => Boolean(v && v.solo && window.ArkWordSearch);

  Ark.register('host', 'word-hunt', Object.assign({}, duel, {
    mount: function (el, api) {
      alone = { el: el, api: api, on: false, view: null };
      duel.mount(el, api);
      soloReady.then(function () { if (alone && alone.view && alone.view.solo) toSolo(alone.view); });
    },
    update: function (v) {
      if (v.solo) return toSolo(v);
      duel.update(v);
    },
    unmount: function () {
      if (alone && alone.on) ArkWordSearch.host.unmount();
      else duel.unmount();
      alone = null;
    },
    sounds: function (prev, v) { return solo(v) ? (ArkWordSearch.host.sounds ? ArkWordSearch.host.sounds(prev, v) : []) : prev.solo ? [] : duel.sounds ? duel.sounds(prev, v) : []; },
    padHint: duel.padHint || 'D-pad move · A on the first letter, then A on the last · B let go',
    pad: function (btn, v, slot) { return solo(v) ? (ArkWordSearch.host.pad ? ArkWordSearch.host.pad(btn, v) : null) : duel.pad ? duel.pad(btn, v, slot) : null; },
    typing: function (k, v) { return solo(v) ? (ArkWordSearch.host.typing ? ArkWordSearch.host.typing(k, v) : null) : duel.typing ? duel.typing(k, v) : null; },
    overHtml: function (v) { return solo(v) ? (ArkWordSearch.host.overHtml ? ArkWordSearch.host.overHtml(v) : '') : duel.overHtml ? duel.overHtml(v) : ''; },
  }));
})();
