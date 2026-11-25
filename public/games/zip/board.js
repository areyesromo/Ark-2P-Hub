// Zip's board, drawn the same way on the TV and the phone: the squares, the walls, the path as one
// thick line through the squares' middles, and the numbers on top (the ones reached take the
// path's colour). Squares are counted row by row from the top left.
(function () {

  /** The board as HTML: a grid of squares under an SVG of walls, path and numbers. opts: { cursor }. */
  function html(v, opts) {
    const n = v.n;
    const on = {};
    v.path.forEach(function (c, i) { on[c] = i + 1; });
    let cells = '';
    for (let i = 0; i < n * n; i++) {
      let cls = 'zp-sq';
      if (on[i]) cls += ' on';
      if (v.hint === i && v.phase === 'play') cls += ' hint';
      cells += '<div class="' + cls + '" data-i="' + i + '"></div>';
    }
    const cx = function (c) { return (c % n) + 0.5; };
    const cy = function (c) { return Math.floor(c / n) + 0.5; };
    let svg = '<svg class="zp-art" viewBox="0 0 ' + n + ' ' + n + '" preserveAspectRatio="none">';
    // Walls: a thick line on the side between the two squares.
    (v.walls || []).forEach(function (w) {
      const a = Math.min(w[0], w[1]);
      const b = Math.max(w[0], w[1]);
      const x = a % n;
      const y = Math.floor(a / n);
      if (b === a + 1) svg += '<line class="zp-wall" x1="' + (x + 1) + '" y1="' + y + '" x2="' + (x + 1) + '" y2="' + (y + 1) + '"/>';
      else svg += '<line class="zp-wall" x1="' + x + '" y1="' + (y + 1) + '" x2="' + (x + 1) + '" y2="' + (y + 1) + '"/>';
    });
    if (v.path.length > 1) svg += '<polyline class="zp-path" points="' + v.path.map(function (c) { return cx(c) + ',' + cy(c); }).join(' ') + '"/>';
    const head = v.path[v.path.length - 1];
    if (head !== undefined) svg += '<circle class="zp-head" cx="' + cx(head) + '" cy="' + cy(head) + '" r="0.27"/>';
    if (opts && opts.cursor && head !== undefined) svg += '<circle class="zp-cursor" cx="' + cx(head) + '" cy="' + cy(head) + '" r="0.42"/>';
    svg += '</svg>';
    let nums = '';
    (v.numbers || []).forEach(function (p) {
      const c = p[0];
      nums += '<span class="zp-num' + (on[c] ? ' reached' : '') + (p[1] === v.next && v.phase === 'play' ? ' next' : '') +
        '" style="left:' + (cx(c) / n) * 100 + '%;top:' + (cy(c) / n) * 100 + '%">' + p[1] + '</span>';
    });
    return cells + svg + nums;
  }

  /** A par time (seconds) as m:ss. */
  function par(sec) {
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }

  const RULES = 'Start on 1 · meet the numbers in order · end on the last · fill every square';

  window.ArkZip = { html: html, par: par, RULES: RULES };
})();
