(function () {
  Ark.loadCss('/games/slide/style.css');
  const ready = Ark.loadScript('/games/slide/board.js');
  const DIRS = { UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right' };

  let root = null;
  let board = null;
  let stats = null;
  let view = null;

  function render() {
    if (!view || !board) return;
    board.update(view);
    stats.innerHTML = '<span>⏱ <strong>' + Ark.clock(view.elapsed) + '</strong></span><span><strong>' + view.moves + '</strong> moves</span>' +
      (view.started ? '' : '<span class="muted">The clock starts with your first slide</span>');
  }

  Ark.register('host', 'slide', {
    sounds: function (prev, v) {
      return v.moves > prev.moves ? ['slide'] : [];
    },
    padHint: 'D-pad, stick or arrows slide a tile into the gap',
    pad: function (btn) {
      return DIRS[btn] ? { type: 'move', dir: DIRS[btn] } : null;
    },
    overHtml: function (v) {
      return v.n + '×' + v.n + ' in ' + v.moves + ' moves';
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'slide-host';
      root.innerHTML = '<div class="slide-stats"></div><div class="slide-wrap"><div class="slide-frame"><div class="slide-cells"></div></div></div>';
      el.appendChild(root);
      stats = root.querySelector('.slide-stats');
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
      root = board = stats = view = null;
    },
  });
})();
