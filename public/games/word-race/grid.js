// Word Race letter grid, shared by the TV and the phones.
(function () {
  /**
   * grid: size x size faces ('Q' is "Qu"). paths: [{ path: [tile...], cls }] drawn
   * on top (a phone's own trace).
   */
  function gridHtml(grid, size, paths) {
    const mark = {};
    (paths || []).forEach(function (p) {
      p.path.forEach(function (i, k) { mark[i] = { cls: p.cls, n: k + 1, last: k === p.path.length - 1 }; });
    });
    let html = '<div class="wr-grid" style="--n:' + size + '">';
    grid.forEach(function (face, i) {
      const m = mark[i];
      html += '<div class="tile' + (m ? ' on ' + m.cls + (m.last ? ' last' : '') : '') + '" data-i="' + i + '">' +
        '<span class="face">' + (face === 'Q' ? 'Qu' : face) + '</span>' + (m ? '<span class="n">' + m.n + '</span>' : '') + '</div>';
    });
    return html + '</div>';
  }

  /** The word a path spells. */
  function spell(grid, path) {
    return path.map(function (i) { return grid[i] === 'Q' ? 'QU' : grid[i]; }).join('');
  }

  function adjacent(a, b, size) {
    return a !== b && Math.abs(Math.floor(a / size) - Math.floor(b / size)) <= 1 && Math.abs((a % size) - (b % size)) <= 1;
  }

  // ---- setup screen (Ark.setup) ----

  const ROWS = [
    { key: 'size', title: 'Grid', fmt: function (n) { return n + '×' + n; } },
    { key: 'time', title: 'Time per round', fmt: function (s) { return s % 60 ? Math.floor(s / 60) + '½ min' : s / 60 + ' min'; } },
    { key: 'rounds', title: 'Match', fmt: function (n) { return n === 1 ? 'One round' : 'Best of ' + n; } },
  ];

  window.ArkWords = { gridHtml: gridHtml, spell: spell, adjacent: adjacent, ROWS: ROWS };
})();
