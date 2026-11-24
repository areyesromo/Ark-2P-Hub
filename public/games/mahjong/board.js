// Mahjong Solitaire's pile, drawn the same way on the TV and the phone. Tiles
// sit in layers (each one up and to the left of the one below, so the pile
// looks raised); free tiles are bright, the rest a little dimmer.
(function () {
  const X0 = -2; // the layout's left edge, in half tiles
  const COLS = 10; // tiles across (with the wings)
  const ROWS = 5;

  /** A pile in el. update(v, marks) draws it; marks: { selected, hint: [a, b], cursor }. */
  function create(el) {
    let built = 0;
    let tiles = [];

    function build(v) {
      el.innerHTML = '<div class="mj-pile">' + v.tiles.map(function (t, i) {
        return '<button type="button" class="mj-tile" data-tile="' + i + '" style="--x:' + (t.x - X0) / 2 + ';--y:' + t.y / 2 + ';--z:' + t.z + ';z-index:' + (t.z * 1000 + t.y * 20 + t.x + 10) + '"><span></span></button>';
      }).join('') + '</div>';
      tiles = Array.prototype.slice.call(el.querySelectorAll('.mj-tile'));
      built = v.tiles.length;
    }

    /** Tiles as big as fit, the raised layers included. */
    function fit() {
      const pile = el.firstChild;
      const tw = Math.min(el.clientWidth / (COLS + 0.5), el.clientHeight / (ROWS * 1.3 + 0.6));
      pile.style.setProperty('--tw', Math.max(16, Math.floor(tw)) + 'px');
    }

    function update(v, marks) {
      marks = marks || {};
      if (built !== v.tiles.length) build(v);
      fit();
      const hint = marks.hint || [];
      v.tiles.forEach(function (t, i) {
        const e = tiles[i];
        const cls = 'mj-tile' + (t.here ? '' : ' gone') + (t.free ? ' free' : '') + (marks.selected === i ? ' sel' : '') +
          (hint.indexOf(i) !== -1 ? ' hint' : '') + (marks.cursor === i ? ' cursor' : '');
        if (e.className !== cls) e.className = cls;
        const face = t.here ? t.face : '';
        if (e.firstChild.textContent !== face) e.firstChild.textContent = face;
      });
    }

    return { update: update };
  }

  /** From tile i, the nearest tile still there in a direction (for a controller), or i. */
  function step(v, i, dir) {
    const dx = { LEFT: -1, RIGHT: 1, UP: 0, DOWN: 0 }[dir];
    const dy = { LEFT: 0, RIGHT: 0, UP: -1, DOWN: 1 }[dir];
    const from = v.tiles[i];
    let best = i;
    let bestScore = Infinity;
    v.tiles.forEach(function (t, j) {
      if (j === i || !t.here) return;
      const ax = t.x - from.x;
      const ay = t.y - from.y;
      const along = ax * dx + ay * dy;
      if (along <= 0) return;
      const across = Math.abs(ax * dy) + Math.abs(ay * dx);
      const score = along + across * 2.5 - (t.free ? 0.5 : 0) - t.z * 0.1;
      if (score < bestScore) {
        bestScore = score;
        best = j;
      }
    });
    return best;
  }

  window.ArkMahjong = { create: create, step: step };
})();
