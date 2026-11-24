// Five in a Row board for the TV and the phones: stones on the lines' crossings. Sets window.ArkGomoku.
(function () {
  const STARS = [48, 56, 112, 168, 176]; // (the little dots of a board: 3-3, 3-11, the middle, 11-3, 11-11)

  /**
   * v: the view. opts.aim: a crossing picked (a see-through stone shows there). opts.aimSlot: whose.
   * opts.tappable. opts.cursor / opts.cursorSlot: a controller's aim.
   */
  function boardHtml(v, opts) {
    opts = opts || {};
    const n = v.size;
    const win = {};
    (v.line || []).forEach(function (c) { win[c] = true; });
    const last = v.lastMove ? v.lastMove.cell : -1;
    let html = '<div class="gm-board' + (opts.tappable ? ' tappable' : '') + '" style="--n:' + n + '">';
    for (let c = 0; c < n * n; c++) {
      const x = c % n;
      const y = Math.floor(c / n);
      const who = v.board[c];
      const edge = (x === 0 ? ' l' : x === n - 1 ? ' r' : '') + (y === 0 ? ' t' : y === n - 1 ? ' b' : '');
      let inner = STARS.includes(c) ? '<i class="star"></i>' : '';
      if (who) inner += '<b class="gm-stone p' + who + (win[c] ? ' win' : '') + (c === last ? ' last' : '') + '"></b>';
      else if (opts.aim === c) inner += '<b class="gm-stone p' + (opts.aimSlot + 1) + ' ghost"></b>';
      html += '<span class="gm-pt' + edge + (opts.cursor === c ? ' aim p' + (opts.cursorSlot + 1) : '') + '"' + (opts.tappable && !who ? ' data-c="' + c + '"' : '') + '>' + inner + '</span>';
    }
    return html + '</div>';
  }

  window.ArkGomoku = { boardHtml: boardHtml };
})();
