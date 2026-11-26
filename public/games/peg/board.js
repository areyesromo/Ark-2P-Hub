// Peg Solitaire's board, drawn the same way on the TV and the phone: a wooden board with a hole for
// each square, glossy pegs, the picked peg lifted, the holes it can jump to ringed, and a hint's
// jump marked (from and to).
(function () {
  /** The board as HTML (a 7 × 7 grid). opts: { picked, cursor }. */
  function html(v, opts) {
    const has = {};
    v.holes.forEach(function (i) { has[i] = true; });
    const picked = opts && opts.picked !== null && opts.picked !== undefined ? opts.picked : null;
    const targets = {};
    const movable = {};
    v.jumps.forEach(function (j) {
      movable[j[0]] = true;
      if (j[0] === picked) targets[j[1]] = true;
    });
    let out = '';
    for (let i = 0; i < 49; i++) {
      if (!has[i]) { out += '<span class="pg-none"></span>'; continue; }
      let cls = 'pg-hole';
      if (v.pegs[i]) cls += ' peg';
      if (i === v.centre) cls += ' centre';
      if (picked === i) cls += ' picked';
      if (targets[i]) cls += ' target';
      if (movable[i] && picked === null && v.phase === 'play') cls += ' can';
      if (v.hint && (v.hint[0] === i || v.hint[2] === i)) cls += v.hint[0] === i ? ' hint-from' : ' hint-to';
      if (v.last && v.last[2] === i) cls += ' landed';
      if (opts && opts.cursor === i) cls += ' cursor';
      out += '<button type="button" class="' + cls + '" data-i="' + i + '"><i></i></button>';
    }
    return out;
  }

  window.ArkPeg = { html: html };
})();
