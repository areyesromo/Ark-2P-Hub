// Word Hunt's grid and word list, the same on the TV and the phones.
(function () {
  /** The cells on the straight line from a to b (across, down or diagonal), or null (as on the server). */
  function line(n, a, b) {
    const ax = a % n, ay = Math.floor(a / n), bx = b % n, by = Math.floor(b / n);
    const dx = Math.sign(bx - ax), dy = Math.sign(by - ay);
    if (dx && dy && Math.abs(bx - ax) !== Math.abs(by - ay)) return null;
    const len = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    const out = [];
    for (let k = 0; k <= len; k++) out.push((ay + dy * k) * n + ax + dx * k);
    return out;
  }

  /**
   * The grid's markup. Found words are in their finder's colour; marks is a list of
   * { slot, from, to, cursor } being drawn right now (a finger on a phone, or a controller's
   * cursor on the TV). At the end of a grid, the words nobody found are outlined.
   */
  function html(v, marks) {
    const owner = {};
    v.found.forEach(function (f) { line(v.n, f.a, f.b).forEach(function (i) { owner[i] = f.slot; }); });
    const missed = {};
    if (v.result && v.phase !== 'play') v.result.missed.forEach(function (m) { line(v.n, m.a, m.b).forEach(function (i) { missed[i] = true; }); });
    const marking = {};
    const cursor = {};
    (marks || []).forEach(function (m) {
      if (m.cursor !== null && m.cursor !== undefined) cursor[m.cursor] = m.slot;
      if (m.from === null || m.from === undefined) return;
      (line(v.n, m.from, m.to === null || m.to === undefined ? m.from : m.to) || [m.from]).forEach(function (i) { marking[i] = m.slot; });
    });
    let out = '<div class="wh-grid" style="--n:' + v.n + '">';
    for (let i = 0; i < v.n * v.n; i++) {
      let cls = 'wh-cell';
      if (owner[i] !== undefined) cls += ' found p' + (owner[i] + 1);
      if (missed[i]) cls += ' missed';
      if (marking[i] !== undefined) cls += ' marking m' + (marking[i] + 1);
      if (cursor[i] !== undefined) cls += ' cursor c' + (cursor[i] + 1);
      out += '<div class="' + cls + '" data-cell="' + i + '">' + v.grid[i] + '</div>';
    }
    return out + '</div>';
  }

  function words(v) {
    return '<ul class="wh-words">' + v.words.map(function (w) {
      return '<li class="' + (w.by === null ? '' : 'found p' + (w.by + 1) + '-text') + '">' + w.word + '</li>';
    }).join('') + '</ul>';
  }

  window.ArkHunt = { line: line, html: html, words: words };
})();
