// Cribbage's shared bits for the TV and the phones: the peg board (a track of holes for each of
// you, in fives, with a front peg and the back peg it jumped from) and a count's items in words.
(function () {
  /** The board as SVG: two tracks of `target` holes. */
  function pegBoard(v) {
    const holes = v.target;
    const per = holes > 61 ? 61 : holes; // holes a row (a 121 board folds into two rows each way)
    const rows = Math.ceil(holes / per);
    const W = per + Math.floor(per / 5) + 2;
    const H = rows * 5 + 1;
    let out = '<svg class="cb-pegs" viewBox="0 0 ' + W + ' ' + H + '">';
    out += '<rect class="board" x="0" y="0" width="' + W + '" height="' + H + '" rx="1.2"/>';
    const at = function (slot, k) {
      // Hole k (1 … target): left to right on the first row, back right to left on the next.
      const row = Math.floor((k - 1) / per);
      let i = (k - 1) % per;
      if (row % 2) i = per - 1 - i;
      const x = 1.5 + i + Math.floor(i / 5);
      const y = 1.5 + row * 5 + slot * 2;
      return [x, y];
    };
    for (const slot of [0, 1]) {
      for (let k = 1; k <= holes; k++) {
        const p = at(slot, k);
        out += '<circle class="hole" cx="' + p[0] + '" cy="' + p[1] + '" r="0.28"/>';
      }
      [[v.backPegs[slot], 'back'], [v.scores[slot], 'front']].forEach(function (pg) {
        if (!pg[0]) return;
        const p = at(slot, pg[0]);
        out += '<circle class="peg p' + (slot + 1) + ' ' + pg[1] + '" cx="' + p[0] + '" cy="' + p[1] + '" r="0.55"/>';
      });
    }
    return out + '</svg>';
  }

  const KIND = { fifteen: '15', pair: 'pair', run: 'run', flush: 'flush', nobs: 'his nobs', late: 'out of time: no count' };

  /** A count's items, e.g. "15 · 15 · pair · run of 3 = 9". */
  function items(show) {
    if (!show.items.length) return 'nothing (0)';
    return show.items.map(function (x) {
      const name = x.kind === 'run' ? 'run of ' + x.cards.length : KIND[x.kind];
      return name + ' (' + x.pts + ')';
    }).join(' · ') + ' = <b>' + show.total + '</b>';
  }

  window.ArkCrib = { pegBoard: pegBoard, items: items };
})();
