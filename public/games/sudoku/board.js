// Sudoku's grid, drawn the same way on the TV and the phone.
(function () {
  /**
   * The grid's markup. Each cell carries data-cell. The picked cell, the cells it
   * shares a row, column or box with, and the same number elsewhere are shaded,
   * so it's easy to see what's taken.
   */
  function html(v) {
    const sel = v.selected;
    const selN = v.grid[sel];
    const row = Math.floor(sel / 9);
    const col = sel % 9;
    const box = Math.floor(row / 3) * 3 + Math.floor(col / 3);
    const clash = {};
    v.clashes.forEach(function (i) { clash[i] = true; });
    let out = '<div class="sdk-grid">';
    for (let i = 0; i < 81; i++) {
      const r = Math.floor(i / 9);
      const c = i % 9;
      const b = Math.floor(r / 3) * 3 + Math.floor(c / 3);
      const n = v.grid[i];
      let cls = 'cell';
      if (v.given[i]) cls += ' given';
      if (i === sel) cls += ' sel';
      else if (r === row || c === col || b === box) cls += ' near';
      if (n && n === selN && i !== sel) cls += ' same';
      if (clash[i]) cls += ' clash';
      if (c === 2 || c === 5) cls += ' edge-r';
      if (r === 2 || r === 5) cls += ' edge-b';
      let inner = '';
      if (n) inner = String(n);
      else if (v.notes[i]) {
        inner = '<span class="notes">';
        for (let k = 1; k <= 9; k++) inner += '<i>' + (v.notes[i] & (1 << k) ? k : '') + '</i>';
        inner += '</span>';
      }
      out += '<button type="button" class="' + cls + '" data-cell="' + i + '">' + inner + '</button>';
    }
    return out + '</div>';
  }

  window.ArkSudoku = { html: html };
})();
