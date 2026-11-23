// Dominoes tiles for the TV and the phones. Sets window.ArkDom.
(function () {
  const PIPS = { 0: [], 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  function half(n) {
    let html = '<span class="dm-half">';
    for (let i = 0; i < 9; i++) html += '<i' + (PIPS[n].includes(i) ? ' class="on"' : '') + '></i>';
    return html + '</span>';
  }

  /** A tile showing a then b. `dir`: 'h' (side by side) or 'v' (one above the other). */
  function tile(a, b, dir, extra, attrs) {
    return '<span class="dm-tile ' + (dir || 'h') + (extra ? ' ' + extra : '') + '"' + (attrs || '') + '>' + half(a) + '<b class="dm-bar"></b>' + half(b) + '</span>';
  }

  function back(extra) {
    return '<span class="dm-tile v back' + (extra ? ' ' + extra : '') + '"></span>';
  }

  /**
   * The line in rows of `per`, snaking (every other row right to left, its tiles turned round, so
   * neighbours stay touching). Doubles stand crosswise. `fresh`: the tile just played (it pops in).
   */
  function lineHtml(line, per, fresh) {
    if (!line.length) return '<div class="dm-line empty">The first tile goes anywhere</div>';
    let html = '<div class="dm-line">';
    for (let start = 0, row = 0; start < line.length; start += per, row++) {
      const back2 = row % 2 === 1;
      const tiles = line.slice(start, start + per).map(function (t, k) {
        const i = start + k;
        const dbl = t[0] === t[1];
        const shown = back2 ? [t[1], t[0]] : t;
        return tile(shown[0], shown[1], dbl ? 'v' : 'h', (dbl ? 'dbl' : '') + (i === fresh ? ' fresh' : ''));
      });
      if (back2) tiles.reverse();
      html += '<div class="dm-row' + (back2 ? ' rev' : '') + '">' + tiles.join('') + '</div>';
    }
    return html + '</div>';
  }

  window.ArkDom = { tile: tile, back: back, lineHtml: lineHtml, half: half };
})();
