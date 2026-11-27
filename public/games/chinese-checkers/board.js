// Chinese Checkers board for the TV and the phones: the 121-hole star in SVG, and the move rules
// (the same as server/games/chinese-checkers.js) so a phone can show where a piece can go.
// Sets window.ArkStar.
(function () {
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, -1], [-1, 1]];
  const HOLES = [];
  for (let r = -8; r <= 8; r++) {
    for (let q = -8; q <= 8; q++) {
      const s = -q - r;
      if (Math.abs(s) > 8) continue;
      if ((q >= -4 && r >= -4 && s >= -4) || (q <= 4 && r <= 4 && s <= 4)) HOLES.push([q, r]);
    }
  }
  const INDEX = {};
  HOLES.forEach(function (h, i) { INDEX[h[0] + ',' + h[1]] = i; });
  const at = function (q, r) { const k = q + ',' + r; return k in INDEX ? INDEX[k] : -1; };
  const D = 10;
  const pos = function (i) { const h = HOLES[i]; return [(h[0] + h[1] / 2) * D, h[1] * D * 0.866]; };

  function movesFrom(board, from) {
    const out = {};
    const h = HOLES[from];
    DIRS.forEach(function (d) { const n = at(h[0] + d[0], h[1] + d[1]); if (n >= 0 && !board[n]) out[n] = true; });
    const seen = {};
    seen[from] = true;
    const queue = [from];
    while (queue.length) {
      const c = queue.shift();
      const ch = HOLES[c];
      DIRS.forEach(function (d) {
        const over = at(ch[0] + d[0], ch[1] + d[1]);
        const land = at(ch[0] + 2 * d[0], ch[1] + 2 * d[1]);
        if (over < 0 || land < 0 || !board[over] || board[land] || seen[land]) return;
        seen[land] = true;
        out[land] = true;
        queue.push(land);
      });
    }
    return Object.keys(out).map(Number);
  }

  /** The hole next to `c` in a pad direction (or `c` if there's none). */
  function nextHole(c, btn) {
    const h = HOLES[c];
    const tries = { LEFT: [[-1, 0]], RIGHT: [[1, 0]], UP: [[0, -1], [1, -1]], DOWN: [[0, 1], [-1, 1]] }[btn] || [];
    for (let k = 0; k < tries.length; k++) {
      const n = at(h[0] + tries[k][0], h[1] + tries[k][1]);
      if (n >= 0) return n;
    }
    return c;
  }

  /**
   * v: the view. opts.picked: the piece picked; opts.targets: holes it can go to (tappable).
   * opts.tap: the player's own pieces are tappable (slot opts.me). opts.cursor / opts.cursorSlot: a
   * controller's aim. opts.flip: turned round (your point at the bottom).
   */
  function boardHtml(v, opts) {
    opts = opts || {};
    const targets = {};
    (opts.targets || []).forEach(function (c) { targets[c] = true; });
    const last = v.lastMove && v.lastMove.from >= 0 ? v.lastMove : null;
    let svg = '<svg class="cc-board' + (opts.flip ? ' flip' : '') + '" viewBox="-88 -76 176 152">' +
      '<polygon class="cc-star" points="' + starPoints() + '"/>';
    HOLES.forEach(function (h, i) {
      const p = pos(i);
      const zone = h[1] > 4 ? ' z1' : h[1] < -4 ? ' z2' : '';
      const who = v.board[i];
      const mine = opts.tap && who === opts.me + 1;
      const tap = targets[i] || mine;
      let cls = 'cc-hole' + zone + (targets[i] ? ' target' : '') + (opts.cursor === i ? ' aim c' + (opts.cursorSlot + 1) : '') + (last && last.from === i ? ' from' : '');
      svg += '<circle class="' + cls + '" cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="3.4"' + (tap ? ' data-c="' + i + '"' : '') + '/>';
      if (who) {
        cls = 'cc-piece p' + who + (opts.picked === i ? ' picked' : '') + (last && last.to === i ? ' last' : '');
        svg += '<g class="' + cls + '"><circle cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="3.6"/>' +
          (who === 1 ? '<circle class="mark" cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="1"/>' : '<circle class="ring" cx="' + p[0].toFixed(2) + '" cy="' + p[1].toFixed(2) + '" r="1.7"/>') + '</g>';
      }
    });
    return svg + '</svg>';
  }

  function starPoints() {
    // The outline: the six tips and the six inner corners, pushed out a little.
    const pts = [[4, -8], [4, -4], [8, -4], [4, 0], [4, 4], [0, 4], [-4, 8], [-4, 4], [-8, 4], [-4, 0], [-4, -4], [0, -4]];
    return pts.map(function (h) {
      const x = (h[0] + h[1] / 2) * D;
      const y = h[1] * D * 0.866;
      const len = Math.hypot(x, y) || 1;
      const k = (len + 8) / len;
      return (x * k).toFixed(1) + ',' + (y * k).toFixed(1);
    }).join(' ');
  }

  /**
   * The hole nearest a tap on the board (the holes are small on a phone, so near enough counts),
   * or -1. `svg`: the board's element; `flip`: whether it's turned round.
   */
  function holeAt(svg, clientX, clientY, flip) {
    const box = svg.getBoundingClientRect();
    let x = ((clientX - box.left) / box.width) * 176 - 88;
    let y = ((clientY - box.top) / box.height) * 152 - 76;
    if (flip) { x = -x; y = -y; }
    let best = -1;
    let bestD = 7; // (holes are 10 apart)
    HOLES.forEach(function (h, i) {
      const p = pos(i);
      const d = Math.hypot(p[0] - x, p[1] - y);
      if (d < bestD) { bestD = d; best = i; }
    });
    return best;
  }

  window.ArkStar = { boardHtml: boardHtml, movesFrom: movesFrom, nextHole: nextHole, holeAt: holeAt, HOLES: HOLES };
})();
