// Phone steering pad for grid games (Light Cycles, Snake Battle): tap a side
// of the pad (relative to its centre) to turn that way, instantly on
// touch-down, or swipe. Each swipe segment longer than SWIPE_PX turns again,
// so turns can be chained in one gesture.
(function () {
  const SWIPE_PX = 28;

  function dirOf(dx, dy) {
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  }

  /**
   * create(onTurn, hint) -> { el, show(dir) }
   *   onTurn(dir)  called with 'up' | 'down' | 'left' | 'right'
   *   show(dir)    highlight the arrow for the current direction
   */
  function create(onTurn, hint) {
    const el = document.createElement('div');
    el.className = 'steer-pad';
    el.innerHTML =
      '<span class="arrow up">▲</span><span class="arrow down">▼</span>' +
      '<span class="arrow left">◀</span><span class="arrow right">▶</span>' +
      '<div class="hint"></div>';
    el.querySelector('.hint').textContent = hint || 'Tap a side or swipe';
    let swipe = null;

    function show(dir) {
      el.querySelectorAll('.arrow').forEach(function (a) { a.classList.toggle('on', a.classList.contains(dir)); });
    }

    el.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      if (el.setPointerCapture) el.setPointerCapture(e.pointerId);
      const r = el.getBoundingClientRect();
      onTurn(dirOf(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2)));
      swipe = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointermove', function (e) {
      if (!swipe) return;
      const dx = e.clientX - swipe.x;
      const dy = e.clientY - swipe.y;
      if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
      onTurn(dirOf(dx, dy));
      swipe = { x: e.clientX, y: e.clientY };
    });
    el.addEventListener('pointerup', function () { swipe = null; });
    el.addEventListener('pointercancel', function () { swipe = null; });

    return { el: el, show: show };
  }

  window.ArkSteerPad = { create: create };
})();
