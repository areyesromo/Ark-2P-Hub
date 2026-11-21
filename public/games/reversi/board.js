// Reversi board markup shared by the TV and the phones. Sets window.ArkReversi.
(function () {
  const esc = function (s) { return Ark.escapeHtml(String(s)); };

  /** A disc: `who` 1 (dark, player 1) or 2 (light, player 2). */
  function disc(who, extra, style) {
    return '<i class="rv-disc d' + who + (extra ? ' ' + extra : '') + '"' + (style ? ' style="' + style + '"' : '') + '></i>';
  }

  /** The move's key: a new one means animate (the placed disc pops in, the flips turn over). */
  function moveKey(v) {
    return v.lastMove ? v.round + ':' + v.lastMove.n : '';
  }

  /**
   * v: the game view. opts.animate: play the last move's flips. opts.cursor: a cell to ring (a
   * controller's aim), opts.cursorSlot: whose ring. opts.hints: show where the player to move may go.
   * opts.tappable: the legal cells are buttons. opts.banner: a line over the board (a pass, the result).
   */
  function boardHtml(v, opts) {
    opts = opts || {};
    const n = v.size;
    const last = v.lastMove;
    const flipped = {};
    if (last && opts.animate) {
      const lx = last.cell % n;
      const ly = Math.floor(last.cell / n);
      last.flips.forEach(function (c) {
        flipped[c] = Math.max(Math.abs((c % n) - lx), Math.abs(Math.floor(c / n) - ly));
      });
    }
    const legal = {};
    if (opts.hints && v.phase === 'play') v.legal.forEach(function (c) { legal[c] = true; });
    let html = '<div class="rv-frame"><div class="rv-board' + (opts.tappable ? ' tappable' : '') + '" style="--n:' + n + '">';
    for (let c = 0; c < n * n; c++) {
      const who = v.board[c];
      let inner = '';
      if (who) {
        if (flipped[c] !== undefined) inner = disc(who, 'flip', 'animation-delay:' + (120 + flipped[c] * 70) + 'ms');
        else if (last && c === last.cell && opts.animate) inner = disc(who, 'pop');
        else inner = disc(who);
        if (last && c === last.cell) inner += '<b class="rv-last"></b>';
      } else if (legal[c]) {
        inner = '<i class="rv-hint d' + (v.turn + 1) + '"></i>';
      }
      const cls = 'rv-cell' + (opts.cursor === c ? ' aim p' + (opts.cursorSlot + 1) : '') + (legal[c] && opts.tappable ? ' can' : '');
      html += '<span class="' + cls + '"' + (legal[c] && opts.tappable ? ' data-cell="' + c + '"' : '') + '>' + inner + '</span>';
    }
    // The four little dots of a real board.
    html += '<i class="rv-star" style="--x:2;--y:2"></i><i class="rv-star" style="--x:6;--y:2"></i>' +
      '<i class="rv-star" style="--x:2;--y:6"></i><i class="rv-star" style="--x:6;--y:6"></i>';
    html += '</div>' + (opts.banner ? '<div class="rv-banner">' + opts.banner + '</div>' : '') + '</div>';
    return html;
  }

  /** Dark's share against light's, as a bar. */
  function shareHtml(v) {
    const a = v.discs[0];
    const b = v.discs[1];
    const pct = a + b ? (100 * a) / (a + b) : 50;
    return '<div class="rv-share"><span class="dark" style="width:' + pct + '%"><b>' + a + '</b></span>' +
      '<span class="light"><b>' + b + '</b></span></div>';
  }

  window.ArkReversi = { disc: disc, boardHtml: boardHtml, shareHtml: shareHtml, moveKey: moveKey, esc: esc };
})();
