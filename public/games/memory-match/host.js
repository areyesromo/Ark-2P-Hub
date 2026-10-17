(function () {
  Ark.loadCss('/games/memory-match/style.css');
  const cardsReady = Ark.loadScript('/games/memory-match/cards.js');
  const esc = Ark.escapeHtml;
  const MOVES = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] };

  let root = null;
  let view = null;
  let viewAt = 0;
  let loaded = false;
  let raf = null;
  let key = '';
  const pads = {}; // controller players: slot -> { cursor, row (setup) }

  function padOf(slot) {
    if (!pads[slot]) pads[slot] = { cursor: 0, row: 0 };
    return pads[slot];
  }

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function side(v, slot) {
    const active = (v.phase === 'turn' || v.phase === 'peek' || v.phase === 'match') && v.turn === slot;
    return '<div class="mm-side p' + (slot + 1) + (active ? ' active' : '') + '"><div class="name">' + nameOf(v, slot) + '</div>' +
      '<div class="pairs">' + v.scores[slot] + '</div><div class="muted">pair' + (v.scores[slot] === 1 ? '' : 's') + '</div>' +
      (active ? '<div class="turn">' + (v.phase === 'turn' ? 'Your turn' : v.phase === 'match' ? 'Pair! 🎉' : 'No match') + '</div>' : '') + '</div>';
  }

  function middle(v) {
    if (v.phase === 'setup') {
      return '<div class="panel"><div class="title">🃏 Memory Match</div>' + Ark.setup.html(v, ArkMemory.ROWS, Ark.setup.focus(v, ArkMemory.ROWS, pads)) +
        '<div class="sub">Pick on your phone, or with a controller (↑↓ row, ←→ change). <strong>Start</strong> (or <strong>A</strong>) when you\'re both ready.</div></div>';
    }
    if (v.phase === 'countdown') {
      return '<div class="panel"><div class="big">' + v.countdown + '</div><div class="sub">' + nameOf(v, v.turn) + ' goes first. Flip two cards: a pair is yours and you go again.</div></div>';
    }
    const local = v.players[v.turn].local && v.phase === 'turn';
    const grid = ArkMemory.gridHtml(v, local ? { index: padOf(v.turn).cursor, cls: 'p' + (v.turn + 1) } : null);
    let banner = '';
    if (v.phase === 'over') {
      banner = '<div class="mm-banner">' + (v.draw ? "🤝 It's a draw!" : '🏆 ' + nameOf(v, v.winner) + ' wins ' + v.scores[v.winner] + ' : ' + v.scores[1 - v.winner] + '!') +
        '<div class="sub">Rematch, change the settings (🎮 Y) or head back to the lobby.</div></div>';
    }
    return banner + grid + (v.phase === 'over' ? '' : '<div class="mm-bar"><div class="fill"></div></div>');
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    ArkMemory.setThemes(v.themeNames);
    const k = JSON.stringify([v.phase, v.cards, v.turn, v.scores, v.settings, v.countdown, pads]);
    if (k === key) return;
    key = k;
    root.innerHTML = v.phase === 'setup' || v.phase === 'countdown'
      ? '<div class="mm-center">' + middle(v) + '</div>'
      : '<div class="mm-main">' + side(v, 0) + '<div class="mm-mid">' + middle(v) + '</div>' + side(v, 1) + '</div>';
  }

  // The turn clock runs smoothly between views.
  function tick() {
    raf = requestAnimationFrame(tick);
    if (!root || !view) return;
    const bar = root.querySelector('.mm-bar .fill');
    if (!bar) return;
    const frac = view.phase === 'turn' ? Math.max(0, view.timeLeftMs - (performance.now() - viewAt)) / view.turnMs : 0;
    bar.style.width = (frac * 100).toFixed(2) + '%';
    bar.className = 'fill p' + (view.turn + 1) + (frac < 0.25 ? ' low' : '');
  }

  Ark.register('host', 'memory-match', {
    // Sound: a click for each flip, a chime for a pair, a soft buzz for a miss.
    sounds: function (prev, v) {
      const out = [];
      const a = prev.events;
      const b = v.events;
      if (!a || !b) return out;
      if (b.matches > a.matches) out.push('correct');
      else if (b.misses > a.misses) out.push('close');
      else if (b.flips > a.flips) out.push('lock');
      return out;
    },
    padHint: 'D-pad moves · A flips a card (on your turn) · Setup: ↑↓ row, ←→ change, A start · End: A rematch, Y settings',
    pad: function (btn, v, slot) {
      const p = padOf(slot);
      if (v.phase === 'setup') {
        const input = Ark.setup.pad(btn, v, ArkMemory.ROWS, p);
        key = '';
        render();
        return input;
      }
      if (v.phase === 'over') {
        if (btn === 'A' || btn === 'START') return { type: 'rematch' };
        return btn === 'Y' ? { type: 'setup' } : null;
      }
      if (v.phase !== 'turn' || v.turn !== slot) return null;
      if (MOVES[btn]) {
        const x = Math.min(v.cols - 1, Math.max(0, (p.cursor % v.cols) + MOVES[btn][0]));
        const y = Math.min(v.rows - 1, Math.max(0, Math.floor(p.cursor / v.cols) + MOVES[btn][1]));
        p.cursor = y * v.cols + x;
        render();
        return null;
      }
      return btn === 'A' ? { type: 'flip', index: p.cursor } : null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'mm-host';
      el.appendChild(root);
      raf = requestAnimationFrame(tick);
      cardsReady.then(function () {
        loaded = true;
        render();
      });
    },
    update: function (v) {
      if (view && v.cards && view.cards && v.cards.length !== view.cards.length) Object.keys(pads).forEach(function (k) { pads[k].cursor = 0; });
      view = v;
      viewAt = performance.now();
      render();
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = view = null;
      key = '';
      Object.keys(pads).forEach(function (k) { delete pads[k]; });
    },
  });
})();
