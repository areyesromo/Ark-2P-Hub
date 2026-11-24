// The Sliding Puzzle's board, drawn the same way on the TV and the phone: tiles
// keep their element as they move, so they slide to their new place.
(function () {
  /** A board in `el` for an n×n puzzle; update(tiles) moves the tiles. Each tile carries data-cell (where it is). */
  function create(el) {
    const tiles = {}; // number -> element
    let n = 0;
    el.classList.add('slide-board');
    return {
      update: function (v) {
        if (v.n !== n) {
          n = v.n;
          el.innerHTML = '';
          Object.keys(tiles).forEach(function (k) { delete tiles[k]; });
          el.style.setProperty('--n', n);
        }
        v.tiles.forEach(function (t, i) {
          if (!t) return;
          let e = tiles[t];
          if (!e) {
            e = tiles[t] = document.createElement('button');
            e.type = 'button';
            e.className = 'tile';
            e.innerHTML = '<span>' + t + '</span>';
            el.appendChild(e);
          }
          e.style.left = ((i % n) * 100) / n + '%';
          e.style.top = (Math.floor(i / n) * 100) / n + '%';
          e.setAttribute('data-cell', i);
          // In its right place: shown done.
          e.classList.toggle('home', t === i + 1);
        });
      },
    };
  }

  window.ArkSlide = { create: create };
})();
