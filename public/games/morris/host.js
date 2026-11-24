(function () {
  Ark.loadCss('/games/morris/style.css');
  const ready = Ark.loadScript('/games/morris/board.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  const cursors = {};
  const picked = {};

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  const STAGE = { place: 'Placing', move: 'Moving', fly: 'Flying! (three left)' };

  function side(v, slot) {
    const active = v.phase === 'play' && v.turn === slot;
    const clock = active && v.timed ? '<span class="mo-clock' + (v.timeLeftMs < 6000 ? ' low' : '') + '">⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's</span>' : '';
    let doing = '';
    if (active) doing = v.step === 'take' ? '<b class="mo-millcall">Mill! Take one</b>' : STAGE[v.stage];
    return '<aside class="mo-side p' + (slot + 1) + (active ? ' active' : '') + '">' +
      '<div class="mo-name">' + nameOf(v, slot) + '</div>' +
      '<div class="mo-count">' + (v.counts[slot] + v.inHand[slot]) + '<small> pieces</small></div>' +
      (v.inHand[slot] ? ArkMorris.stones(v.inHand[slot], slot) + '<div class="mo-sub">' + v.inHand[slot] + ' to place</div>' : '') +
      '<div class="mo-doing">' + doing + clock + '</div></aside>';
  }

  function banner(v) {
    if (v.phase === 'play') return '';
    const r = v.result;
    if (r.winner === null) return '<div class="mo-banner"><span class="ark-result draw">Fifty moves without a mill: a draw</span></div>';
    const how = r.how === 'blocked' ? 'no move left' : 'down to two pieces';
    return '<div class="mo-banner"><span class="ark-result won">' + (v.phase === 'over' ? '🏆 ' : '') + nameOf(v, r.winner) + ' wins</span><small>' + how + '</small></div>';
  }

  /** What a controller player may aim at now: points to place on, pieces to move (or where), pieces to take. */
  function choices(v, slot) {
    if (v.step === 'take') return v.takeable.slice();
    if (picked[slot] !== undefined && picked[slot] !== null) return v.actions.filter(function (a) { return a.from === picked[slot]; }).map(function (a) { return a.to; });
    return Array.from(new Set(v.actions.map(function (a) { return a.at !== undefined ? a.at : a.from; })));
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const s = v.turn;
    const p = v.players[s];
    const local = v.phase === 'play' && p.local && !p.bot;
    let opts = {};
    if (local) {
      const list = choices(v, s);
      if (!list.includes(cursors[s])) cursors[s] = list[0];
      const from = picked[s];
      opts = { cursor: cursors[s], cursorSlot: s, from: from === null ? undefined : from, targets: from !== undefined && from !== null ? new Set(list) : new Set() };
    }
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="mo-stage">' + side(v, 0) + '<div class="mo-centre">' + ArkMorris.boardHtml(v, opts) + banner(v) + '</div>' + side(v, 1) + '</div>';
  }

  Ark.register('host', 'morris', {
    padHint: '◀ ▶ (or ▲ ▼) steps through what you can pick · A picks it · B puts a piece back',
    sounds: function (prev, v) {
      const k = function (x) { return x.last ? x.round + ':' + x.last.n + ':' + (x.last.took === undefined ? '' : x.last.took) : ''; };
      if (!k(v) || k(v) === k(prev)) return [];
      if (v.last.took !== undefined && (!prev.last || prev.last.took === undefined || prev.last.n !== v.last.n)) return ['boom'];
      return [v.step === 'take' ? 'fanfare' : 'drop'];
    },
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'play' || v.turn !== slot) return null;
      const list = choices(v, slot);
      if (!list.length) return null;
      const at = Math.max(0, list.indexOf(cursors[slot]));
      if (btn === 'LEFT' || btn === 'RIGHT' || btn === 'UP' || btn === 'DOWN') {
        cursors[slot] = list[(at + (btn === 'LEFT' || btn === 'UP' ? -1 : 1) + list.length) % list.length];
        render();
        return null;
      }
      if (btn === 'B') { picked[slot] = null; render(); return null; }
      if (btn !== 'A') return null;
      const c = list[at];
      if (v.step === 'take') return { type: 'take', at: c };
      if (v.stage === 'place') return { type: 'place', at: c };
      if (picked[slot] !== undefined && picked[slot] !== null) { const from = picked[slot]; picked[slot] = null; return { type: 'move', from: from, to: c }; }
      picked[slot] = c;
      render();
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'mo-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      if (view && (v.turn !== view.turn || v.step !== view.step)) picked[0] = picked[1] = null;
      view = v;
      render();
    },
    unmount: function () { root = view = null; picked[0] = picked[1] = null; delete cursors[0]; delete cursors[1]; },
  });
})();
