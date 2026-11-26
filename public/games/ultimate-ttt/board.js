// Ultimate Tic-tac-toe board for the TV and the phones: nine little boards in a 3 x 3. Player 1's
// mark is ✕ and player 2's ◯, in their colours. Sets window.ArkUttt.
(function () {
  const MARK = ['', '✕', '◯'];

  /** May the player to move take `cell` now? */
  function legal(v, cell) {
    const b = Math.floor(cell / 9);
    return v.phase === 'play' && !v.cells[cell] && !v.boards[b] && (v.next < 0 || v.next === b);
  }

  /** Board and square from a spot on the 9 x 9 grid (for a controller's cursor), and back. */
  const fromXY = (x, y) => (Math.floor(y / 3) * 3 + Math.floor(x / 3)) * 9 + (y % 3) * 3 + (x % 3);
  const toXY = (cell) => {
    const b = Math.floor(cell / 9);
    const i = cell % 9;
    return [(b % 3) * 3 + (i % 3), Math.floor(b / 3) * 3 + Math.floor(i / 3)];
  };

  /**
   * v: the view. opts.tappable: the legal squares can be tapped. opts.aim / opts.aimSlot: a square
   * picked (shown see-through). opts.cursor / opts.cursorSlot: a controller's aim.
   */
  function boardHtml(v, opts) {
    opts = opts || {};
    const line = {};
    (v.line || []).forEach(function (b) { line[b] = true; });
    const last = v.lastMove ? v.lastMove.cell : -1;
    let html = '<div class="ut-big' + (v.phase === 'play' ? ' turn-p' + (v.turn + 1) : '') + '">';
    for (let b = 0; b < 9; b++) {
      const won = v.boards[b];
      const open = v.phase === 'play' && !won && (v.next < 0 || v.next === b);
      html += '<div class="ut-small' + (open ? ' open' : '') + (won ? ' done' : '') + (line[b] ? ' line' : '') + '">';
      for (let i = 0; i < 9; i++) {
        const c = b * 9 + i;
        const who = v.cells[c];
        const ok = opts.tappable && legal(v, c);
        let mark = who ? MARK[who] : '';
        let cls = 'ut-cell' + (who ? ' p' + who : '') + (c === last ? ' last' : '');
        if (!who && opts.aim === c) { mark = MARK[opts.aimSlot + 1]; cls += ' p' + (opts.aimSlot + 1) + ' ghost'; }
        if (opts.cursor === c) cls += ' aim c' + (opts.cursorSlot + 1);
        html += '<span class="' + cls + '"' + (ok ? ' data-c="' + c + '"' : '') + '>' + mark + '</span>';
      }
      if (won === 1 || won === 2) html += '<b class="ut-won p' + won + '">' + MARK[won] + '</b>';
      html += '</div>';
    }
    return html + '</div>';
  }

  window.ArkUttt = { boardHtml: boardHtml, legal: legal, fromXY: fromXY, toXY: toXY };
})();
