(function () {
  Ark.loadCss('/games/pawn-race/style.css');
  const ready = Ark.loadScript('/games/pawn-race/board.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  const pads = {}; // a controller player's chosen option

  // The clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function side(v, s) {
    const active = v.phase === 'move' && v.turn === s;
    const p = v.players[s];
    const local = active && p.local && !p.bot;
    const pick = local ? v.options[pads[s] || 0] : null;
    const home = v.pawns[s].filter(function (x) { return x === 45; }).length;
    const clock = active && v.timed && v.timeLeftMs ? ' ⏱ <span class="pr-secs">' + secsLeft() + 's</span>' : '';
    return '<aside class="pr-side p' + (s + 1) + (active ? ' active' : '') + '"><div class="pr-name">' + nameOf(v, s) + '</div>' +
      '<div class="pr-hand">' + v.hands[s].map(function (c, i) { return ArkPawns.cardHtml(c, pick && pick.card === i ? 'on' : ''); }).join('') + '</div>' +
      '<div class="pr-home-count">' + home + ' of 3 Home</div>' +
      '<div class="pr-turn">' + (active ? 'To play' + clock : '') + (pick ? '<small>' + esc(ArkPawns.describe(v, s, pick)) + '<br>◀ ▶ choose · A play</small>' : '') + '</div></aside>';
  }

  function note(v) {
    const m = v.lastMove;
    if (!m || v.phase === 'over' || v.phase === 'roundEnd') return '';
    if (m.missed) return nameOf(v, m.by) + ' ran out of time';
    if (m.kind === 'discard') return nameOf(v, m.by) + ' had no move and threw away a ' + (m.card === 'bump' ? 'Bump' : m.card);
    let s = nameOf(v, m.by) + ' plays ' + (m.card === 'bump' ? 'Bump!' : 'a ' + m.card);
    if (m.slid) s += ' and slides 🛝';
    if (m.bumped && m.bumped.length) s += ' · ' + nameOf(v, 1 - m.by) + '\'s pawn goes back to Start!';
    return s;
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const s = v.turn;
    let ghost = null;
    if (v.phase === 'move' && v.players[s].local && !v.players[s].bot) {
      const o = v.options[pads[s] || 0];
      if (o && o.kind !== 'discard') ghost = { s: s, pawn: o.pawn, to: o.to };
    }
    const banner = v.phase === 'over' || v.phase === 'roundEnd' ? '<div class="pr-banner"><span class="ark-result won">' + (v.phase === 'over' ? '🏆 ' : '') + nameOf(v, v.result.winner) + ' gets all three Home!</span></div>' : '';
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="pr-stage">' + side(v, 0) + '<div class="pr-centre">' + ArkPawns.boardHtml(v, { ghost: ghost }) + banner + '</div>' + side(v, 1) + '</div>' +
      '<div class="pr-note">' + note(v) + '</div>';
  }

  Ark.register('host', 'pawn-race', {
    sounds: function (prev, v) {
      if (prev.phase !== 'over' && v.phase === 'over') return ['fanfare'];
      const m = v.lastMove;
      if (m && (!prev.lastMove || prev.lastMove.n !== m.n)) return [m.bumped && m.bumped.length ? 'knock' : m.slid ? 'whoosh' : 'drop'];
      return [];
    },
    padHint: '◀ ▶ (or ▲ ▼) chooses a move (the card is lit, the pawn\'s new spot ringed) · A plays it · A: rematch at the end',
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'move' || v.turn !== slot || !v.options.length) return null;
      const n = v.options.length;
      if (btn === 'RIGHT' || btn === 'DOWN') pads[slot] = ((pads[slot] || 0) + 1) % n;
      else if (btn === 'LEFT' || btn === 'UP') pads[slot] = ((pads[slot] || 0) + n - 1) % n;
      else if (btn === 'A') { const o = pads[slot] || 0; delete pads[slot]; return { type: 'move', option: o }; }
      render();
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'pr-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
      tick = setInterval(function () {
        if (root) root.querySelectorAll('.pr-secs').forEach(function (c) { c.textContent = secsLeft() + 's'; });
      }, 250);
    },
    update: function (v) {
      if (view && view.n !== v.n) { delete pads[0]; delete pads[1]; }
      view = v;
      gotAt = Date.now();
      render();
    },
    unmount: function () { clearInterval(tick); root = view = null; delete pads[0]; delete pads[1]; },
  });
})();
