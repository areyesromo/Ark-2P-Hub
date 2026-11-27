// Go board for the TV and the phones: a wooden board with its lines and star points, black and
// white stones (their colours are the game's own; the side panels say who has which). Sets
// window.ArkGo.
(function () {
  const S = 10; // between lines
  const STARS = { 9: [[2, 2], [6, 2], [4, 4], [2, 6], [6, 6]] };

  /**
   * v: the view. opts.tappable: empty points can be tapped. opts.aim: a point picked (a see-through
   * stone, colour opts.aimColour). opts.cursor: a controller's aim. opts.dead: dead stones (crossed).
   */
  function boardHtml(v, opts) {
    opts = opts || {};
    const n = v.size;
    const W = (n - 1) * S;
    let svg = '<svg class="go-board' + (opts.tappable ? ' tappable' : '') + '" viewBox="-8 -8 ' + (W + 16) + ' ' + (W + 16) + '">' +
      '<rect class="go-wood" x="-8" y="-8" width="' + (W + 16) + '" height="' + (W + 16) + '" rx="2"/>';
    for (let k = 0; k < n; k++) {
      svg += '<line class="go-line" x1="0" y1="' + k * S + '" x2="' + W + '" y2="' + k * S + '"/>';
      svg += '<line class="go-line" x1="' + k * S + '" y1="0" x2="' + k * S + '" y2="' + W + '"/>';
    }
    (STARS[n] || []).forEach(function (p) { svg += '<circle class="go-star" cx="' + p[0] * S + '" cy="' + p[1] * S + '" r="0.9"/>'; });
    const dead = {};
    (opts.dead || []).forEach(function (c) { dead[c] = true; });
    const last = v.lastMove && v.lastMove.cell >= 0 ? v.lastMove.cell : -1;
    for (let c = 0; c < n * n; c++) {
      const x = (c % n) * S;
      const y = Math.floor(c / n) * S;
      const who = v.board[c];
      if (opts.tappable && !who) svg += '<rect class="go-hit" x="' + (x - S / 2) + '" y="' + (y - S / 2) + '" width="' + S + '" height="' + S + '" data-c="' + c + '"/>';
      if (who) {
        svg += '<circle class="go-stone ' + (who === 1 ? 'b' : 'w') + (dead[c] ? ' dead' : '') + '" cx="' + x + '" cy="' + y + '" r="4.6"/>';
        if (c === last) svg += '<circle class="go-last ' + (who === 1 ? 'b' : 'w') + '" cx="' + x + '" cy="' + y + '" r="1.8"/>';
        if (dead[c]) svg += '<path class="go-x" d="M' + (x - 2.4) + ' ' + (y - 2.4) + 'l4.8 4.8M' + (x + 2.4) + ' ' + (y - 2.4) + 'l-4.8 4.8"/>';
      } else if (opts.aim === c) svg += '<circle class="go-stone ghost ' + (opts.aimColour === 1 ? 'b' : 'w') + '" cx="' + x + '" cy="' + y + '" r="4.6"/>';
      if (opts.cursor === c) svg += '<rect class="go-aim c' + (opts.cursorSlot + 1) + '" x="' + (x - 5) + '" y="' + (y - 5) + '" width="10" height="10" rx="1.5"/>';
    }
    return svg + '</svg>';
  }

  window.ArkGo = { boardHtml: boardHtml };
})();
