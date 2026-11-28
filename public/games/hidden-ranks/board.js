// Hidden Ranks board for the TV and the phones: an 8 x 8 grid of squares, two lakes, and the
// pieces: your own show their rank, the other's are blank until a fight shows them. Sets
// window.ArkRanks.
(function () {
  const LABEL = { 10: '10', 9: '9', 7: '7', 6: '6', 5: '5', 4: '4', 3: '3', 2: '2', 1: '1', B: '💣', F: '🚩' };
  const NOTE = { 3: 'miner', 2: 'scout', 1: 'spy' };

  function pieceHtml(p) {
    if (!p) return '';
    const known = p.rank !== null && p.rank !== undefined;
    return '<b class="hr-piece p' + (p.s + 1) + (known ? '' : ' unseen') + (p.shown ? ' shown' : '') + '">' +
      (known ? LABEL[p.rank] + (NOTE[p.rank] ? '<small>' + NOTE[p.rank] + '</small>' : '') : '') + '</b>';
  }

  /**
   * v: the view. opts.flip: turned round (player 2's army at the bottom). opts.picked: a square
   * picked; opts.targets: squares it can go to (tappable); opts.tap: own pieces tappable (slot opts.me).
   */
  function boardHtml(v, opts) {
    opts = opts || {};
    const n = v.n;
    const targets = {};
    (opts.targets || []).forEach(function (c) { targets[c] = true; });
    const last = v.lastMove && !v.lastMove.missed ? v.lastMove : null;
    let html = '<div class="hr-board" style="--n:' + n + '">';
    for (let k = 0; k < n * n; k++) {
      const c = opts.flip ? n * n - 1 - k : k;
      const p = v.board ? v.board[c] : null;
      const lake = v.lakes.includes(c);
      const tap = targets[c] || (opts.tap && p && p.s === opts.me);
      const cls = 'hr-sq' + (lake ? ' lake' : '') + (targets[c] ? ' target' : '') + (opts.picked === c ? ' picked' : '') + (last && (last.from === c || last.to === c) ? ' last' : '');
      html += '<span class="' + cls + '"' + (tap ? ' data-c="' + c + '"' : '') + '>' + pieceHtml(p) + '</span>';
    }
    return html + '</div>';
  }

  /** "9 attacks 7: the 9 wins", from a fight. */
  function fightText(f) {
    const name = function (r) { return r === 'B' ? 'a bomb' : r === 'F' ? 'the flag' : 'the ' + r + (NOTE[r] ? ' (' + NOTE[r] + ')' : ''); };
    const res = f.result === 'a' ? (f.d === 'F' ? 'the flag is taken!' : name(f.a) + ' wins') : f.result === 'd' ? name(f.d) + ' wins' : 'both go';
    return name(f.a).replace(/^the /, 'The ') + ' attacks ' + name(f.d) + ': ' + res;
  }

  window.ArkRanks = { boardHtml: boardHtml, pieceHtml: pieceHtml, fightText: fightText, LABEL: LABEL, NOTE: NOTE };
})();
