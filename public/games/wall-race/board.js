// Wall Race board for the TV and the phones (SVG), and the wall rules (the same as
// server/games/wall-race.js) so a phone can show a wall that won't go in red. Sets window.ArkWalls.
(function () {
  const S = 10; // a square
  const G = 2.6; // a groove between squares
  const P = S + G;
  const STEPS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

  function blocked(n, h, v, x, y, dx, dy) {
    const m = n - 1;
    if (dy) {
      const row = dy > 0 ? y : y - 1;
      return Boolean((x < m && h[row * m + x]) || (x > 0 && h[row * m + x - 1]));
    }
    const col = dx > 0 ? x : x - 1;
    return Boolean((y < m && v[y * m + col]) || (y > 0 && v[(y - 1) * m + col]));
  }

  function reaches(n, h, v, cell, goal) {
    const seen = {};
    seen[cell] = true;
    const queue = [cell];
    for (let i = 0; i < queue.length; i++) {
      const c = queue[i];
      if (Math.floor(c / n) === goal) return true;
      const x = c % n;
      const y = Math.floor(c / n);
      STEPS.forEach(function (d) {
        const nx = x + d[0];
        const ny = y + d[1];
        if (nx < 0 || ny < 0 || nx >= n || ny >= n || blocked(n, h, v, x, y, d[0], d[1])) return;
        const m = ny * n + nx;
        if (!seen[m]) { seen[m] = true; queue.push(m); }
      });
    }
    return false;
  }

  /** May a wall go at crossing k (dir 'h' or 'v')? */
  function wallOk(vw, dir, k) {
    const n = vw.size;
    const m = n - 1;
    const h = vw.h;
    const v = vw.v;
    if (k < 0 || k >= m * m || h[k] || v[k]) return false;
    const x = k % m;
    const y = Math.floor(k / m);
    if (dir === 'h' && ((x > 0 && h[k - 1]) || (x < m - 1 && h[k + 1]))) return false;
    if (dir === 'v' && ((y > 0 && v[k - m]) || (y < m - 1 && v[k + m]))) return false;
    const nh = dir === 'h' ? h.slice() : h;
    const nv = dir === 'v' ? v.slice() : v;
    (dir === 'h' ? nh : nv)[k] = 1;
    return reaches(n, nh, nv, vw.pawns[0], vw.goals[0]) && reaches(n, nh, nv, vw.pawns[1], vw.goals[1]);
  }

  function wallRect(n, dir, k, cls) {
    const m = n - 1;
    const x = k % m;
    const y = Math.floor(k / m);
    return dir === 'h'
      ? '<rect class="' + cls + '" x="' + (x * P - 0.4) + '" y="' + (y * P + S + 0.2) + '" width="' + (2 * S + G + 0.8) + '" height="' + (G - 0.4) + '" rx="0.8"/>'
      : '<rect class="' + cls + '" x="' + (x * P + S + 0.2) + '" y="' + (y * P - 0.4) + '" width="' + (G - 0.4) + '" height="' + (2 * S + G + 0.8) + '" rx="0.8"/>';
  }

  /**
   * v: the view. opts.steps: squares to offer (tappable). opts.ghost: { dir, k, ok } a wall being
   * placed. opts.cursor / opts.cursorSlot: a controller's square. opts.tap: every square tappable
   * (placing walls on a phone). opts.flip: turn it round (your edge at the bottom).
   */
  function boardHtml(v, opts) {
    opts = opts || {};
    const n = v.size;
    const W = n * P - G;
    let svg = '<svg class="wr-board' + (opts.flip ? ' flip' : '') + '" viewBox="-2 -2 ' + (W + 4) + ' ' + (W + 4) + '">';
    const steps = {};
    (opts.steps || []).forEach(function (c) { steps[c] = true; });
    for (let c = 0; c < n * n; c++) {
      const x = c % n;
      const y = Math.floor(c / n);
      const goal = y === v.goals[0] ? ' goal1' : y === v.goals[1] ? ' goal2' : '';
      const tap = steps[c] || opts.tap;
      svg += '<rect class="wr-sq' + goal + (steps[c] ? ' step' : '') + (opts.cursor === c ? ' aim c' + (opts.cursorSlot + 1) : '') + '" x="' + x * P + '" y="' + y * P + '" width="' + S + '" height="' + S + '" rx="1.2"' + (tap ? ' data-c="' + c + '"' : '') + '/>';
      if (steps[c]) svg += '<circle class="wr-dot" cx="' + (x * P + S / 2) + '" cy="' + (y * P + S / 2) + '" r="1.6"/>';
    }
    for (let k = 0; k < (n - 1) * (n - 1); k++) {
      if (v.h[k]) svg += wallRect(n, 'h', k, 'wr-wall w' + v.h[k] + (v.lastMove && v.lastMove.kind === 'wall' && v.lastMove.dir === 'h' && v.lastMove.k === k ? ' last' : ''));
      if (v.v[k]) svg += wallRect(n, 'v', k, 'wr-wall w' + v.v[k] + (v.lastMove && v.lastMove.kind === 'wall' && v.lastMove.dir === 'v' && v.lastMove.k === k ? ' last' : ''));
    }
    if (opts.ghost) svg += wallRect(n, opts.ghost.dir, opts.ghost.k, 'wr-ghost' + (opts.ghost.ok ? '' : ' bad'));
    v.pawns.forEach(function (c, s) {
      const x = (c % n) * P + S / 2;
      const y = Math.floor(c / n) * P + S / 2;
      svg += '<g class="wr-pawn p' + (s + 1) + '"><circle cx="' + x + '" cy="' + y + '" r="3.8"/>' +
        (s === 0 ? '<circle cx="' + x + '" cy="' + y + '" r="1.1" class="mark"/>' : '<circle cx="' + x + '" cy="' + y + '" r="1.9" class="ring"/>') + '</g>';
    });
    return svg + '</svg>';
  }

  window.ArkWalls = { boardHtml: boardHtml, wallOk: wallOk };
})();
