// Pipes' board, drawn the same way on the TV and the phone. The grid is built once per board and
// then only updated, so a piece spins round when it's turned (its CSS rotation is the server's
// count of quarter turns) and the water colour runs along as pipes join.
(function () {
  const ARM = { 1: 'M20 20V-1', 2: 'M20 20H41', 4: 'M20 20V41', 8: 'M20 20H-1' };

  function pieceSvg(mask, isTap) {
    let d = '';
    let arms = 0;
    for (const bit of [1, 2, 4, 8]) if (mask & bit) { d += ARM[bit]; arms++; }
    let svg = '<svg viewBox="0 0 40 40"><path class="pp-pipe" d="' + d + '"/>';
    if (isTap) svg += '<circle class="pp-tap" cx="20" cy="20" r="10"/><path class="pp-tap-x" d="M15 20h10M20 15v10"/>';
    else if (arms === 1) svg += '<circle class="pp-end" cx="20" cy="20" r="8"/>';
    else if (mask !== 5 && mask !== 10) svg += '<circle class="pp-joint" cx="20" cy="20" r="5.2"/>'; // (a straight needs no joint)
    return svg + '</svg>';
  }

  /** Builds the grid into `el` if the board changed, then brings every square up to date. opts: { cursor }. */
  function draw(el, v, opts) {
    const n = v.n;
    const key = n + ':' + v.tap + ':' + v.base.join('');
    if (el.getAttribute('data-key') !== key) {
      el.setAttribute('data-key', key);
      el.style.setProperty('--n', n);
      let out = '';
      for (let i = 0; i < n * n; i++) {
        out += '<button type="button" class="pp-sq" data-i="' + i + '"><span class="pp-spin">' + pieceSvg(v.base[i], i === v.tap) + '</span></button>';
      }
      el.innerHTML = out;
    }
    el.classList.toggle('wrap', v.wrap);
    el.classList.toggle('won', v.won);
    const wet = {};
    v.wet.forEach(function (c) { wet[c] = true; });
    const squares = el.children;
    for (let i = 0; i < squares.length; i++) {
      const sq = squares[i];
      sq.classList.toggle('wet', !!wet[i]);
      sq.classList.toggle('locked', !!v.locked[i]);
      sq.classList.toggle('hint', v.hint === i && v.phase === 'play');
      sq.classList.toggle('cursor', !!opts && opts.cursor === i);
      sq.firstChild.style.transform = 'rotate(' + v.rots[i] * 90 + 'deg)';
    }
  }

  window.ArkPipes = { draw: draw };
})();
