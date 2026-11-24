(function () {
  Ark.loadCss('/games/bubbles/style.css');
  const COLOURS = ['#ef4444', '#3b82f6', '#22c55e', '#facc15', '#a855f7', '#f97316'];

  let root = null;
  let pad = null;
  let api = null;
  let view = null;
  let aim = 0;
  let aiming = false;
  let sentAt = 0;
  let key = '';

  // The angle from the bottom middle of the pad to the finger, clamped to the launcher's range.
  function angleAt(e) {
    const box = pad.getBoundingClientRect();
    const dx = e.clientX - (box.left + box.width / 2);
    const dy = Math.max(10, box.bottom - e.clientY);
    const max = view ? view.maxAngle : 78;
    return Math.max(-max, Math.min(max, (Math.atan2(dx, dy) * 180) / Math.PI));
  }

  function drawAim() {
    pad.querySelector('.needle').style.transform = 'rotate(' + aim + 'deg)';
  }

  function render() {
    const v = view;
    if (!root || !v) return;
    const k = [v.phase, v.current, v.next, v.score, v.missesLeft, v.best].join('|');
    if (k === key) return;
    key = k;
    root.querySelector('.info').innerHTML = '<strong>' + Ark.formatScore(v.score, 'pts') + '</strong>' + (v.best === null || v.best === undefined ? '' : ' · best ' + Ark.formatScore(v.best, 'pts')) +
      '<div class="small">⬇ ceiling in ' + v.missesLeft + ' miss' + (v.missesLeft === 1 ? '' : 'es') + '</div>';
    pad.querySelector('.now').style.background = COLOURS[v.current];
    root.querySelector('.next').style.background = COLOURS[v.next];
  }

  function down(e) {
    if (!view || view.phase !== 'play') return;
    e.preventDefault();
    pad.setPointerCapture(e.pointerId);
    aiming = true;
    move(e);
  }
  function move(e) {
    if (!aiming) return;
    aim = Math.round(angleAt(e) * 10) / 10;
    drawAim();
    // Let the TV show the aim, a few times a second.
    const now = Date.now();
    if (now - sentAt > 80) {
      sentAt = now;
      api.send({ type: 'aim', angle: aim });
    }
  }
  function up() {
    if (!aiming) return;
    aiming = false;
    api.send({ type: 'shoot', angle: aim });
    api.vibrate(15);
  }

  Ark.register('player', 'bubbles', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'bubbles-phone';
      root.innerHTML = '<div class="info"></div><div class="bubbles-pad"><div class="needle"></div><div class="now"></div><span class="hint">Drag to aim · let go to fire</span></div>' +
        '<div class="next-row">Next <span class="next"></span></div>';
      el.appendChild(root);
      pad = root.querySelector('.bubbles-pad');
      pad.addEventListener('pointerdown', down);
      pad.addEventListener('pointermove', move);
      pad.addEventListener('pointerup', up);
      pad.addEventListener('pointercancel', function () { aiming = false; });
      pad.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    },
    update: function (v) {
      view = v;
      if (!aiming) {
        aim = v.aim;
        drawAim();
      }
      render();
    },
    unmount: function () {
      root = pad = view = null;
      key = '';
      aiming = false;
    },
  });
})();
