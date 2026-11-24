// Nine Men's Morris board for the TV and the phones. Sets window.ArkMorris.
(function () {
  // Each point's place on a 7 x 7 grid: the three squares, each clockwise from its top left.
  const RING = [[0, 0], [3, 0], [6, 0], [6, 3], [6, 6], [3, 6], [0, 6], [0, 3]];
  const POS = [];
  for (let r = 0; r < 3; r++) RING.forEach(function (xy) { POS.push([r + (xy[0] / 6) * (6 - 2 * r), r + (xy[1] / 6) * (6 - 2 * r)]); });
  const pct = function (v) { return 5 + (v / 6) * 90; };

  function lines() {
    let s = '<svg class="mo-lines" viewBox="0 0 100 100" aria-hidden="true">';
    for (let r = 0; r < 3; r++) {
      const a = pct(r);
      const b = pct(6 - r);
      s += '<rect x="' + a + '" y="' + a + '" width="' + (b - a) + '" height="' + (b - a) + '"/>';
    }
    s += '<path d="M50 ' + pct(0) + 'V' + pct(2) + 'M50 ' + pct(4) + 'V' + pct(6) + 'M' + pct(0) + ' 50H' + pct(2) + 'M' + pct(4) + ' 50H' + pct(6) + '"/>';
    return s + '</svg>';
  }

  /**
   * v: the view. opts.from: a piece picked to move. opts.targets: points it can go (a Set).
   * opts.tappable: what may be tapped is marked. opts.cursor / opts.cursorSlot: a controller's aim.
   */
  function boardHtml(v, opts) {
    opts = opts || {};
    const t = opts.targets || new Set();
    const movers = new Set(v.actions.filter(function (a) { return a.from !== undefined; }).map(function (a) { return a.from; }));
    const places = new Set(v.actions.filter(function (a) { return a.at !== undefined; }).map(function (a) { return a.at; }));
    const take = new Set(v.takeable);
    const mill = new Set(v.mill || []);
    let html = '<div class="mo-board' + (opts.tappable ? ' tappable' : '') + '">' + lines();
    for (let p = 0; p < 24; p++) {
      const xy = POS[p];
      const who = v.board[p];
      const st = 'left:' + pct(xy[0]) + '%;top:' + pct(xy[1]) + '%';
      const isLast = v.last && (v.last.to === p || v.last.at === p);
      let cls = 'mo-pt';
      if (!who && (places.has(p) || t.has(p))) cls += ' open';
      if (opts.cursor === p) cls += ' aim p' + (opts.cursorSlot + 1);
      html += '<span class="' + cls + '" style="' + st + '" data-p="' + p + '"></span>';
      if (who) {
        let pc = 'mo-piece p' + who;
        if (movers.has(p) && opts.from === undefined) pc += ' can';
        if (opts.from === p) pc += ' picked';
        if (take.has(p)) pc += ' take';
        if (mill.has(p)) pc += ' mill';
        if (isLast) pc += ' last';
        html += '<b class="' + pc + '" style="' + st + '" data-p="' + p + '"></b>';
      }
    }
    return html + '</div>';
  }

  function stones(n, slot) {
    let s = '<span class="mo-hand">';
    for (let i = 0; i < n; i++) s += '<b class="mo-piece p' + (slot + 1) + ' small"></b>';
    return s + '</span>';
  }

  window.ArkMorris = { boardHtml: boardHtml, stones: stones, POS: POS };
})();
