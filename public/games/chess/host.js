(function () {
  Ark.loadCss('/games/chess/style.css');
  const ready = Ark.loadScript('/games/chess/board.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  let gotAt = 0;
  let tick = null;
  const cursors = {}; // controller players: slot -> square
  const picked = {};

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  const colourOf = (v, slot) => (slot === v.whiteSlot ? 'w' : 'b');

  function bankOf(v, slot) {
    return v.ticking === slot ? v.banks[slot] - (performance.now() - gotAt) : v.banks[slot];
  }

  function side(v, slot) {
    const c = colourOf(v, slot);
    const active = v.phase === 'play' && v.turnSlot === slot;
    // What this player has taken: the other colour's pieces.
    const took = v.captured[c === 'w' ? 'b' : 'w'];
    const lead = ArkChess.material(took) - ArkChess.material(v.captured[c]);
    return '<aside class="ch-side p' + (slot + 1) + (active ? ' active' : '') + '">' +
      '<div class="ch-name">' + ArkChess.piece(c === 'w' ? 'K' : 'k') + nameOf(v, slot) + '</div>' +
      (v.timed ? '<div class="ch-clock" data-slot="' + slot + '">' + ArkChess.clockText(bankOf(v, slot)) + '</div>' : '') +
      '<div class="ch-took">' + ArkChess.takenHtml(took) + (lead > 0 ? '<b>+' + lead + '</b>' : '') + '</div>' +
      '<div class="ch-state">' + (active ? (v.check >= 0 ? 'In check!' : 'To move') : '') + '</div></aside>';
  }

  function movesHtml(v) {
    if (!v.moves.length) return '';
    const first = v.moveCount - v.moves.length; // (the list is the last few)
    let html = '<ol class="ch-moves">';
    v.moves.forEach(function (m, i) {
      const n = first + i;
      if (n % 2 === 0) html += '<li><b>' + (n / 2 + 1) + '.</b> ';
      html += '<span>' + esc(m) + '</span> ';
      if (n % 2 === 1 || i === v.moves.length - 1) html += '</li>';
    });
    return html + '</ol>';
  }

  function banner(v) {
    if (!v.result || v.phase === 'play') return '';
    const r = v.result;
    const how = { mate: 'Checkmate!', time: 'Out of time', resign: 'Resigned', stalemate: 'Stalemate: a draw', repetition: 'The same position three times: a draw', fifty: 'Fifty moves without a capture: a draw', material: 'Too little left to mate: a draw', 'time-draw': 'Out of time, but too little left to mate: a draw' }[r.how];
    const head = r.winner === null ? '<span class="ark-result draw">' + how + '</span>'
      : '<span class="ark-result won">' + (v.phase === 'over' ? '🏆 ' : '') + nameOf(v, r.winner) + ' wins</span><small>' + how + '</small>';
    return '<div class="ch-banner">' + head + (v.phase === 'over' ? '<small>Rematch or back to the lobby from your phones or controllers</small>' : '') + '</div>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const s = v.turnSlot;
    const p = v.players[s];
    const local = v.phase === 'play' && p.local && !p.bot;
    let opts = {};
    if (local) {
      if (cursors[s] === undefined) cursors[s] = s === v.whiteSlot ? 12 : 52;
      const from = picked[s];
      opts = {
        cursor: cursors[s], cursorSlot: s, picked: from,
        targets: from !== undefined && from !== null ? new Set(v.legal.filter(function (m) { return m.from === from; }).map(function (m) { return m.to; })) : new Set(),
      };
    }
    const white = v.whiteSlot;
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.game) +
      '<div class="ch-stage">' + side(v, 1 - white) +
      '<div class="ch-centre">' + ArkChess.boardHtml(v, opts) + banner(v) + '</div>' +
      '<div class="ch-right">' + side(v, white) + movesHtml(v) + '</div></div>';
  }

  Ark.register('host', 'chess', {
    padHint: 'D-pad moves the ring · A picks a piece, A again moves it · B puts it back',
    sounds: function (prev, v) {
      if (v.moveCount > prev.moveCount && v.moves.length) {
        const m = v.moves[v.moves.length - 1];
        return [m.includes('#') ? 'fanfare' : m.includes('+') ? 'reveal' : m.includes('x') ? 'knock' : 'drop'];
      }
      return [];
    },
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'play' || v.turnSlot !== slot) return null;
      const c = cursors[slot] === undefined ? 12 : cursors[slot];
      const d = { LEFT: -1, RIGHT: 1, UP: 8, DOWN: -8 }[btn]; // (the TV shows white at the bottom)
      if (d !== undefined) {
        const n = c + d;
        if (n >= 0 && n < 64 && (Math.abs(d) === 8 || Math.floor(n / 8) === Math.floor(c / 8))) cursors[slot] = n;
        render();
        return null;
      }
      if (btn === 'B') { picked[slot] = null; render(); return null; }
      if (btn !== 'A') return null;
      const from = picked[slot];
      if (from !== undefined && from !== null && v.legal.some(function (m) { return m.from === from && m.to === c; })) {
        picked[slot] = null;
        return { type: 'move', from: from, to: c }; // (a pawn reaching the end becomes a queen)
      }
      picked[slot] = v.legal.some(function (m) { return m.from === c; }) ? c : null;
      render();
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'ch-host';
      el.appendChild(root);
      tick = setInterval(function () {
        if (!root || !view) return;
        root.querySelectorAll('.ch-clock').forEach(function (c) {
          const slot = Number(c.getAttribute('data-slot'));
          const ms = bankOf(view, slot);
          c.textContent = ArkChess.clockText(ms);
          c.classList.toggle('low', ms < 30000);
        });
      }, 100);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      if (view && (v.moveCount !== view.moveCount || v.game !== view.game)) { picked[0] = picked[1] = null; }
      view = v;
      gotAt = performance.now();
      render();
    },
    unmount: function () {
      clearInterval(tick);
      root = view = null;
      picked[0] = picked[1] = null;
      delete cursors[0];
      delete cursors[1];
    },
  });
})();
