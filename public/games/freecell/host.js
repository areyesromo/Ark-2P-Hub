(function () {
  Ark.loadCss('/games/solitaire/style.css');
  Ark.loadCss('/games/freecell/style.css');
  const ready = Ark.loadScript('/games/solitaire/board.js').then(function () { return Ark.loadScript('/games/freecell/board.js'); });

  let root = null;
  let table = null;
  let stats = null;
  let view = null;
  let boardKey = '';
  // A controller's cursor: on the top row (top: 0-7, cells then foundations) or in a column (col, depth: which card).
  const cur = { top: null, col: 0, depth: null };
  let selected = null;

  function cursorMark() {
    if (cur.top !== null) return { pile: window.ArkFreeCell.TOP[cur.top] };
    const col = view.tab[cur.col];
    if (!col.length) return { pile: 't' + cur.col };
    const d = cur.depth === null ? col.length - 1 : Math.max(0, Math.min(col.length - 1, cur.depth));
    return { pile: 't' + cur.col, index: d };
  }

  function render() {
    const v = view;
    if (!v || !root || !window.ArkFreeCell) return;
    const local = v.player && v.player.local && v.phase === 'play';
    const key = JSON.stringify([v.tab, v.cells, v.found, local && cursorMark(), selected]);
    if (key !== boardKey) {
      boardKey = key;
      table.innerHTML = window.ArkFreeCell.html(v, { selected: selected, cursor: local ? cursorMark() : null });
    }
    stats.innerHTML =
      '<span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong></span>' +
      '<span><strong>' + v.foundCount + '</strong> / 52 home</span>' +
      '<span><strong>' + v.moves + '</strong> moves</span>' +
      (v.canFinish ? '<span class="finish-note">✨ All in order: ' + (local ? 'Start' : 'Finish on your phone') + ' to send them home</span>' : '');
  }

  function shake() {
    const t = table && table.querySelector('.fc-table') || table;
    t.classList.remove('shake');
    void t.offsetWidth; // restart the animation
    t.classList.add('shake');
  }

  function move(btn) {
    if (cur.top !== null) {
      if (btn === 'LEFT' || btn === 'RIGHT') cur.top = (cur.top + (btn === 'LEFT' ? 7 : 1)) % 8;
      else if (btn === 'DOWN') {
        cur.col = cur.top;
        cur.top = null;
        cur.depth = null;
      }
      return;
    }
    const len = view.tab[cur.col].length;
    if (btn === 'LEFT' || btn === 'RIGHT') {
      cur.col = (cur.col + (btn === 'LEFT' ? 7 : 1)) % 8;
      cur.depth = null;
    } else if (btn === 'UP') {
      const d = cur.depth === null ? len - 1 : cur.depth;
      if (d > 0) cur.depth = d - 1;
      else cur.top = cur.col; // off the top of the column to the place above it
    } else if (btn === 'DOWN') {
      const d = cur.depth === null ? len - 1 : cur.depth;
      cur.depth = d < len - 1 ? d + 1 : null;
    }
  }

  Ark.register('host', 'freecell', {
    sounds: function (prev, v) {
      if (v.foundCount > prev.foundCount) return ['point'];
      if (v.nope > prev.nope) return ['wrong'];
      if (v.moves > prev.moves) return ['flag'];
      return [];
    },
    padHint: 'D-pad move · A pick up / put down · X send it where it fits · B drop · Y undo · Start finish',
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
        return { type: 'smart', from: what.pile, index: what.index };
      }
      if (btn === 'A') {
        if (selected) {
          const from = selected;
          selected = null;
          render();
          return from.pile === here.pile ? null : { type: 'move', from: from.pile, index: from.index, to: here.pile };
        }
        if (window.ArkFreeCell.taking(v, here.pile, here.index)) selected = here;
        else if (here.index !== undefined) shake(); // not a run: can't pick it up there
        render();
      }
      return null;
    },
    overHtml: function (v) {
      return v.won ? 'All 52 home in ' + v.moves + ' moves' : 'A game that isn\'t finished doesn\'t count';
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'fc-host';
      root.innerHTML = '<div class="sol-stats"></div><div class="fc-table"></div>';
      el.appendChild(root);
      table = root.querySelector('.fc-table');
      stats = root.querySelector('.sol-stats');
      ready.then(render);
    },
    update: function (v) {
      if (root) root.setAttribute('data-look', v.look || 'classic');
      const nope = view && v.nope > view.nope;
      if (!view || v.moves < view.moves) {
        cur.top = null;
        cur.col = 0;
        cur.depth = null;
      }
      view = v;
      if (v.phase !== 'play') selected = null;
      render();
      if (nope) shake();
    },
    unmount: function () {
      root = table = stats = view = selected = null;
      boardKey = '';
    },
  });
})();
