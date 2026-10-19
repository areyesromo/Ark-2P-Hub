// Checkers board markup shared by the TV and the phones.
(function () {
  /**
   * v: the game view. opts.flip: turn the board round (player 2's phone: their men at the bottom).
   * opts.selected: the picked piece [c, r]; its legal destinations are marked.
   * opts.cursor: a controller's cursor square, opts.cursorSlot: whose colour it is.
   * opts.tappable: squares are buttons (phone, on your turn).
   */
  function boardHtml(v, opts) {
    opts = opts || {};
    const key = function (sq) { return sq[0] + ',' + sq[1]; };
    const dests = {};
    const movable = {};
    v.legal.forEach(function (m) {
      movable[key(m.from)] = true;
      if (opts.selected && key(m.from) === key(opts.selected)) dests[key(m.to)] = true;
    });
    const last = {};
    if (v.lastMove) {
      last[key(v.lastMove.from)] = true;
      last[key(v.lastMove.to)] = true;
    }
    let html = '<div class="ck-board' + (opts.tappable ? ' tappable' : '') + '">';
    for (let i = 0; i < v.size; i++) {
      for (let j = 0; j < v.size; j++) {
        const r = opts.flip ? v.size - 1 - i : i;
        const c = opts.flip ? v.size - 1 - j : j;
        const k = c + ',' + r;
        const x = v.board[r][c];
        const cls = ['sq', (r + c) % 2 ? 'dark' : 'light'];
        if (last[k]) cls.push('last');
        if (dests[k]) cls.push('dest');
        if (opts.selected && key(opts.selected) === k) cls.push('sel');
        if (v.chain && key(v.chain) === k) cls.push('chain');
        if (opts.cursor && key(opts.cursor) === k) cls.push('cur p' + (opts.cursorSlot + 1));
        if (opts.showMovable && movable[k]) cls.push('can');
        let piece = '';
        if (x) piece = '<i class="man p' + (((x - 1) % 2) + 1) + (x > 2 ? ' king' : '') + '"></i>';
        html += '<span class="' + cls.join(' ') + '" data-sq="' + k + '">' + piece + '</span>';
      }
    }
    return html + '</div>';
  }

  window.ArkCK = { boardHtml: boardHtml };
})();
