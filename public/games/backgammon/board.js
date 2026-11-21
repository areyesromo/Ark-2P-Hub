// Backgammon board for the TV and the phones, seen from one side (`side`: whose home is at the
// bottom right). Sets window.ArkBG.
(function () {
  // Where each point sits, as [row, column] (row 0 top; columns 0-5 left of the bar, 6-11 right).
  function layout(side) {
    const at = {};
    for (let k = 0; k < 6; k++) {
      // (from player 1's side: 0..5 bottom right, right to left; 6..11 bottom left; 12..17 top left; 18..23 top right)
      at[k] = [1, 11 - k];
      at[6 + k] = [1, 5 - k];
      at[12 + k] = [0, k];
      at[18 + k] = [0, 6 + k];
    }
    if (side === 0) return at;
    const flipped = {};
    for (let i = 0; i < 24; i++) flipped[i] = at[23 - i];
    return flipped;
  }

  function checker(slot, extra) {
    return '<i class="bg-ck p' + (slot + 1) + (extra ? ' ' + extra : '') + '"></i>';
  }

  /** A pile of checkers: up to 5 drawn, the rest as a number on the last. */
  function pile(n, slot, extra) {
    let html = '';
    const shown = Math.min(n, 5);
    for (let k = 0; k < shown; k++) {
      const last = k === shown - 1;
      html += '<i class="bg-ck p' + (slot + 1) + (last && extra ? ' ' + extra : '') + '">' + (last && n > 5 ? '<b>' + n + '</b>' : '') + '</i>';
    }
    return html;
  }

  /**
   * v: the view. opts.side: whose home is bottom right. opts.from: the picked point (or 'bar').
   * opts.sources / opts.targets: points to light up (Sets, may hold 'bar' / 'off'). opts.tappable.
   * opts.cursor: a controller's aim (a point, 'bar' or 'off').
   */
  function boardHtml(v, opts) {
    opts = opts || {};
    const side = opts.side || 0;
    const at = layout(side);
    const src = opts.sources || new Set();
    const tgt = opts.targets || new Set();
    const landed = {};
    (v.moved || []).forEach(function (m) { if (m.to !== 'off') landed[m.to] = true; });
    const tap = function (key) { return opts.tappable && (src.has(key) || tgt.has(key)) ? ' data-pt="' + key + '"' : ''; };
    const cls = function (key) {
      return (src.has(key) ? ' src' : '') + (tgt.has(key) ? ' tgt' : '') + (opts.from === key ? ' picked' : '') + (opts.cursor === key ? ' aim' : '');
    };
    const halves = [[], []]; // [row][column] html
    for (let i = 0; i < 24; i++) {
      const [row, col] = at[i];
      const n = Math.abs(v.points[i]);
      const owner = v.points[i] > 0 ? 0 : 1;
      const tone = (col + row) % 2 ? 'b' : 'a';
      halves[row][col] = '<div class="bg-pt ' + (row ? 'low' : 'high') + ' ' + tone + cls(i) + '"' + tap(i) + '><span class="bg-tri"></span><span class="bg-stack">' +
        (n ? pile(n, owner, landed[i] ? 'landed' : '') : '') + '</span></div>';
    }
    const other = 1 - side;
    const bar = function (slot, row) {
      const n = v.bar[slot];
      return '<div class="bg-bar-half ' + (row ? 'low' : 'high') + (slot === side ? cls('bar') : '') + '"' + (slot === side ? tap('bar') : '') + '>' + (n ? pile(n, slot) : '') + '</div>';
    };
    const tray = function (slot, row) {
      const n = v.off[slot];
      let slabs = '';
      for (let k = 0; k < n; k++) slabs += '<i class="bg-slab p' + (slot + 1) + '"></i>';
      return '<div class="bg-tray-half ' + (row ? 'low' : 'high') + (slot === side ? cls('off') : '') + '"' + (slot === side ? tap('off') : '') + '>' + slabs + (n ? '<b>' + n + '</b>' : '') + '</div>';
    };
    const cube = v.cubeOn ? '<span class="bg-cube' + (v.cube.owner === null ? '' : v.cube.owner === side ? ' mine' : ' theirs') + '">' + (v.cube.value === 1 ? 64 : v.cube.value) + '</span>' : '';
    let html = '<div class="bg-board">';
    html += '<div class="bg-half high">' + halves[0].slice(0, 6).join('') + '</div>';
    html += '<div class="bg-bar">' + bar(other, 0) + cube + bar(side, 1) + '</div>';
    html += '<div class="bg-half high r">' + halves[0].slice(6).join('') + '</div>';
    html += '<div class="bg-tray">' + tray(other, 0) + tray(side, 1) + '</div>';
    html += '<div class="bg-half low">' + halves[1].slice(0, 6).join('') + '</div>';
    html += '<div class="bg-half low r">' + halves[1].slice(6).join('') + '</div>';
    html += '<div class="bg-dice">' + (opts.dice || '') + '</div>';
    return html + '</div>';
  }

  /** The dice of the turn: the ones used fade (doubles show four). */
  function diceHtml(v) {
    if (v.opening) return '<span class="bg-open p1">' + ArkDice.html(v.opening[0]) + '</span><span class="bg-open p2">' + ArkDice.html(v.opening[1]) + '</span>';
    if (!v.rolled || !v.rolled.length || (v.phase !== 'move' && v.phase !== 'noMove')) return '';
    const all = v.rolled[0] === v.rolled[1] ? [v.rolled[0], v.rolled[0], v.rolled[0], v.rolled[0]] : v.rolled.slice();
    const left = v.dice.slice();
    return all.map(function (d) {
      const i = left.indexOf(d);
      if (i >= 0) { left.splice(i, 1); return ArkDice.html(d, 'p' + (v.turn + 1)); }
      return ArkDice.html(d, 'used');
    }).join('');
  }

  window.ArkBG = { boardHtml: boardHtml, diceHtml: diceHtml, checker: checker };
})();
