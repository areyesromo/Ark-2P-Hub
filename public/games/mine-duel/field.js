// Mine Duel's field for the TV and the phones. Sets window.ArkMD.
(function () {
  const MINE = 10;

  /** The move's key: a new one means animate (the opened squares dig in, a found mine pops). */
  function moveKey(v) {
    return v.lastMove ? v.round + ':' + v.lastMove.n : '';
  }

  /**
   * v: the game view. opts.animate: play the last move. opts.tappable: covered squares are buttons.
   * opts.cursor / opts.cursorSlot: a controller's aim. opts.banner: a line over the field.
   */
  function fieldHtml(v, opts) {
    opts = opts || {};
    const n = v.size;
    const last = v.lastMove;
    const delay = {};
    if (last && opts.animate) {
      const lx = last.cell % n;
      const ly = Math.floor(last.cell / n);
      last.opened.forEach(function (c) {
        delay[c] = Math.max(Math.abs((c % n) - lx), Math.abs(Math.floor(c / n) - ly)) * 45;
      });
    }
    let html = '<div class="md-wrap"><div class="md-field' + (opts.tappable ? ' tappable' : '') + '" style="--n:' + n + '">';
    for (let c = 0; c < n * n; c++) {
      const val = v.board[c];
      const anim = delay[c] !== undefined ? ' new" style="animation-delay:' + delay[c] + 'ms' : '';
      const aim = opts.cursor === c ? ' aim p' + (opts.cursorSlot + 1) : '';
      const isLast = last && last.cell === c ? ' last' : '';
      if (val === null) {
        html += '<span class="md-cell turf' + aim + ((c + Math.floor(c / n)) % 2 ? ' alt' : '') + '"' + (opts.tappable ? ' data-cell="' + c + '"' : '') + '></span>';
      } else if (val >= MINE) {
        const who = val - MINE; // 0, 1, or 2 (nobody's)
        html += '<span class="md-cell dug mine' + (who < 2 ? ' p' + (who + 1) : ' lost') + aim + isLast + anim + '"><i class="md-bomb"></i>' +
          (who < 2 ? '<i class="md-flag"></i>' : '') + '</span>';
      } else {
        html += '<span class="md-cell dug n' + val + aim + isLast + anim + '">' + (val || '') + '</span>';
      }
    }
    html += '</div>' + (opts.banner ? '<div class="md-banner">' + opts.banner + '</div>' : '') + '</div>';
    return html;
  }

  window.ArkMD = { fieldHtml: fieldHtml, moveKey: moveKey, MINE: MINE };
})();
