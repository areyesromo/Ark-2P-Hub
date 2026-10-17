(function () {
  Ark.loadCss('/games/sumo/style.css');
  const STICK_PX = 60; // drag this far from where you touched for full speed
  const SEND_EVERY_MS = 50;

  let root = null;
  let stick = null;
  let base = null;
  let knob = null;
  let dashBtn = null;
  let info = null;
  let api = null;
  let view = null;
  let lastKey = '';
  let origin = null; // where the joystick touch started
  let pending = null;
  let lastSent = 0;
  let sendTimer = null;
  let bumps = 0;

  function send() {
    sendTimer = null;
    if (!pending) return;
    api.send({ type: 'move', x: pending.x, y: pending.y });
    lastSent = Date.now();
    pending = null;
  }

  function queueMove(x, y, now) {
    pending = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
    const wait = SEND_EVERY_MS - (Date.now() - lastSent);
    if (now || wait <= 0) {
      clearTimeout(sendTimer);
      send();
    } else if (!sendTimer) {
      sendTimer = setTimeout(send, wait);
    }
  }

  // Floating joystick: the base appears where you touch; drag away from it to move.
  function onDown(e) {
    e.preventDefault();
    if (stick.setPointerCapture) stick.setPointerCapture(e.pointerId);
    const r = stick.getBoundingClientRect();
    origin = { x: e.clientX, y: e.clientY };
    base.style.left = knob.style.left = e.clientX - r.left + 'px';
    base.style.top = knob.style.top = e.clientY - r.top + 'px';
  }

  function onMove(e) {
    if (!origin) return;
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - origin.x;
    let dy = e.clientY - origin.y;
    const d = Math.hypot(dx, dy);
    if (d > STICK_PX) {
      dx *= STICK_PX / d;
      dy *= STICK_PX / d;
    }
    knob.style.left = origin.x - r.left + dx + 'px';
    knob.style.top = origin.y - r.top + dy + 'px';
    queueMove(dx / STICK_PX, dy / STICK_PX);
  }

  function onUp() {
    if (!origin) return;
    origin = null;
    base.style.left = knob.style.left = '50%';
    base.style.top = knob.style.top = '50%';
    queueMove(0, 0, true);
  }

  function onDash(e) {
    e.preventDefault();
    send(); // the newest direction first, so the dash goes where you're pointing
    api.send({ type: 'dash' });
    api.vibrate(25);
  }

  function render(v) {
    view = v;
    const you = v.you;
    if (v.bumps > bumps && v.phase === 'play') api.vibrate(v.lastBump > 0.45 ? 70 : 25);
    bumps = v.bumps;
    const me = v.discs[you];
    const ready = me.dashIn <= 0;
    dashBtn.classList.toggle('cooling', !ready);
    dashBtn.style.setProperty('--fill', String(Math.round(100 * (1 - me.dashIn / v.dashCooldownMs))));
    let status = '';
    let cls = '';
    const r = v.result;
    if (v.phase === 'countdown') status = 'Round ' + v.round + ' starts in ' + v.countdown + '…';
    else if (v.phase === 'play') status = v.ring.shrinking ? '⚠ The ring is shrinking!' : 'Drag to move · DASH to ram';
    else if (v.phase === 'roundEnd' && r) {
      if (r.draw) status = r.reason === 'time' ? "Time's up: draw" : 'Both fell: draw';
      else status = r.winner === you ? 'Pushed them out! Round to you 🎉' : 'You fell off 😵';
    } else if (v.phase === 'over') {
      cls = v.winner === you ? 'won' : 'lost';
      status = v.winner === you ? 'You win! 🏆' : 'You lose';
    }
    const key = v.scores.join(':') + status + v.phase;
    if (key === lastKey) return; // views arrive ~30x a second; only touch the DOM on change
    lastKey = key;
    info.innerHTML =
      '<div class="score">You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them · first to ' + v.winScore + '</div>' +
      '<div class="status ' + cls + '">' + status + '</div>';
    const over = v.phase === 'over';
    stick.classList.toggle('hidden', over);
    dashBtn.classList.toggle('hidden', over);
    root.querySelector('.rematch').classList.toggle('hidden', !over);
  }

  Ark.register('player', 'sumo', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'sm-phone';
      root.innerHTML =
        '<div class="info"></div>' +
        '<div class="sm-stick"><div class="base"></div><div class="knob"></div><div class="hint">Touch and drag to move</div></div>' +
        '<button class="sm-dash">DASH</button>' +
        '<button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      stick = root.querySelector('.sm-stick');
      base = root.querySelector('.base');
      knob = root.querySelector('.knob');
      dashBtn = root.querySelector('.sm-dash');
      stick.addEventListener('pointerdown', onDown);
      stick.addEventListener('pointermove', onMove);
      stick.addEventListener('pointerup', onUp);
      stick.addEventListener('pointercancel', onUp);
      dashBtn.addEventListener('pointerdown', onDash);
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
    },
    update: render,
    unmount: function () {
      clearTimeout(sendTimer);
      root = stick = base = knob = dashBtn = info = view = origin = pending = null;
      lastKey = '';
      bumps = 0;
    },
  });
})();
