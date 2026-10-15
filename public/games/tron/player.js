(function () {
  Ark.loadCss('/games/tron/style.css');
  const SWIPE_PX = 28;

  let root = null;
  let pad = null;
  let info = null;
  let api = null;
  let view = null;
  let lastKey = '';
  let swipe = null; // { x, y } where the current swipe started

  function turn(dir) {
    if (!view || (view.phase !== 'play' && view.phase !== 'countdown')) return;
    api.send({ type: 'turn', dir: dir });
    api.vibrate(15);
    showDir(dir);
  }

  function showDir(dir) {
    pad.querySelectorAll('.arrow').forEach(function (a) { a.classList.toggle('on', a.classList.contains(dir)); });
  }

  // Tap a side of the pad (relative to its centre) to turn that way, instantly on touch-down...
  function onDown(e) {
    e.preventDefault();
    if (pad.setPointerCapture) pad.setPointerCapture(e.pointerId);
    const r = pad.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2);
    const dy = e.clientY - (r.top + r.height / 2);
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    swipe = { x: e.clientX, y: e.clientY };
  }

  // ...or swipe. Each swipe segment longer than SWIPE_PX turns again, so you can chain turns.
  function onMove(e) {
    if (!swipe) return;
    const dx = e.clientX - swipe.x;
    const dy = e.clientY - swipe.y;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
    turn(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
    swipe = { x: e.clientX, y: e.clientY };
  }

  function onUp() {
    swipe = null;
  }

  function render(v) {
    view = v;
    const you = v.you;
    const score = 'You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them · first to ' + v.winScore;
    let status = '';
    let cls = '';
    if (v.phase === 'countdown') status = 'Round ' + v.round + ' starts in ' + v.countdown + '…';
    else if (v.phase === 'play') status = 'Tap a side or swipe to turn';
    else if (v.phase === 'crash' && v.result) {
      if (v.result.draw) status = 'Both crashed. Draw!';
      else status = v.result.roundWinner === you ? 'They crashed! Round to you 🎉' : 'You crashed 💥';
    } else if (v.phase === 'over') {
      cls = v.winner === you ? 'won' : 'lost';
      status = v.winner === you ? 'You win! 🏆' : 'You lose';
    }
    const key = score + status + v.phase + v.dir;
    if (key === lastKey) return; // views arrive every tick; only touch the DOM on change
    lastKey = key;
    info.innerHTML = '<div class="score">' + score + '</div><div class="status ' + cls + '">' + status + '</div>';
    if (v.phase === 'play' || v.phase === 'countdown') showDir(v.dir);
    pad.classList.toggle('hidden', v.phase === 'over');
    root.querySelector('.rematch').classList.toggle('hidden', v.phase !== 'over');
  }

  Ark.register('player', 'tron', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'tron-phone';
      root.innerHTML =
        '<div class="info"></div>' +
        '<div class="tron-pad">' +
        '<span class="arrow up">▲</span><span class="arrow down">▼</span>' +
        '<span class="arrow left">◀</span><span class="arrow right">▶</span>' +
        '<div class="hint">Tap a side or swipe</div></div>' +
        '<button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      pad = root.querySelector('.tron-pad');
      pad.addEventListener('pointerdown', onDown);
      pad.addEventListener('pointermove', onMove);
      pad.addEventListener('pointerup', onUp);
      pad.addEventListener('pointercancel', onUp);
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
    },
    update: render,
    unmount: function () {
      root = pad = info = view = swipe = null;
      lastKey = '';
    },
  });
})();
