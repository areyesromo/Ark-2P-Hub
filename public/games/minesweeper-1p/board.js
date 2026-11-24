// Minesweeper's board, drawn the same way on the TV and the phone.
// The view's board is one character per cell: '#' covered, 'F' flag,
// '0'-'8' open, and at the end '*' mine, 'X' the one that went off, 'W' a wrong flag.
(function () {
  const FACE = { '#': '', F: '🚩', '*': '💣', X: '💥', W: '❌', 0: '' };

  /**
   * The board's markup. opts.transpose draws it turned (columns as rows), for a
   * wide board on an upright phone; opts.cursor outlines a cell (the TV's controller cursor).
   * Each cell carries data-cell, its index on the server's board.
   */
  function html(v, opts) {
    opts = opts || {};
    const cols = opts.transpose ? v.h : v.w;
    const rows = opts.transpose ? v.w : v.h;
    let out = '<div class="mines-grid" style="--cols:' + cols + ';--rows:' + rows + '">';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = opts.transpose ? r : c;
        const y = opts.transpose ? c : r;
        const i = y * v.w + x;
        const ch = v.board[i];
        const open = ch >= '0' && ch <= '8';
        out += '<button type="button" class="cell' + (open ? ' open n' + ch : ch === '#' ? '' : ' mark m' + ch) + (opts.cursor === i ? ' cursor' : '') +
          '" data-cell="' + i + '">' + (open ? (ch === '0' ? '' : ch) : FACE[ch]) + '</button>';
      }
    }
    return out + '</div>';
  }

  window.ArkMines = { html: html };
})();
