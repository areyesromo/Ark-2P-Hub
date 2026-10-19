// Mancala board markup shared by the TV and the phones.
(function () {
  const PITS = 6;
  const STORE = [6, 13];

  /** The stones in a pit or store: little pebbles up to a dozen, then a pile; the count on top. */
  function stones(n, cls) {
    let dots = '';
    for (let k = 0; k < Math.min(n, 12); k++) dots += '<i></i>';
    return '<div class="' + cls + '"><div class="pebbles' + (n > 12 ? ' pile' : '') + '">' + dots + '</div><b>' + n + '</b></div>';
  }

  /**
   * v: the game view. opts.viewer: whose side is at the bottom (0 on the TV).
   * opts.tappable: your pits are buttons. opts.cursor: a pit to ring (controller aim), opts.cursorSlot.
   */
  function boardHtml(v, opts) {
    opts = opts || {};
    const me = opts.viewer || 0;
    const them = 1 - me;
    const last = v.lastMove;
    const legal = {};
    v.legal.forEach(function (i) { legal[i] = true; });
    function pit(i) {
      let cls = 'pit p' + ((i < PITS ? 0 : 1) + 1);
      if (last && last.pit === i) cls += ' from';
      if (last && last.last === i) cls += ' landed';
      if (last && last.captured && (last.captured.pit === i || last.captured.from === i)) cls += ' cap';
      if (legal[i] && opts.tappable) cls += ' can';
      if (opts.cursor === i) cls += ' cur c' + (opts.cursorSlot + 1);
      return '<div class="cell" data-pit="' + i + '">' + stones(v.pits[i], cls) + '</div>';
    }
    // Their pits run right to left along the top; yours left to right along the bottom.
    const top = [];
    const bottom = [];
    for (let k = 0; k < PITS; k++) {
      top.push(pit(them * (PITS + 1) + (PITS - 1 - k)));
      bottom.push(pit(me * (PITS + 1) + k));
    }
    const store = function (s, side) {
      const landed = last && last.last === STORE[s] ? ' landed' : '';
      return '<div class="store-cell ' + side + '">' + stones(v.pits[STORE[s]], 'store p' + (s + 1) + landed) + '</div>';
    };
    return '<div class="mc-board' + (opts.tappable ? ' tappable' : '') + '">' +
      store(them, 'left') + '<div class="row top">' + top.join('') + '</div>' +
      '<div class="row bottom">' + bottom.join('') + '</div>' + store(me, 'right') + '</div>';
  }

  window.ArkMC = { boardHtml: boardHtml, PITS: PITS, STORE: STORE };
})();
