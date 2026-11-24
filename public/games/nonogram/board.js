// The Nonograms board (TV and phone): the clues along the top and the left,
// the squares, and every fifth line drawn thicker to help count.
(function () {
  /**
   * A board in el. update(v) draws it; each square carries data-cell.
   * The size of a square is worked out from the room el has, so the
   * whole puzzle (clues too) always fits.
   */
  function create(el) {
    let key = '';
    let cells = [];
    let rowClues = [];
    let colClues = [];
    let grid = null;

    function build(v) {
      const n = v.n;
      let html = '<div class="nn-grid" style="--n:' + n + '"><div class="nn-corner"></div>';
      for (let c = 0; c < n; c++) {
        html += '<div class="nn-clue col' + (c % 5 === 4 && c < n - 1 ? ' b5' : '') + '">' + (v.cols[c].length ? v.cols[c] : [0]).map(function (x) { return '<i>' + x + '</i>'; }).join('') + '</div>';
      }
      for (let r = 0; r < n; r++) {
        html += '<div class="nn-clue row' + (r % 5 === 4 && r < n - 1 ? ' b5' : '') + '">' + (v.rows[r].length ? v.rows[r] : [0]).map(function (x) { return '<i>' + x + '</i>'; }).join('') + '</div>';
        for (let c = 0; c < n; c++) html += '<button type="button" class="nn-cell" data-cell="' + (r * n + c) + '"></button>';
      }
      el.innerHTML = html + '</div>';
      grid = el.firstChild;
      cells = Array.prototype.slice.call(grid.querySelectorAll('.nn-cell'));
      rowClues = Array.prototype.slice.call(grid.querySelectorAll('.nn-clue.row'));
      colClues = Array.prototype.slice.call(grid.querySelectorAll('.nn-clue.col'));
      const longRow = Math.max.apply(null, v.rows.map(function (x) { return Math.max(1, x.length); }));
      const longCol = Math.max.apply(null, v.cols.map(function (x) { return Math.max(1, x.length); }));
      grid.style.setProperty('--rc', longRow);
      grid.style.setProperty('--cc', longCol);
    }

    /** Squares as big as fit: n squares plus the clues, across and down. */
    function fit(v) {
      const rc = Number(grid.style.getPropertyValue('--rc'));
      const cc = Number(grid.style.getPropertyValue('--cc'));
      const w = el.clientWidth / (v.n + rc * 0.62 + 0.4);
      const h = el.clientHeight / (v.n + cc * 0.72 + 0.4);
      grid.style.setProperty('--cell', Math.max(10, Math.floor(Math.min(w, h || w, 64))) + 'px');
    }

    function update(v) {
      const k = JSON.stringify([v.rows, v.cols]);
      if (k !== key) {
        key = k;
        build(v);
      }
      fit(v);
      const n = v.n;
      const sr = Math.floor(v.selected / n);
      const sc = v.selected % n;
      const paused = v.phase === 'paused';
      grid.classList.toggle('paused', paused);
      grid.classList.toggle('over', v.phase === 'over');
      for (let i = 0; i < cells.length; i++) {
        const r = Math.floor(i / n);
        const c = i % n;
        let cls = 'nn-cell';
        if (v.cells[i] === 1) cls += ' f';
        else if (v.cells[i] === 2) cls += ' x';
        if (c % 5 === 4 && c < n - 1) cls += ' b5r';
        if (r % 5 === 4 && r < n - 1) cls += ' b5b';
        if (v.phase === 'play') {
          if (i === v.selected) cls += ' sel';
          else if (r === sr || c === sc) cls += ' hl';
        }
        if (cells[i].className !== cls) cells[i].className = cls;
      }
      rowClues.forEach(function (e, r) { e.classList.toggle('done', Boolean(v.rowsDone[r])); e.classList.toggle('hl', v.phase === 'play' && r === sr); });
      colClues.forEach(function (e, c) { e.classList.toggle('done', Boolean(v.colsDone[c])); e.classList.toggle('hl', v.phase === 'play' && c === sc); });
    }

    /** The square under a point on screen (for dragging across squares), or null. */
    function cellAt(x, y) {
      const e = document.elementFromPoint(x, y);
      const cell = e && e.closest && e.closest('.nn-cell');
      return cell && el.contains(cell) ? Number(cell.getAttribute('data-cell')) : null;
    }

    return { update: update, cellAt: cellAt };
  }

  window.ArkNono = { create: create };
})();
