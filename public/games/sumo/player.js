(function () {
  Ark.loadCss('/games/sumo/style.css');
  Ark.loadCss('/shared/move-pad.css');
  const padReady = Ark.loadScript('/shared/move-pad.js');
  const SEND_EVERY_MS = 50;

  let root = null;
  let stick = null; // where the movement pad goes
  let pad = null; // ArkMovePad: joystick, D-pad or tilt
  let dashBtn = null;
  let info = null;
  let api = null;
  let view = null;
  let lastKey = '';
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
    else if (v.phase === 'play') status = v.ring.shrinking ? '⚠ The ring is shrinking!' : 'DASH to ram them';
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
        '<div class="sm-stick"></div>' +
        '<button class="sm-dash">DASH</button>' +
        '<button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      stick = root.querySelector('.sm-stick');
      dashBtn = root.querySelector('.sm-dash');
      const mounted = root;
      padReady.then(function () {
        if (root !== mounted) return; // left the game while loading
        pad = window.ArkMovePad.create({ api: api, key: 'ark.sumo.controls', verb: 'move', onMove: queueMove });
        stick.appendChild(pad.el);
      });
      dashBtn.addEventListener('pointerdown', onDash);
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
    },
    update: render,
    unmount: function () {
      clearTimeout(sendTimer);
      if (pad) pad.destroy();
      root = stick = pad = dashBtn = info = view = pending = null;
      lastKey = '';
      bumps = 0;
    },
  });
})();
