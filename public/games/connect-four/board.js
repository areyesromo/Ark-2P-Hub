// Connect Four board markup shared by the TV and the phones.
(function () {
  /**
   * v: the game view. opts.animate: drop the last disc in from the top.
   * opts.cursor: column to mark above the board (controller aim, or the
   * phone's pick), opts.cursorSlot: whose colour that marker is.
   * opts.tappable: columns are buttons (phone, on your turn).
   */
  function boardHtml(v, opts) {
    opts = opts || {};
    const win = {};
    (v.line || []).forEach(function (p) { win[p[0] + ',' + p[1]] = true; });
    const last = v.lastMove;
    let html = '<div class="c4-board' + (opts.tappable ? ' tappable' : '') + '" style="--cols:' + v.cols + ';--rows:' + v.rows + '">';
    html += '<div class="c4-aim">';
    for (let c = 0; c < v.cols; c++) {
      html += '<span>' + (opts.cursor === c ? '<i class="disc p' + (opts.cursorSlot + 1) + '"></i>' : '') + '</span>';
    }
    html += '</div><div class="c4-grid">';
    for (let c = 0; c < v.cols; c++) {
      html += '<div class="c4-col" data-col="' + c + '">';
      for (let r = v.rows - 1; r >= 0; r--) {
        const who = v.board[r][c];
        let disc = '';
        if (who) {
          const isLast = last && last.col === c && last.row === r;
          disc = '<i class="disc p' + who + (win[c + ',' + r] ? ' win' : '') + (isLast && opts.animate ? ' drop' : '') + '"' +
            (isLast && opts.animate ? ' style="--fall:' + (v.rows - r) + '"' : '') + '></i>';
        }
        html += '<span class="cell">' + disc + '</span>';
      }
      html += '</div>';
    }
    return html + '</div></div>';
  }

  window.ArkC4 = { boardHtml: boardHtml };
})();
