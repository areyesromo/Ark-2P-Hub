// Pawn Race board for the TV and the phones (SVG): the 40-square loop round the edge of an 11 x 11
// grid, each player's Start, home stretch and Home inside it, and the slides. Sets window.ArkPawns.
(function () {
  const S = 10;
  const LOOP = 40;
  const NAMES = ['A', 'B', 'C'];

  /** Grid spot of loop square q: the top row left to right, down the right, the bottom row back, up the left. */
  function loopSpot(q) {
    if (q <= 10) return [q, 0];
    if (q <= 20) return [10, q - 10];
    if (q <= 30) return [30 - q, 10];
    return [0, 40 - q];
  }

  /** Grid spot of a pawn of player s at progress p (0 Start, 1 … 40 loop, 41 … 44 stretch, 45 Home). */
  function spot(v, s, p, k) {
    const entry = v.entry[s];
    if (p >= 1 && p <= LOOP) return loopSpot((entry + p - 1) % LOOP);
    const last = loopSpot((entry + LOOP - 1) % LOOP); // the square before the entry: the stretch turns in here
    const dir = s === 0 ? 1 : -1; // player 1's stretch runs down from the top, player 2's up from the bottom
    if (p > LOOP) return [last[0], last[1] + dir * (p - LOOP)];
    // Start: a little group just inside the entry.
    const e = loopSpot(entry);
    return [e[0] + 0.7 + (k % 2) * 0.9, e[1] + dir * (1.6 + Math.floor(k / 2) * 0.9)];
  }

  const at = (g) => [g[0] * S + S / 2, g[1] * S + S / 2];

  /**
   * v: the view. opts.ghost: { s, pawn, to } a move to show (a see-through pawn where it would go).
   */
  function boardHtml(v, opts) {
    opts = opts || {};
    let svg = '<svg class="pr-board" viewBox="-2 -2 114 114"><rect class="pr-felt" x="-2" y="-2" width="114" height="114" rx="4"/>';
    for (let q = 0; q < LOOP; q++) {
      const g = loopSpot(q);
      const own = v.entry.indexOf(q);
      svg += '<rect class="pr-sq' + (own >= 0 ? ' entry p' + (own + 1) : '') + '" x="' + (g[0] * S + 0.5) + '" y="' + (g[1] * S + 0.5) + '" width="' + (S - 1) + '" height="' + (S - 1) + '" rx="1.2"/>';
    }
    // Home stretches, Homes and Starts.
    [0, 1].forEach(function (s) {
      for (let p = LOOP + 1; p <= LOOP + 4; p++) {
        const g = spot(v, s, p);
        svg += '<rect class="pr-sq stretch p' + (s + 1) + '" x="' + (g[0] * S + 0.5) + '" y="' + (g[1] * S + 0.5) + '" width="' + (S - 1) + '" height="' + (S - 1) + '" rx="1.2"/>';
      }
      const h = at(spot(v, s, LOOP + 5));
      svg += '<circle class="pr-home p' + (s + 1) + '" cx="' + h[0] + '" cy="' + h[1] + '" r="7.5"/><text class="pr-label" x="' + h[0] + '" y="' + (h[1] + (s ? 11 : -9)) + '">Home</text>';
      const st = at(spot(v, s, 0, 0));
      svg += '<rect class="pr-start p' + (s + 1) + '" x="' + (st[0] - 5.5) + '" y="' + (st[1] - 5.5 - (s ? 9 : 0)) + '" width="20" height="20" rx="5"/>';
    });
    // Slides: an arrow along the squares, in the colour of whoever they don't carry.
    v.slides.forEach(function (sl) {
      const a = at(loopSpot(sl.from));
      const b = at(loopSpot(sl.to));
      svg += '<g class="pr-slide p' + (sl.owner + 1) + '"><line x1="' + a[0] + '" y1="' + a[1] + '" x2="' + b[0] + '" y2="' + b[1] + '"/><circle cx="' + a[0] + '" cy="' + a[1] + '" r="2"/><circle cx="' + b[0] + '" cy="' + b[1] + '" r="3"/></g>';
    });
    // Pawns (in Start, side by side).
    [0, 1].forEach(function (s) {
      let k = 0;
      v.pawns[s].forEach(function (p, i) {
        const c = at(spot(v, s, p, p === 0 ? k++ : 0));
        const off = p === 45 ? (i - 1) * 3 : 0;
        svg += '<g class="pr-pawn p' + (s + 1) + (v.lastMove && v.lastMove.by === s && v.lastMove.pawn === i && !v.lastMove.missed ? ' last' : '') + '"><circle cx="' + (c[0] + off) + '" cy="' + c[1] + '" r="3.4"/><text x="' + (c[0] + off) + '" y="' + (c[1] + 1.3) + '">' + NAMES[i] + '</text></g>';
      });
    });
    if (opts.ghost && opts.ghost.to !== undefined) {
      const c = at(spot(v, opts.ghost.s, opts.ghost.to, 0));
      svg += '<circle class="pr-ghost p' + (opts.ghost.s + 1) + '" cx="' + c[0] + '" cy="' + c[1] + '" r="4.2"/>';
    }
    return svg + '</svg>';
  }

  /** A card face: its number (or Bump). */
  function cardHtml(c, cls, attr) {
    return '<span class="pr-card' + (c === 'bump' ? ' bump' : '') + (cls ? ' ' + cls : '') + '"' + (attr || '') + '>' + (c === 'bump' ? 'Bump!' : c) + '</span>';
  }

  /** An option in words. */
  function describe(v, s, o) {
    const card = v.hands[s][o.card];
    const c = card === 'bump' ? 'Bump' : card;
    if (o.kind === 'discard') return 'Throw away the ' + c;
    const name = 'pawn ' + NAMES[o.pawn];
    if (o.kind === 'out') return c + ': bring ' + name + ' out';
    if (o.kind === 'bump') return 'Bump: ' + name + ' out onto their pawn ' + NAMES[o.target];
    if (o.kind === 'swap') return '11: swap ' + name + ' with their pawn ' + NAMES[o.target];
    const from = v.pawns[s][o.pawn];
    const where = o.to === 45 ? ' Home!' : o.to > 40 && from <= 40 ? ' into the home stretch' : '';
    return c + ': ' + name + (o.kind === 'back' ? ' back ' + (card === 10 ? 1 : 4) : ' forward ' + (o.to - from)) + where;
  }

  window.ArkPawns = { boardHtml: boardHtml, cardHtml: cardHtml, describe: describe, NAMES: NAMES };
})();
