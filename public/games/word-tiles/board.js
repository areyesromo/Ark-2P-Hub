// Word Tiles board and tiles for the TV and the phones. Sets window.ArkTiles.
(function () {
  const POINTS = { a: 1, b: 3, c: 3, d: 2, e: 1, f: 4, g: 2, h: 4, i: 1, j: 8, k: 4, l: 1, m: 3, n: 1, o: 1, p: 3, q: 8, r: 1, s: 1, t: 1, u: 1, v: 4, w: 4, x: 8, y: 4, z: 8 };
  const N = 11;
  // The bonus squares (the same pattern as server/games/word-tiles-rules.js).
  const QUARTER = { '0,0': 'W3', '0,5': 'W3', '1,1': 'W2', '2,2': 'W2', '3,3': 'L3', '0,3': 'L2', '1,4': 'L3', '2,5': 'L2', '4,4': 'L2', '5,5': 'W2' };
  const BONUS = new Array(N * N).fill(null);
  Object.keys(QUARTER).forEach(function (key) {
    const rc = key.split(',').map(Number);
    const r = rc[0];
    const c = rc[1];
    [[r, c], [c, r], [N - 1 - r, c], [r, N - 1 - c], [N - 1 - r, N - 1 - c], [c, N - 1 - r], [N - 1 - c, r], [N - 1 - c, N - 1 - r]].forEach(function (p) { BONUS[p[0] * N + p[1]] = QUARTER[key]; });
  });
  const BONUS_TEXT = { W3: '3×<br>word', W2: '2×<br>word', L3: '3×<br>letter', L2: '2×<br>letter' };

  function tileHtml(l, cls, attr) {
    return '<span class="wt-tile' + (cls ? ' ' + cls : '') + '"' + (attr || '') + '>' + l.toUpperCase() + '<sub>' + POINTS[l] + '</sub></span>';
  }

  /**
   * v: the view. opts.pending: { cell: letter } tiles laid but not yet played (yours, on a phone);
   * opts.tap: empty squares (and pending tiles) can be tapped.
   */
  function boardHtml(v, opts) {
    opts = opts || {};
    const pending = opts.pending || {};
    const last = {};
    if (v.lastPlay && v.lastPlay.cells) v.lastPlay.cells.forEach(function (c) { last[c] = true; });
    let html = '<div class="wt-board">';
    for (let c = 0; c < N * N; c++) {
      const l = v.board[c];
      const b = BONUS[c];
      let inner = '';
      if (l) inner = tileHtml(l, last[c] ? 'last' : '');
      else if (pending[c]) inner = tileHtml(pending[c], 'pending');
      else if (c === 60) inner = '<i class="star">★</i>';
      else if (b) inner = '<i>' + BONUS_TEXT[b] + '</i>';
      const tap = opts.tap && !l;
      html += '<span class="wt-sq' + (b ? ' ' + b : '') + '"' + (tap ? ' data-c="' + c + '"' : '') + '>' + inner + '</span>';
    }
    return html + '</div>';
  }

  window.ArkTiles = { boardHtml: boardHtml, tileHtml: tileHtml, POINTS: POINTS };
})();
