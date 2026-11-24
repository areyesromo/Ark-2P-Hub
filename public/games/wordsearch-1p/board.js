// Word Search's grid and word list, drawn the same way on the TV and the phone.
(function () {
  // A colour per found word, so crossing words stay readable (the marker pens themselves).
  const PENS = ['#f472b6', '#60a5fa', '#4ade80', '#facc15', '#c084fc', '#fb923c', '#2dd4bf', '#f87171', '#a3e635', '#38bdf8'];

  /** The cells on the straight line from a to b (across, down or diagonal), or null. */
  function line(n, a, b) {
    const ax = a % n, ay = Math.floor(a / n), bx = b % n, by = Math.floor(b / n);
    const dx = Math.sign(bx - ax), dy = Math.sign(by - ay);
    const len = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    if (dx && dy && Math.abs(bx - ax) !== Math.abs(by - ay)) return null;
    const out = [];
    for (let k = 0; k <= len; k++) out.push((ay + dy * k) * n + ax + dx * k);
    return out;
  }

  /**
   * The grid's markup. opts.from is where a mark starts, opts.to where it's heading
   * (the line between shows as a pencil mark); opts.cursor outlines a cell (the TV's controller).
   */
  function html(v, opts) {
    opts = opts || {};
    const pen = {};
    v.found.forEach(function (f, k) {
      line(v.n, f.a, f.b).forEach(function (i) { pen[i] = PENS[k % PENS.length]; });
    });
    const marking = {};
    if (opts.from !== null && opts.from !== undefined) {
      (line(v.n, opts.from, opts.to === null || opts.to === undefined ? opts.from : opts.to) || [opts.from]).forEach(function (i) { marking[i] = true; });
    }
    let out = '<div class="ws-grid" style="--n:' + v.n + '">';
    for (let i = 0; i < v.n * v.n; i++) {
      out += '<div class="ws-cell' + (pen[i] ? ' found' : '') + (marking[i] ? ' marking' : '') + (opts.cursor === i ? ' cursor' : '') +
        '" data-cell="' + i + '"' + (pen[i] ? ' style="--pen:' + pen[i] + '"' : '') + '>' + v.grid[i] + '</div>';
    }
    return out + '</div>';
  }

  function words(v) {
    return '<ul class="ws-words">' + v.words.map(function (w) {
      return '<li class="' + (w.found ? 'found' : '') + '">' + w.word + '</li>';
    }).join('') + '</ul>';
  }

  window.ArkWordSearch = { line: line, html: html, words: words };
})();
