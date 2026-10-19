// Dots and Boxes board (SVG) shared by the TV and the phones. 1 unit = one box.
(function () {
  const COL = ['var(--p1)', 'var(--p2)'];

  /**
   * v: the game view. opts.tappable: open lines are buttons (phone, on your turn; data-line="h,r,c").
   * opts.cursor: a controller's dot {r, c}; opts.armed: it picked that dot and an arrow draws the line;
   * opts.cursorSlot: whose colour it is. opts.names: initials for claimed boxes.
   */
  function boardSvg(v, opts) {
    opts = opts || {};
    const n = v.size;
    const pad = 0.35;
    let s = '<svg class="db-board' + (opts.tappable ? ' tappable' : '') + '" viewBox="' + -pad + ' ' + -pad + ' ' + (n + pad * 2) + ' ' + (n + pad * 2) + '">';
    const fresh = {};
    (v.lastBoxes || []).forEach(function (b) { fresh[b[0] + ',' + b[1]] = true; });
    // claimed boxes
    v.boxes.forEach(function (row, r) {
      row.forEach(function (who, c) {
        if (who === null) return;
        s += '<rect class="box' + (fresh[r + ',' + c] ? ' fresh' : '') + '" x="' + (c + 0.06) + '" y="' + (r + 0.06) + '" width="0.88" height="0.88" rx="0.08" style="fill:' + COL[who] + '"/>';
        if (opts.names) s += '<text x="' + (c + 0.5) + '" y="' + (r + 0.52) + '">' + opts.names[who] + '</text>';
      });
    });
    const last = v.lastLine;
    function lineEl(dir, r, c, who) {
      const x1 = c;
      const y1 = r;
      const x2 = dir === 'h' ? c + 1 : c;
      const y2 = dir === 'h' ? r : r + 1;
      const xy = 'x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"';
      if (who !== null) {
        const isLast = last && last.dir === dir && last.r === r && last.c === c;
        return '<line class="drawn' + (isLast ? ' last' : '') + '" ' + xy + ' style="stroke:' + COL[who] + '"/>';
      }
      return '<line class="open" ' + xy + '/>' + (opts.tappable ? '<line class="hit" data-line="' + dir + ',' + r + ',' + c + '" ' + xy + '/>' : '');
    }
    v.h.forEach(function (row, r) { row.forEach(function (who, c) { s += lineEl('h', r, c, who); }); });
    v.v.forEach(function (row, r) { row.forEach(function (who, c) { s += lineEl('v', r, c, who); }); });
    // dots (the controller's cursor dot is bigger, in their colour)
    for (let r = 0; r <= n; r++) {
      for (let c = 0; c <= n; c++) {
        const cur = opts.cursor && opts.cursor.r === r && opts.cursor.c === c;
        s += '<circle class="dot' + (cur ? ' cur' + (opts.armed ? ' armed' : '') : '') + '" cx="' + c + '" cy="' + r + '" r="' + (cur ? 0.14 : 0.08) + '"' +
          (cur ? ' style="fill:' + COL[opts.cursorSlot] + '"' : '') + '/>';
      }
    }
    return s + '</svg>';
  }

  window.ArkDB = { boardSvg: boardSvg };
})();
