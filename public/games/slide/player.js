(function () {
  Ark.loadCss('/games/slide/style.css');
  const ready = Ark.loadScript('/games/slide/board.js');
  const SWIPE_PX = 24;

  let root = null;
  let board = null;
  let api = null;
  let view = null;
  let swipe = null;

  function render() {
    if (!view || !board) return;
    board.update(view);
    root.querySelector('.info').innerHTML = '⏱ ' + Ark.clock(view.elapsed) + ' · ' + view.moves + ' moves' + (view.best === null || view.best === undefined ? '' : ' · best ' + Ark.clock(view.best));
  }

  // Tap a tile in line with the gap to slide it (and those between); or swipe the way a tile should go.
  function down(e) {
    swipe = { x: e.clientX, y: e.clientY, cell: e.target.closest('[data-cell]') };
  }
  function up(e) {
    if (!swipe) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    const tile = swipe.cell;
    swipe = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) >= SWIPE_PX) {
      api.send({ type: 'move', dir: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up' });
    } else if (tile) {
      api.send({ type: 'tap', cell: Number(tile.getAttribute('data-cell')) });
    } else return;
    api.vibrate(8);
  }

  Ark.register('player', 'slide', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'slide-phone';
      root.innerHTML = '<div class="info"></div><div class="slide-frame"><div class="slide-cells"></div></div><p class="muted hint">Tap a tile next to the gap, or swipe.</p>';
      el.appendChild(root);
      const frame = root.querySelector('.slide-frame');
      frame.addEventListener('pointerdown', down);
      frame.addEventListener('pointerup', up);
      frame.addEventListener('pointercancel', function () { swipe = null; });
      ready.then(function () {
        if (!root) return;
        board = window.ArkSlide.create(root.querySelector('.slide-cells'));
        render();
      });
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = board = view = swipe = null;
    },
  });
})();
