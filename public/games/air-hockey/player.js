(function () {
  Ark.loadCss('/games/air-hockey/style.css');
  const SEND_EVERY_MS = 33; // ~30 position updates a second while dragging

  let root = null;
  let pad = null;
  let knob = null;
  let info = null;
  let api = null;
  let lastKey = '';
  let lastSent = 0;
  let pending = null;
  let sendTimer = null;

  function send() {
    sendTimer = null;
    if (!pending) return;
    api.send({ type: 'move', u: pending.u, v: pending.v });
    lastSent = Date.now();
    pending = null;
  }

  // The pad is your half of the table: your mallet follows your finger.
  function onPointer(e) {
    if (e.type === 'pointermove' && !(e.buttons || e.pointerType === 'touch')) return;
    e.preventDefault();
    if (e.type === 'pointerdown' && pad.setPointerCapture) pad.setPointerCapture(e.pointerId);
    const r = pad.getBoundingClientRect();
    const u = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    const v = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
    knob.style.left = u * 100 + '%';
    knob.style.top = v * 100 + '%';
    pending = { u: Math.round(u * 1000) / 1000, v: Math.round(v * 1000) / 1000 };
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
    else if (v.phase === 'goal') status = v.lastScorer === you ? 'GOAL! 🎉' : 'They scored';
    else if (v.phase === 'play') status = 'Slide to move your mallet';
    else if (v.phase === 'over') {
      cls = v.winner === you ? 'won' : 'lost';
      status = v.winner === you ? 'You win! 🏆' : 'You lose';
    }
    const key = score + status + v.phase;
    if (key === lastKey) return; // views arrive ~30x a second; only touch the DOM on change
    if (v.phase === 'goal' && v.lastScorer === you && lastKey.indexOf('GOAL') === -1) api.vibrate([60, 40, 60]);
    lastKey = key;
    info.innerHTML = '<div class="score">' + score + '</div><div class="status ' + cls + '">' + status + '</div>';
    pad.classList.toggle('hidden', v.phase === 'over');
    root.querySelector('.rematch').classList.toggle('hidden', v.phase !== 'over');
  }

  Ark.register('player', 'air-hockey', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'ah-phone';
      root.innerHTML =
        '<div class="info"></div>' +
        '<div class="ah-pad">' +
        '<div class="label top">Centre line</div><div class="label bottom">Your goal</div>' +
        '<div class="goal"></div><div class="knob"></div></div>' +
        '<button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      pad = root.querySelector('.ah-pad');
      knob = root.querySelector('.knob');
      pad.addEventListener('pointerdown', onPointer);
      pad.addEventListener('pointermove', onPointer);
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
    },
    update: render,
    unmount: function () {
      clearTimeout(sendTimer);
      root = pad = knob = info = null;
      lastKey = '';
      pending = null;
    },
  });
})();
