// Word Race letter grid, shared by the TV and the phones.
(function () {
  /**
   * grid: size x size faces ('Q' is "Qu"). paths: [{ path: [tile...], cls }] drawn
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

  // ---- setup screen ----

  const LABELS = {
    size: { title: 'Grid', fmt: function (n) { return n + '×' + n; } },
    time: { title: 'Time per round', fmt: function (s) { return s % 60 ? Math.floor(s / 60) + '½ min' : s / 60 + ' min'; } },
    rounds: { title: 'Match', fmt: function (n) { return n === 1 ? 'One round' : 'Best of ' + n; } },
  };
  const KEYS = ['size', 'time', 'rounds'];

  /** The choices for one setting, smallest first. */
  function choices(v, key) {
    return v.options[key].slice().sort(function (a, b) { return a - b; });
  }

  /**
   * The settings rows. focus: { key: 'p1 p2' } marks the rows controller
   * players are on (TV only). Phones tap the buttons (data-key, data-value).
   */
  function setupHtml(v, focus) {
    return '<div class="wr-setup">' + KEYS.map(function (key) {
      const f = focus && focus[key] ? ' focus ' + focus[key] : '';
      return '<div class="row' + f + '"><div class="title">' + LABELS[key].title + '</div><div class="seg">' +
        choices(v, key).map(function (value) {
          return '<button type="button" class="opt' + (v.settings[key] === value ? ' on' : '') + '" data-key="' + key + '" data-value="' + value + '">' +
            LABELS[key].fmt(value) + '</button>';
        }).join('') + '</div></div>';
    }).join('') + '</div>';
  }

  /** One line summing the settings up, e.g. "5×5 · 2 min · Best of 3". */
  function summary(v) {
    return KEYS.map(function (key) { return LABELS[key].fmt(v.settings[key]); }).join(' · ');
  }

  window.ArkWords = { gridHtml: gridHtml, spell: spell, adjacent: adjacent, KEYS: KEYS, choices: choices, setupHtml: setupHtml, summary: summary };
})();
