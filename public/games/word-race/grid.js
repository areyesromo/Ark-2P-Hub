// Word Race letter grid, shared by the TV and the phones.
(function () {
  /**
   * grid: 16 faces ('Q' is "Qu"). paths: [{ path: [tile...], cls }] drawn
   * on top (a phone's own trace, or controller players' traces on the TV).
   * cursors: [{ i, cls }] tiles to ring (controller aim).
   */
  function gridHtml(grid, size, paths, cursors) {
    const mark = {};
    (paths || []).forEach(function (p) {
      p.path.forEach(function (i, k) { mark[i] = { cls: p.cls, n: k + 1, last: k === p.path.length - 1 }; });
    });
    const aim = {};
    (cursors || []).forEach(function (c) { aim[c.i] = c.cls; });
    let html = '<div class="wr-grid" style="--n:' + size + '">';
    grid.forEach(function (face, i) {
      const m = mark[i];
      html += '<div class="tile' + (m ? ' on ' + m.cls + (m.last ? ' last' : '') : '') + (aim[i] ? ' aim ' + aim[i] : '') + '" data-i="' + i + '">' +
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

  window.ArkWords = { gridHtml: gridHtml, spell: spell, adjacent: adjacent };
})();
