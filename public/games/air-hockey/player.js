(function () {
  Ark.loadCss('/games/air-hockey/style.css');
  const tableReady = Ark.loadScript('/games/air-hockey/table.js');
  const SEND_EVERY_MS = 33; // ~30 position updates a second while dragging

  let root = null;
  let field = null;
  let canvas = null;
  let info = null;
  let api = null;
  let view = null;
  let viewAt = 0;
  let shown = null;
  let colors = null;
  let raf = null;
  let finger = null; // where the finger is, in table units (drawn as a faint ring)
  let lastKey = '';
  let lastSent = 0;
  let pending = null;
  let sendTimer = null;

  /**
   * The phone shows the whole table upright, turned so your goal is at the
   * bottom and your rival's at the top. Returns the canvas transform
   * (table units -> canvas pixels) for a given scale k.
   */
  function tableToCanvas(slot, f, R, k) {
    // slot 0 (goal on the left of the TV): phone-up = +x, phone-right = +y
    if (slot === 0) return [0, -k, k, 0, R * k, (f.w + R) * k];
    // slot 1 (goal on the right of the TV): phone-up = -x, phone-right = -y
    return [0, k, -k, 0, (f.h + R) * k, R * k];
  }

  /** Inverse of tableToCanvas for a point in CSS pixels on the canvas. */
  function canvasToTable(slot, f, R, kc, px, py) {
    if (slot === 0) return { x: f.w + R - py / kc, y: px / kc - R };
    return { x: py / kc - R, y: f.h + R - px / kc };
  }

  function send() {
    sendTimer = null;
    if (!pending) return;
    api.send({ type: 'move', x: pending.x, y: pending.y });
    lastSent = Date.now();
    pending = null;
  }

  function onPointer(e) {
    if (e.type === 'pointermove' && !(e.buttons || e.pointerType === 'touch')) return;
    if (!view || !window.ArkAirHockeyTable) return;
    e.preventDefault();
    if (e.type === 'pointerdown' && canvas.setPointerCapture) canvas.setPointerCapture(e.pointerId);
    const f = view.field;
    const R = window.ArkAirHockeyTable.RINK;
    const r = canvas.getBoundingClientRect();
    const kc = r.width / (f.h + 2 * R);
    const t = canvasToTable(view.you, f, R, kc, e.clientX - r.left, e.clientY - r.top);
    finger = t;
    pending = { x: Math.round(t.x * 100) / 100, y: Math.round(t.y * 100) / 100 };
    const wait = SEND_EVERY_MS - (Date.now() - lastSent);
    if (wait <= 0) send();
    else if (!sendTimer) sendTimer = setTimeout(send, wait);
  }

  function draw() {
    raf = requestAnimationFrame(draw);
    const T = window.ArkAirHockeyTable;
    if (!view || !T || !colors) return;
    const f = view.field;
    const totalW = f.h + 2 * T.RINK; // upright: the table's height runs across the phone
    const totalH = f.w + 2 * T.RINK;
    const box = field.getBoundingClientRect();
    const scale = Math.min(box.width / totalW, box.height / totalH);
    const dpr = window.devicePixelRatio || 1;
    const w = Math.floor(totalW * scale);
    const h = Math.floor(totalH * scale);
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
    }
    const g = canvas.getContext('2d');
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, canvas.width, canvas.height);
    const m = tableToCanvas(view.you, f, T.RINK, canvas.width / totalW);
    g.setTransform(m[0], m[1], m[2], m[3], m[4], m[5]);

    T.drawTable(g, f, colors);
    if (finger && view.phase !== 'over') {
      g.strokeStyle = colors[view.you];
      g.globalAlpha = 0.35;
      g.lineWidth = 0.08;
      g.beginPath();
      g.arc(finger.x, finger.y, f.malletR, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
    shown = T.easeMallets(shown, view);
    shown.forEach(function (mm, slot) { T.drawMallet(g, f, mm.x, mm.y, colors[slot]); });
    const p = T.puckNow(view, performance.now() - viewAt);
    T.drawPuck(g, f, p.x, p.y);
  }

  function renderInfo(v) {
    const you = v.you;
    const score = 'You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them · first to ' + v.winScore;
    let status = '';
    let cls = '';
    if (v.phase === 'countdown') status = 'Starting in ' + v.countdown + '…';
    else if (v.phase === 'goal') status = v.lastScorer === you ? 'GOAL! 🎉' : 'They scored';
    else if (v.phase === 'play') status = 'Your goal is at the bottom. Slide to move.';
    else if (v.phase === 'over') {
      cls = v.winner === you ? 'won' : 'lost';
      status = v.winner === you ? 'You win! 🏆' : 'You lose';
    }
    const key = score + status + v.phase;
    if (key === lastKey) return; // views arrive ~30x a second; only touch the DOM on change
    if (v.phase === 'goal' && v.lastScorer === you && lastKey.indexOf('GOAL') === -1) api.vibrate([60, 40, 60]);
    lastKey = key;
    info.innerHTML = '<div class="score">' + score + '</div><div class="status ' + cls + '">' + status + '</div>';
    root.querySelector('.rematch').classList.toggle('hidden', v.phase !== 'over');
  }

  Ark.register('player', 'air-hockey', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'ah-phone';
      root.innerHTML =
        '<div class="info"></div>' +
        '<div class="ah-field"><canvas></canvas></div>' +
        '<button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      field = root.querySelector('.ah-field');
      canvas = root.querySelector('canvas');
      canvas.addEventListener('pointerdown', onPointer);
      canvas.addEventListener('pointermove', onPointer);
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
      tableReady.then(function () { colors = window.ArkAirHockeyTable.playerColors(); });
      raf = requestAnimationFrame(draw);
    },
    update: function (v) {
      view = v;
      viewAt = performance.now();
      renderInfo(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      clearTimeout(sendTimer);
      root = field = canvas = info = view = shown = finger = null;
      lastKey = '';
      pending = null;
    },
  });
})();
