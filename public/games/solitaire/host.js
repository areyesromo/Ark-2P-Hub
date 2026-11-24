(function () {
  Ark.loadCss('/games/solitaire/style.css');
  const ready = Ark.loadScript('/games/solitaire/board.js');
  const TOP = ['stock', 'waste', 'f0', 'f1', 'f2', 'f3']; // the top row's places, left to right
  const TOP_COL = [0, 1, 3, 4, 5, 6]; // the column each one sits over

  let root = null;
  let table = null;
  let stats = null;
  let view = null;
  let boardKey = '';
  // A controller's cursor: on the top row (top: index into TOP) or in a column (col, and depth: which face-up card).
  const cur = { top: null, col: 0, depth: null };
  let selected = null;

  function faceUp(col) {
    const c = view.tab[col];
    let first = c.length;
    while (first > 0 && c[first - 1] !== '#') first--;
    return { first: first, last: c.length - 1 };
  }

  function cursorMark() {
    if (cur.top !== null) return { pile: TOP[cur.top] };
    const col = view.tab[cur.col];
    if (!col.length) return { pile: 't' + cur.col };
    const f = faceUp(cur.col);
    const d = cur.depth === null ? f.last : Math.max(f.first, Math.min(f.last, cur.depth));
    return { pile: 't' + cur.col, index: d };
  }

  function render() {
    const v = view;
    if (!v || !window.ArkSoloCards || !root) return;
    const local = v.player && v.player.local && v.phase === 'play';
    const key = JSON.stringify([v.tab, v.waste, v.stock, v.found, local && cursorMark(), selected]);
    if (key !== boardKey) {
      boardKey = key;
      table.innerHTML = window.ArkSoloCards.html(v, { selected: selected, cursor: local ? cursorMark() : null });
    }
    stats.innerHTML =
      '<span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong></span>' +
      '<span><strong>' + v.foundCount + '</strong> / 52 home</span>' +
      '<span><strong>' + v.moves + '</strong> moves</span>' +
      '<span class="muted">' + Ark.escapeHtml(v.variant) + '</span>' +
      (v.canFinish ? '<span class="finish-note">✨ All face up: ' + (local ? 'Start' : 'Finish on your phone') + ' to send them home</span>' : '');
  }

  function move(btn) {
    if (cur.top !== null) {
      if (btn === 'LEFT' || btn === 'RIGHT') cur.top = (cur.top + (btn === 'LEFT' ? TOP.length - 1 : 1)) % TOP.length;
      else if (btn === 'DOWN') {
        cur.col = TOP_COL[cur.top];
        cur.top = null;
        cur.depth = null;
      }
      return;
    }
    const f = faceUp(cur.col);
    if (btn === 'LEFT' || btn === 'RIGHT') {
      cur.col = (cur.col + (btn === 'LEFT' ? 6 : 1)) % 7;
      cur.depth = null;
    } else if (btn === 'UP') {
      const d = cur.depth === null ? f.last : cur.depth;
      if (d > f.first && view.tab[cur.col].length) cur.depth = d - 1;
      else {
        // Up off the column to the top row: the nearest place above it.
        let best = 0;
        TOP_COL.forEach(function (c, i) { if (Math.abs(c - cur.col) < Math.abs(TOP_COL[best] - cur.col)) best = i; });
        cur.top = best;
      }
    } else if (btn === 'DOWN') {
      const d = cur.depth === null ? f.last : cur.depth;
      cur.depth = d < f.last ? d + 1 : null;
    }
  }

  Ark.register('host', 'solitaire', {
    sounds: function (prev, v) {
      if (v.foundCount > prev.foundCount) return ['point'];
      if (v.nope > prev.nope) return ['wrong'];
      if (v.moves > prev.moves) return ['flag'];
      return [];
    },
    padHint: 'D-pad move · A pick up / put down (on the stock: turn a card) · X send it where it fits · B drop · Y undo · Start finish',
    pad: function (btn, v) {
      if (v.phase !== 'play') return null;
      if (btn === 'UP' || btn === 'DOWN' || btn === 'LEFT' || btn === 'RIGHT') {
        move(btn);
        render();
        return null;
      }
      if (btn === 'Y') {
        selected = null;
        return { type: 'undo' };
      }
      if (btn === 'START') return v.canFinish ? { type: 'finish' } : null;
      if (btn === 'B') {
        selected = null;
        render();
        return null;
      }
      const here = cursorMark();
      if (btn === 'X') {
        const what = selected || here;
        selected = null;
        return what.pile === 'stock' ? { type: 'draw' } : { type: 'smart', from: what.pile, index: what.index };
      }
      if (btn === 'A') {
        if (here.pile === 'stock') {
          selected = null;
          return { type: 'draw' };
        }
        if (selected) {
          const from = selected;
          selected = null;
          render();
          return from.pile === here.pile ? null : { type: 'move', from: from.pile, index: from.index, to: here.pile };
        }
        const pile = here.pile;
        const has = pile === 'waste' ? v.waste.length : pile[0] === 'f' ? v.found[Number(pile[1])] : v.tab[Number(pile[1])].length;
        if (has) selected = here;
        render();
      }
      return null;
    },
    overHtml: function (v) {
      return v.won ? 'All 52 home in ' + v.moves + ' moves' : 'A game that isn\'t finished doesn\'t count';
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'sol-host';
      root.innerHTML = '<div class="sol-stats"></div><div class="sol-table"></div>';
      el.appendChild(root);
      table = root.querySelector('.sol-table');
      stats = root.querySelector('.sol-stats');
      ready.then(render);
    },
    update: function (v) {
      if (root) root.setAttribute('data-look', v.look || 'classic');
      if (!view || v.moves < view.moves) {
        cur.top = null;
        cur.col = 0;
        cur.depth = null;
      }
      view = v;
      if (v.phase !== 'play') selected = null;
      render();
    },
    unmount: function () {
      root = table = stats = view = selected = null;
      boardKey = '';
    },
  });
})();
