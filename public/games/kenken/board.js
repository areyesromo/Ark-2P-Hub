// KenKen's grid, drawn the same way on the TV and the phone: heavy lines round
// each cage, its target and sign in its first square.
(function () {
  function html(v) {
    const n = v.n;
    const cageOf = [];
    v.cages.forEach(function (c, k) { c.cells.forEach(function (i) { cageOf[i] = k; }); });
    const label = {};
    v.cages.forEach(function (c) { label[c.cells[0]] = c.target + (c.op === '' ? '' : c.op); });
    const bad = {};
    v.clashes.forEach(function (i) { bad[i] = true; });
    let out = '<div class="kk-grid" style="--n:' + n + '">';
    for (let i = 0; i < n * n; i++) {
      const r = Math.floor(i / n);
      const c = i % n;
      // A heavy edge wherever the next square is in another cage.
      let cls = 'kk-cell';
      if (r === 0 || cageOf[i - n] !== cageOf[i]) cls += ' t';
      if (c === 0 || cageOf[i - 1] !== cageOf[i]) cls += ' l';
      if (r === n - 1 || cageOf[i + n] !== cageOf[i]) cls += ' b';
      if (c === n - 1 || cageOf[i + 1] !== cageOf[i]) cls += ' r';
      if (v.selected === i && v.phase === 'play') cls += ' sel';
      if (bad[i]) cls += ' bad';
      out += '<div class="' + cls + '" data-cell="' + i + '">' + (label[i] !== undefined ? '<span class="lbl">' + label[i] + '</span>' : '') +
        '<span class="val">' + (v.grid[i] || '') + '</span></div>';
    }
    return out + '</div>';
  }

  window.ArkKenKen = { html: html };
})();
