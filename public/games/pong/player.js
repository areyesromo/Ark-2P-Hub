(function () {
  Ark.loadCss('/games/pong/style.css');
  const SEND_EVERY_MS = 33; // ~30 position updates a second while dragging

  let root = null;
  let strip = null;
  let knob = null;
  let info = null;
  let api = null;
  let lastKey = '';
  let lastSent = 0;
  let pendingY = null;
  let sendTimer = null;

  function send() {
    sendTimer = null;
    if (pendingY === null) return;
    api.send({ type: 'move', y: pendingY });
    lastSent = Date.now();
    pendingY = null;
  }

  // Follow the finger: the paddle moves towards where you touch (0 = top, 1 = bottom).
  function onPointer(e) {
    if (e.type === 'pointermove' && !(e.buttons || e.pointerType === 'touch')) return;
    e.preventDefault();
    // Keep following the finger even if it slides off the strip.
    if (e.type === 'pointerdown' && strip.setPointerCapture) strip.setPointerCapture(e.pointerId);
    const r = strip.getBoundingClientRect();
    const y = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    knob.style.top = y * 100 + '%';
    pendingY = Math.round(y * 1000) / 1000;
    const wait = SEND_EVERY_MS - (Date.now() - lastSent);
    if (wait <= 0) send();
    else if (!sendTimer) sendTimer = setTimeout(send, wait);
  }

  function render(v) {
    const you = v.you;
    const score = 'You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them · first to ' + v.winScore;
    let status = '';
    let cls = '';
    if (v.phase === 'countdown') status = 'Starting in ' + v.countdown + '…';
    else if (v.phase === 'point') status = v.lastScorer === you ? 'You scored! 🎉' : 'They scored';
    else if (v.phase === 'play') status = 'Drag to move your paddle';
    else if (v.phase === 'over') {
      cls = v.winner === you ? 'won' : 'lost';
      status = v.winner === you ? 'You win! 🏆' : 'You lose';
    }
    const key = score + status + v.phase;
    if (key === lastKey) return; // views arrive ~30x a second; only touch the DOM on change
    lastKey = key;
    info.innerHTML =
      '<div class="score">' + score + '</div>' +
      '<div class="status ' + cls + '">' + status + '</div>';
    strip.classList.toggle('hidden', v.phase === 'over');
    root.querySelector('.rematch').classList.toggle('hidden', v.phase !== 'over');
  }

  Ark.register('player', 'pong', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'pong-phone';
      root.innerHTML =
        '<div class="info"></div>' +
        '<div class="pong-strip"><div class="knob"></div><div class="hint">Drag up and down</div></div>' +
        '<button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      strip = root.querySelector('.pong-strip');
      knob = root.querySelector('.knob');
      strip.addEventListener('pointerdown', onPointer);
      strip.addEventListener('pointermove', onPointer);
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
    },
    update: render,
    unmount: function () {
      clearTimeout(sendTimer);
      root = strip = knob = info = null;
      lastKey = '';
      pendingY = null;
    },
  });
})();
