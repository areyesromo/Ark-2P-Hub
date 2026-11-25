// Tango's board, drawn the same way on the TV and the phone: a square per cell, the given ones
// shaded, the = and × signs on the lines between squares, and the pieces in the look picked
// (suns and moons, cats and dogs, or white and black stones).
(function () {
  const SUN =
    '<svg viewBox="0 0 40 40" aria-label="sun"><g stroke="#f59e0b" stroke-width="3" stroke-linecap="round">' +
    '<path d="M20 3v5M20 32v5M3 20h5M32 20h5M8 8l3.5 3.5M28.5 28.5L32 32M8 32l3.5-3.5M28.5 11.5L32 8"/></g>' +
    '<circle cx="20" cy="20" r="9" fill="#fbbf24" stroke="#f59e0b" stroke-width="1.5"/></svg>';
  const MOON =
    '<svg viewBox="0 0 40 40" aria-label="moon"><path d="M26 6a15 15 0 1 0 8 25A12 12 0 0 1 26 6z" fill="#6d8fd8" stroke="#3f5fae" stroke-width="1.5"/>' +
    '<circle cx="15" cy="21" r="1.6" fill="#3f5fae"/><circle cx="20" cy="28" r="1.1" fill="#3f5fae"/></svg>';
  const WHITE = '<svg viewBox="0 0 40 40" aria-label="white"><defs><radialGradient id="tgw" cx="35%" cy="30%"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#c9ced6"/></radialGradient></defs><circle cx="20" cy="20" r="14" fill="url(#tgw)" stroke="#8b93a1" stroke-width="1.5"/></svg>';
  const BLACK = '<svg viewBox="0 0 40 40" aria-label="black"><defs><radialGradient id="tgb" cx="35%" cy="30%"><stop offset="0" stop-color="#6b7280"/><stop offset="1" stop-color="#111318"/></radialGradient></defs><circle cx="20" cy="20" r="14" fill="url(#tgb)"/></svg>';

  /** The two pieces for a look: [sun-like, moon-like] as HTML, and their names. */
  function art(look) {
    if (look === 'pets') return { a: '<span class="tg-emoji">🐱</span>', b: '<span class="tg-emoji">🐶</span>', names: ['cats', 'dogs'] };
    if (look === 'stones') return { a: WHITE, b: BLACK, names: ['white', 'black'] };
    return { a: SUN, b: MOON, names: ['suns', 'moons'] };
  }

  /** The board as HTML (squares, then the signs over them). opts: { cursor }. */
  function html(v, opts) {
    const n = v.n;
    const a = art(v.look);
    const clash = {};
    (v.clashes || []).forEach(function (c) { clash[c] = true; });
    let out = '';
    for (let i = 0; i < n * n; i++) {
      let cls = 'tg-sq';
      if (v.givens[i]) cls += ' given';
      if (clash[i]) cls += ' clash';
      if (v.hint === i && v.phase === 'play') cls += ' hint';
      if (opts && opts.cursor === i) cls += ' cursor';
      const m = v.marks[i];
      out += '<button type="button" class="' + cls + '" data-i="' + i + '">' + (m === 1 ? a.a : m === 2 ? a.b : '') + '</button>';
    }
    (v.signs || []).forEach(function (s) {
      const lo = Math.min(s[0], s[1]);
      const across = Math.abs(s[1] - s[0]) === 1;
      const x = lo % n;
      const y = Math.floor(lo / n);
      const left = across ? (x + 1) / n : (x + 0.5) / n;
      const top = across ? (y + 0.5) / n : (y + 1) / n;
      out += '<span class="tg-sign" style="left:' + left * 100 + '%;top:' + top * 100 + '%">' + (s[2] === '=' ? '=' : '×') + '</span>';
    });
    return out;
  }

  /** A par time (seconds) as m:ss. */
  function par(sec) {
    return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  }

  function rules(look) {
    const k = art(look).names;
    return 'No three alike in a line · as many ' + k[0] + ' as ' + k[1] + ' in every row and column · = the same, × different';
  }

  window.ArkTango = { html: html, art: art, par: par, rules: rules };
})();
