// Chess board and pieces for the TV and the phones (the pieces are drawn here, so every screen
// shows them the same). Sets window.ArkChess.
(function () {
  const BASE = 'M9 35.5h22v-3.5H9z';
  // Simple silhouettes, 40 x 40.
  const SHAPES = {
    p: BASE + 'M13 32c1-6 4-8 4-11h6c0 3 3 5 4 11z|c20,15,5.5',
    r: BASE + 'M12 32l1.5-14h13L28 32zM11 18V9h4v3h3V9h4v3h3V9h4v9z',
    n: BASE + 'M12 32c0-6 6-7.5 6-11.5-3 1.5-5 3.5-7.5 2.5-2-1-1.5-3.5 0-5.5 3-4 6-9 11-10l1-3.5 2.5 4.5c5.5 2.5 7.5 8.5 6.5 23z|c23.5,13,1.3',
    b: BASE + 'M13 32c0-5 3-6.5 3-9.5h8c0 3 3 4.5 3 9.5zM20 7c-5 4-7 8-7 11.5 0 3 3 4.5 7 4.5s7-1.5 7-4.5C27 15 25 11 20 7z|c20,5,2.2',
    q: BASE + 'M11 32L8 13l6 8 2-12 4 11 4-11 2 12 6-8-3 19z|c8,11.5,2.2|c16,7.5,2.2|c24,7.5,2.2|c32,11.5,2.2|c20,6,2.2',
    k: BASE + 'M11 32c-1-6-4.5-9-3.5-13 2-5.5 9.5-4.5 12.5 2 3-6.5 10.5-7.5 12.5-2 1 4-2.5 7-3.5 13zM18.5 4h3v4h3.5v3h-3.5v5h-3v-5H15V8h3.5z',
  };

  function svg(kind, white) {
    const parts = SHAPES[kind].split('|');
    let inner = '<path d="' + parts[0] + '"/>';
    for (let i = 1; i < parts.length; i++) {
      const [x, y, r] = parts[i].slice(1).split(',');
      inner += '<circle cx="' + x + '" cy="' + y + '" r="' + r + '"/>';
    }
    if (kind === 'b') inner += '<path class="cut" d="M21.5 12l-3 4"/>';
    return '<svg class="ch-piece ' + (white ? 'w' : 'b') + '" viewBox="0 0 40 40" aria-hidden="true">' + inner + '</svg>';
  }

  function piece(p) {
    return p ? svg(p.toLowerCase(), p === p.toUpperCase()) : '';
  }

  /**
   * v: the view. opts.flip: black at the bottom. opts.picked: a square picked. opts.targets: where it
   * can go (a Set). opts.tappable. opts.cursor: a controller's aim. opts.cursorSlot.
   */
  function boardHtml(v, opts) {
    opts = opts || {};
    const t = opts.targets || new Set();
    let html = '<div class="ch-board' + (opts.tappable ? ' tappable' : '') + '">';
    for (let row = 0; row < 8; row++) {
      for (let col = 0; col < 8; col++) {
        const rank = opts.flip ? row : 7 - row;
        const file = opts.flip ? 7 - col : col;
        const sq = rank * 8 + file;
        const p = v.board[sq];
        const cls = 'ch-sq ' + ((rank + file) % 2 ? 'light' : 'dark') +
          (v.last && (v.last.from === sq || v.last.to === sq) ? ' last' : '') +
          (v.check === sq ? ' check' : '') + (opts.picked === sq ? ' picked' : '') +
          (t.has(sq) ? (p ? ' target take' : ' target') : '') + (opts.cursor === sq ? ' aim p' + (opts.cursorSlot + 1) : '');
        const labels = (col === 0 ? '<i class="rk">' + (rank + 1) + '</i>' : '') + (row === 7 ? '<i class="fl">' + 'abcdefgh'[file] + '</i>' : '');
        html += '<span class="' + cls + '" data-sq="' + sq + '">' + labels + piece(p) + '</span>';
      }
    }
    return html + '</div>';
  }

  const ORDER = { q: 0, r: 1, b: 2, n: 3, p: 4 };
  const WORTH = { q: 9, r: 5, b: 3, n: 3, p: 1 };

  /** Pieces taken from one side, and how far ahead in material the other is. */
  function takenHtml(list) {
    return '<span class="ch-taken">' + list.slice().sort(function (a, b) { return ORDER[a.toLowerCase()] - ORDER[b.toLowerCase()]; }).map(piece).join('') + '</span>';
  }

  function material(list) {
    return list.reduce(function (n, p) { return n + WORTH[p.toLowerCase()]; }, 0);
  }

  /** A clock: m:ss, tenths under ten seconds. */
  function clockText(ms) {
    ms = Math.max(0, ms);
    if (ms < 10000) return (ms / 1000).toFixed(1);
    const s = Math.ceil(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  window.ArkChess = { boardHtml: boardHtml, piece: piece, takenHtml: takenHtml, material: material, clockText: clockText };
})();
