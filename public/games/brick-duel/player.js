// Brick Breaker Duel on the phone (server/games/brick-duel.js): drag along the strip to move
// your paddle (the paddle follows your finger at its top speed, as in Pong).
(function () {
  Ark.loadCss('/games/brick-duel/style.css');
  const SEND_EVERY_MS = 33;

  let root = null;
  let strip = null;
  let knob = null;
  let info = null;
  let api = null;
  let lastKey = '';
  let lastSent = 0;
  let pendingX = null;
  let sendTimer = null;
  let powerN = undefined;
  let dragging = false;

  function send() {
    sendTimer = null;
    if (pendingX === null || !api) return;
    api.send({ type: 'move', x: pendingX });
    lastSent = Date.now();
    pendingX = null;
  }

  function onPointer(e) {
    if (e.type === 'pointermove' && !(e.buttons || e.pointerType === 'touch')) return;
    e.preventDefault();
    if (e.type === 'pointerdown') {
      dragging = true;
      if (strip.setPointerCapture) strip.setPointerCapture(e.pointerId);
    }
    const r = strip.getBoundingClientRect();
    const x = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    knob.style.left = x * 100 + '%';
    pendingX = Math.round(x * 1000) / 1000;
    const wait = SEND_EVERY_MS - (Date.now() - lastSent);
    if (wait <= 0) send();
    else if (!sendTimer) sendTimer = setTimeout(send, wait);
  }

  function render(v) {
    const you = v.you;
    // The knob shows where your paddle really is (after a rematch, a reconnect) unless you're dragging it.
    if (!dragging) knob.style.left = v.paddle * 100 + '%';
    // A buzz when your rival's power brick hits you (not on the first view after joining).
    const n = v.power ? v.power.n : null;
    if (powerN !== undefined && n !== null && n !== powerN && v.power.by !== you && v.power.kind !== 'multi') api.vibrate(150);
    powerN = n;
    const clock = v.suddenDeath ? 'Sudden death!' : v.timeLeft === null ? '' : Math.floor(v.timeLeft / 60) + ':' + String(v.timeLeft % 60).padStart(2, '0');
    const score = '🧱 You ' + v.broken[you] + ' – ' + v.broken[1 - you] + ' Them · ' + v.left[you] + ' left · ' + clock;
    let status = '';
    let cls = '';
    if (v.phase === 'countdown') status = 'Starting in ' + v.countdown + '…';
    else if (v.phase === 'play') status = v.shrunk ? '🔻 Your paddle is shrunk!' : 'Drag to move your paddle';
    else if (v.phase === 'over') {
      cls = v.winner === you ? 'won' : v.winner === null ? '' : 'lost';
      status = v.winner === null ? 'A draw' : v.winner === you ? 'You win! 🏆' : 'You lose';
    }
    const key = score + status + v.phase;
    if (key === lastKey) return;
    lastKey = key;
    info.innerHTML = '<div class="score">' + score + '</div><div class="status ' + cls + '">' + status + '</div>';
    strip.classList.toggle('hidden', v.phase === 'over');
    root.querySelector('.rematch').classList.toggle('hidden', v.phase !== 'over');
  }

  Ark.register('player', 'brick-duel', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'bd-phone';
      root.innerHTML =
        '<div class="info"></div>' +
        '<div class="bd-strip"><div class="knob"></div><div class="hint">Drag left and right</div></div>' +
        '<button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      strip = root.querySelector('.bd-strip');
      knob = root.querySelector('.knob');
      strip.addEventListener('pointerdown', onPointer);
      strip.addEventListener('pointermove', onPointer);
      ['pointerup', 'pointercancel'].forEach(function (ev) { strip.addEventListener(ev, function () { dragging = false; }); });
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
    },
    update: render,
    unmount: function () {
      clearTimeout(sendTimer);
      root = strip = knob = info = api = null;
      lastKey = '';
      pendingX = null;
      powerN = undefined;
      dragging = false;
    },
  });
})();
