// Ludo board for the TV and the phones: the 15 x 15 cross, player 1's yard top left, player 2's
// bottom right. Sets window.ArkLudo.
(function () {
  // The 52 squares round the board, from player 1's start, as [row, col].
  const TRACK = [];
  const run = function (r, c, dr, dc, n) { for (let i = 0; i < n; i++) TRACK.push([r + dr * i, c + dc * i]); };
  run(6, 1, 0, 1, 5); run(5, 6, -1, 0, 6); TRACK.push([0, 7]); run(0, 8, 1, 0, 6); run(6, 9, 0, 1, 6); TRACK.push([7, 14]);
  run(8, 14, 0, -1, 6); run(9, 8, 1, 0, 6); TRACK.push([14, 7]); run(14, 6, -1, 0, 6); run(8, 5, 0, -1, 6); TRACK.push([7, 0]); TRACK.push([6, 0]);
  const STARTS = [0, 26];
  const SAFE = [0, 8, 13, 21, 26, 34, 39, 47];
  // Home paths (places 51-55) and home (56).
  const PATH = [[[7, 1], [7, 2], [7, 3], [7, 4], [7, 5]], [[7, 13], [7, 12], [7, 11], [7, 10], [7, 9]]];
  const HOME = [[7, 6], [7, 8]];
  // The yard spots, as fractions of a cell.
  const YARD = [[[1.6, 1.6], [1.6, 3.4], [3.4, 1.6], [3.4, 3.4]], [[10.6, 10.6], [10.6, 12.4], [12.4, 10.6], [12.4, 12.4]]];

  /** Where a pawn sits: [row, col] (fractional in the yard). */
  function cellOf(slot, i, place) {
    if (place < 0) return YARD[slot][i];
    if (place > 55) return HOME[slot];
    if (place > 50) return PATH[slot][place - 51];
    return TRACK[(STARTS[slot] + place) % 52];
  }

  /** The board's squares (drawn once per render; cheap). */
  function squaresHtml() {
    let html = '';
    const kind = {};
    TRACK.forEach(function (rc, i) { kind[rc[0] + ',' + rc[1]] = 'track' + (SAFE.includes(i) ? ' safe' : '') + (i === 0 ? ' start p1' : i === 26 ? ' start p2' : ''); });
    // (the up and down arms' middle rows: the home paths of the two colours nobody plays)
    for (let r = 1; r <= 5; r++) { kind[r + ',7'] = 'path none'; kind[(14 - r) + ',7'] = 'path none'; }
    PATH[0].forEach(function (rc) { kind[rc[0] + ',' + rc[1]] = 'path p1'; });
    PATH[1].forEach(function (rc) { kind[rc[0] + ',' + rc[1]] = 'path p2'; });
    Object.keys(kind).forEach(function (k) {
      const rc = k.split(',');
      html += '<span class="lu-sq ' + kind[k] + '" style="--r:' + rc[0] + ';--c:' + rc[1] + '"></span>';
    });
    return html;
  }

  /**
   * v: the view. opts.tappable: movable pawns are buttons. opts.cursor: a controller's pick (a pawn).
   * opts.corner: [top-right html, bottom-left html] for the two empty corners.
   */
  function boardHtml(v, opts) {
    opts = opts || {};
    let html = '<div class="lu-board">' +
      '<span class="lu-yard p1"></span><span class="lu-yard p2"></span>' +
      '<span class="lu-corner tr">' + ((opts.corner && opts.corner[0]) || '') + '</span><span class="lu-corner bl">' + ((opts.corner && opts.corner[1]) || '') + '</span>' +
      '<span class="lu-centre"></span>' + squaresHtml();
    // Pawns sharing a square sit side by side.
    const seen = {};
    [0, 1].forEach(function (slot) {
      v.pawns[slot].forEach(function (place, i) {
        const rc = cellOf(slot, i, place);
        const key = rc[0] + ',' + rc[1];
        const k = (seen[key] = (seen[key] || 0) + 1) - 1;
        const can = v.turn === slot && v.movable.includes(i);
        const moved = v.last && v.last.slot === slot && v.last.pawn === i;
        const shift = place >= 0 && place < 56 ? k * 0.22 : 0;
        const homeShift = place === 56 ? (i - 1.5) * 0.28 : 0;
        html += '<b class="lu-pawn p' + (slot + 1) + (can ? ' can' : '') + (moved ? ' moved' : '') + (opts.cursor === i && v.turn === slot ? ' aim' : '') + '"' +
          (opts.tappable && can ? ' data-pawn="' + i + '"' : '') +
          ' style="--r:' + (rc[0] + shift + (place === 56 ? homeShift : 0)) + ';--c:' + (rc[1] + shift) + '">' + (i + 1) + '</b>';
      });
    });
    return html + '</div>';
  }

  window.ArkLudo = { boardHtml: boardHtml };
})();
