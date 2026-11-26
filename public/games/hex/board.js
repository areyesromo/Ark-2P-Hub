// Hex board for the TV and the phones: a rhombus of hexagons in SVG, player 1's edges (top and
// bottom) and player 2's (left and right) in their colours. Sets window.ArkHex.
(function () {
  const R = 10; // a hexagon's radius, in board units
  const W = Math.sqrt(3) * R;
  const PAD = 16;
  const at = (x, y) => [PAD + W * (x + y / 2) + W / 2, PAD + 1.5 * R * y + R];

  function hexPoints(cx, cy, r) {
    const out = [];
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 180) * (60 * k - 90);
      out.push((cx + r * Math.cos(a)).toFixed(2) + ',' + (cy + r * Math.sin(a)).toFixed(2));
    }
    return out.join(' ');
  }

  /**
   * v: the view. opts.aim: a hexagon picked (a see-through stone shows there); opts.aimSlot: whose.
   * opts.tappable. opts.cursor / opts.cursorSlot: a controller's aim. opts.upright: turned a quarter
   * turn, to stand tall on a phone (player 1's edges are then on the sides).
   */
  function boardHtml(v, opts) {
    opts = opts || {};
    const n = v.size;
    const width = PAD * 2 + W * ((n - 1) * 1.5 + 1);
    const height = PAD * 2 + R * (1.5 * (n - 1) + 2);
    // The four edges: triangles from the middle to the corners, pushed out beyond the corner hexagons.
    const mid = at((n - 1) / 2, (n - 1) / 2);
    const corner = function (x, y) {
      const p = at(x, y);
      const dx = p[0] - mid[0];
      const dy = p[1] - mid[1];
      const d = Math.hypot(dx, dy);
      return [p[0] + (dx / d) * R * 1.9, p[1] + (dy / d) * R * 1.9];
    };
    const tl = corner(0, 0);
    const tr = corner(n - 1, 0);
    const br = corner(n - 1, n - 1);
    const bl = corner(0, n - 1);
    const tri = function (a, b, fill) { return '<polygon points="' + mid.join(',') + ' ' + a.join(',') + ' ' + b.join(',') + '" fill="' + fill + '"/>'; };
    const box = opts.upright ? height.toFixed(1) + ' ' + width.toFixed(1) : width.toFixed(1) + ' ' + height.toFixed(1);
    let svg = '<svg class="hx-board' + (opts.tappable ? ' tappable' : '') + (opts.upright ? ' upright' : '') + '" viewBox="0 0 ' + box + '">' +
      (opts.upright ? '<g transform="translate(' + height.toFixed(1) + ' 0) rotate(90)">' : '') +
      tri(tl, tr, 'var(--p1)') + tri(br, bl, 'var(--p1)') + tri(tr, br, 'var(--p2)') + tri(bl, tl, 'var(--p2)');
    const chain = {};
    (v.chain || []).forEach(function (c) { chain[c] = true; });
    const last = v.lastMove ? v.lastMove.cell : -1;
    let top = '';
    for (let c = 0; c < n * n; c++) {
      const p = at(c % n, Math.floor(c / n));
      const who = v.board[c];
      const cursor = opts.cursor === c;
      svg += '<polygon class="hx-cell' + (cursor ? ' aim p' + (opts.cursorSlot + 1) : '') + '" points="' + hexPoints(p[0], p[1], R - 0.4) + '"' +
        (opts.tappable && !who ? ' data-c="' + c + '"' : '') + '/>';
      const slot = who ? who : opts.aim === c ? opts.aimSlot + 1 : 0;
      if (!slot) continue;
      const cls = 'hx-stone p' + slot + (who ? '' : ' ghost') + (chain[c] ? ' win' : '') + (c === last ? ' last' : '');
      // (player 1's stones have a dot, player 2's a ring: told apart without the colours)
      const mark = slot === 1 ? '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="2" class="hx-mark"/>' : '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="3.2" class="hx-ring"/>';
      const g = '<g class="' + cls + '"><circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + (R * 0.68) + '"/>' + mark + '</g>';
      if (cursor) top += g; else svg += g;
    }
    return svg + top + (opts.upright ? '</g>' : '') + '</svg>';
  }

  window.ArkHex = { boardHtml: boardHtml };
})();
