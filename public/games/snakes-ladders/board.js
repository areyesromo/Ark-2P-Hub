// Snakes & Ladders board for the TV and the phones (SVG): 100 squares winding up from the bottom
// left, ladders (wood) and snakes (green: their colours are their own). Sets window.ArkSnakes.
(function () {
  const S = 10;

  /** The middle of square n (1 … 100); 0 is the start, off the board below square 1. */
  function centre(n) {
    if (n <= 0) return [-6, 100 + 5];
    const r = Math.floor((n - 1) / 10);
    let c = (n - 1) % 10;
    if (r % 2) c = 9 - c;
    return [c * S + S / 2, (9 - r) * S + S / 2];
  }

  function ladder(a, b) {
    const p = centre(a);
    const q = centre(b);
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    const len = Math.hypot(dx, dy);
    const nx = (-dy / len) * 1.8;
    const ny = (dx / len) * 1.8;
    let s = '<g class="sl-ladder"><line x1="' + (p[0] + nx) + '" y1="' + (p[1] + ny) + '" x2="' + (q[0] + nx) + '" y2="' + (q[1] + ny) + '"/>' +
      '<line x1="' + (p[0] - nx) + '" y1="' + (p[1] - ny) + '" x2="' + (q[0] - nx) + '" y2="' + (q[1] - ny) + '"/>';
    const rungs = Math.max(2, Math.round(len / 4));
    for (let k = 1; k < rungs; k++) {
      const t = k / rungs;
      const x = p[0] + dx * t;
      const y = p[1] + dy * t;
      s += '<line x1="' + (x + nx) + '" y1="' + (y + ny) + '" x2="' + (x - nx) + '" y2="' + (y - ny) + '"/>';
    }
    return s + '</g>';
  }

  function snake(head, tail) {
    const p = centre(head);
    const q = centre(tail);
    const dx = q[0] - p[0];
    const dy = q[1] - p[1];
    // A wiggle: two bends either side of the straight line.
    const nx = -dy * 0.18;
    const ny = dx * 0.18;
    const d = 'M' + p[0] + ' ' + p[1] + ' C' + (p[0] + dx * 0.33 + nx) + ' ' + (p[1] + dy * 0.33 + ny) + ' ' + (p[0] + dx * 0.66 - nx) + ' ' + (p[1] + dy * 0.66 - ny) + ' ' + q[0] + ' ' + q[1];
    return '<g class="sl-snake"><path d="' + d + '"/><circle cx="' + p[0] + '" cy="' + p[1] + '" r="2.4"/><circle class="eye" cx="' + (p[0] - 0.8) + '" cy="' + (p[1] - 0.6) + '" r="0.5"/><circle class="eye" cx="' + (p[0] + 0.8) + '" cy="' + (p[1] - 0.6) + '" r="0.5"/></g>';
  }

  /** v: the view. opts.preview: squares to mark (where each die would land). */
  function boardHtml(v, opts) {
    opts = opts || {};
    let s = '<svg class="sl-board" viewBox="-13 -1 116 113">';
    for (let n = 1; n <= 100; n++) {
      const c = centre(n);
      const x = c[0] - S / 2;
      const y = c[1] - S / 2;
      const r = Math.floor((n - 1) / 10);
      s += '<rect class="sl-sq ' + ((r + ((n - 1) % 10)) % 2 ? 'a' : 'b') + (n === 100 ? ' home' : '') + '" x="' + x + '" y="' + y + '" width="' + S + '" height="' + S + '"/>' +
        '<text class="sl-num" x="' + (x + 0.8) + '" y="' + (y + 2.8) + '">' + n + '</text>';
    }
    Object.keys(v.ladders).forEach(function (a) { s += ladder(Number(a), v.ladders[a]); });
    Object.keys(v.snakes).forEach(function (h) { s += snake(Number(h), v.snakes[h]); });
    (opts.preview || []).forEach(function (n, i) {
      const c = centre(n);
      s += '<g class="sl-preview"><circle cx="' + c[0] + '" cy="' + c[1] + '" r="4.2"/><text x="' + c[0] + '" y="' + (c[1] + 1.4) + '">' + (i ? 'B' : 'X') + '</text></g>';
    });
    s += '<text class="sl-start" x="-6" y="110.5">Start</text>';
    v.pos.forEach(function (n, slot) {
      const c = centre(n);
      const off = v.pos[0] === v.pos[1] ? (slot ? 2.2 : -2.2) : 0;
      const last = v.lastMove && v.lastMove.by === slot ? ' last' : '';
      s += '<g class="sl-pawn p' + (slot + 1) + last + '"><circle cx="' + (c[0] + off) + '" cy="' + c[1] + '" r="3"/>' +
        (slot ? '<circle class="ring" cx="' + (c[0] + off) + '" cy="' + c[1] + '" r="1.5"/>' : '<circle class="mark" cx="' + (c[0] + off) + '" cy="' + c[1] + '" r="0.9"/>') + '</g>';
    });
    return s + '</svg>';
  }

  window.ArkSnakes = { boardHtml: boardHtml };
})();
