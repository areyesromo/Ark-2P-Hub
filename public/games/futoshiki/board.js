// Futoshiki's grid, drawn the same way on the TV and the phone: squares with the signs in the gaps
// between them (‹ › across, ∧ ∨ down: the open side faces the bigger number), given numbers in
// bold, and the pencil marks small in a square that's still empty.
(function () {
  /** The grid as HTML for a (2n − 1)-track CSS grid. opts: { digit } (the controller's picked number). */
  function html(v) {
    const n = v.n;
    const sign = {};
    v.signs.forEach(function (s) {
      const a = s[0];
      const b = s[1];
      const lo = Math.min(a, b);
      const hi = Math.max(a, b);
      // a < b. Across: '<' when the smaller is on the left; down: '∧' when it's on top.
      sign[lo + ',' + hi] = hi === lo + 1 ? (a === lo ? '<' : '>') : (a === lo ? '∧' : '∨');
    });
    const clash = {};
    v.clashes.forEach(function (c) { clash[c] = true; });
    let out = '';
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const i = r * n + c;
        let cls = 'ft-sq';
        if (v.givens[i]) cls += ' given';
        if (clash[i]) cls += ' clash';
        if (v.selected === i && v.phase === 'play') cls += ' sel';
        if (v.hint === i && v.phase === 'play') cls += ' hint';
        let inner = '';
        if (v.grid[i]) inner = '<b>' + v.grid[i] + '</b>';
        else if (v.notes[i]) {
          inner = '<span class="ft-notes" style="--cols:' + (n <= 4 ? 2 : n <= 6 ? 3 : 4) + '">';
          for (let d = 1; d <= n; d++) inner += '<i>' + (v.notes[i] & (1 << d) ? d : '') + '</i>';
          inner += '</span>';
        }
        out += '<button type="button" class="' + cls + '" data-cell="' + i + '">' + inner + '</button>';
        if (c < n - 1) out += '<span class="ft-sign">' + (sign[i + ',' + (i + 1)] || '') + '</span>';
      }
      if (r < n - 1) {
        for (let c = 0; c < n; c++) {
          const i = r * n + c;
          out += '<span class="ft-sign down">' + (sign[i + ',' + (i + n)] || '') + '</span>';
          if (c < n - 1) out += '<span></span>';
        }
      }
    }
    return out;
  }

  window.ArkFutoshiki = { html: html };
})();
