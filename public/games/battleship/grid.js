// Battleship grid markup shared by the TV and the phones.
(function () {
  const ROWS = 'ABCDEFGHIJKLMNOP';

  /** "C7" style name for a cell: rows are letters, columns numbers. */
  function coord(x, y) {
    return ROWS[y] + (x + 1);
  }

  /**
   * opts: size, shots (flat array: 0 none, 1 miss, 2 hit), ships ([{x, y, dir,
   * len, sunk}]), selected (ship index), last / aim / cursor ({x, y}), labels.
   */
  function gridHtml(opts) {
    const n = opts.size;
    const cells = new Array(n * n);
    for (let i = 0; i < n * n; i++) cells[i] = [];
    (opts.ships || []).forEach(function (s, idx) {
      for (let k = 0; k < s.len; k++) {
        const x = s.dir === 'h' ? s.x + k : s.x;
        const y = s.dir === 'v' ? s.y + k : s.y;
        if (x >= n || y >= n) continue;
        const c = cells[y * n + x];
        c.push('ship', s.dir);
        if (k === 0) c.push('bow');
        if (k === s.len - 1) c.push('stern');
        if (s.sunk) c.push('sunk');
        if (opts.selected === idx) c.push('selected');
      }
    });
    (opts.shots || []).forEach(function (v, i) {
      if (v === 1) cells[i].push('miss');
      if (v === 2) cells[i].push('hit');
    });
    ['last', 'aim', 'cursor'].forEach(function (k) {
      const p = opts[k];
      if (p) cells[p.y * n + p.x].push(k);
    });

    let html = '<div class="bs-grid' + (opts.labels ? ' labelled' : '') + '" style="--n:' + n + '">';
    if (opts.labels) {
      html += '<span class="lbl"></span>';
      for (let x = 0; x < n; x++) html += '<span class="lbl">' + (x + 1) + '</span>';
    }
    for (let y = 0; y < n; y++) {
      if (opts.labels) html += '<span class="lbl">' + ROWS[y] + '</span>';
      for (let x = 0; x < n; x++) {
        html += '<span class="cell ' + cells[y * n + x].join(' ') + '" data-x="' + x + '" data-y="' + y + '"></span>';
      }
    }
    return html + '</div>';
  }

  /** Little row of the fleet, struck through as ships go down. */
  function fleetHtml(fleet, sunkNames) {
    return '<div class="bs-fleet">' + fleet.map(function (f) {
      const sunk = sunkNames.indexOf(f.name) !== -1;
      let pips = '';
      for (let i = 0; i < f.len; i++) pips += '<i></i>';
      return '<span class="' + (sunk ? 'sunk' : '') + '" title="' + f.name + '">' + pips + '</span>';
    }).join('') + '</div>';
  }

  window.ArkSea = { coord: coord, gridHtml: gridHtml, fleetHtml: fleetHtml };
})();
