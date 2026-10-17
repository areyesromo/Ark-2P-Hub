// Memory Match card grid, shared by the TV and the phones.
(function () {
  let themes = ['Animals', 'Food', 'Sports', 'Things']; // updated from the server's views (themeNames)
  const ROWS = [
    { key: 'cards', title: 'Cards', fmt: function (n) { return n + ' cards'; } },
    { key: 'theme', title: 'Pictures', fmt: function (n) { return n === 0 ? 'Mixed' : themes[n - 1] || 'Set ' + n; } },
    { key: 'turnSeconds', title: 'Time per turn', fmt: function (n) { return n + ' s'; } },
  ];

  function setThemes(names) {
    if (names && names.length) themes = names;
  }

  /** The grid. cursor: { index, cls } rings a card (a controller player's aim). */
  function gridHtml(v, cursor) {
    let html = '<div class="mm-grid" style="--cols:' + v.cols + ';--rows:' + v.rows + '">';
    v.cards.forEach(function (c, i) {
      let cls = 'card';
      if (c.up) cls += ' up';
      if (c.owner !== null && c.owner !== undefined) cls += ' p' + (c.owner + 1);
      else if (c.up) cls += ' now';
      if (cursor && cursor.index === i) cls += ' aim ' + cursor.cls;
      html += '<button type="button" class="' + cls + '" data-i="' + i + '">' + (c.up ? '<span class="face">' + c.face + '</span>' : '<span class="back">?</span>') + '</button>';
    });
    return html + '</div>';
  }

  window.ArkMemory = { gridHtml: gridHtml, ROWS: ROWS, setThemes: setThemes };
})();
