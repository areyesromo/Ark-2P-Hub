// Light Cycles on the phone (server/games/tron.js): the whole arena, small, above the steering
// pad (tap a side or swipe to turn), so you can play without watching the TV.
(function () {
  Ark.loadCss('/games/tron/style.css');
  Ark.loadCss('/shared/steer-pad.css');
  const padReady = Ark.loadScript('/shared/steer-pad.js');

  let root = null;
  let pad = null; // ArkSteerPad
  let info = null;
  let api = null;
  let view = null;
  let lastKey = '';
  let arena = null;
  let colors = null;

  /** The trails as on the TV, simpler: each a line in its player's colour, your head ringed. */
  function drawArena(v) {
    if (!arena || !v.grid) return;
    const grid = v.grid;
    const css = Math.floor(arena.parentElement.getBoundingClientRect().width);
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(css * dpr);
    if (arena.width !== W) {
      arena.width = W;
      arena.height = Math.round((W * grid.h) / grid.w);
      arena.style.width = css + 'px';
    }
    const g = arena.getContext('2d');
    const k = arena.width / grid.w;
    g.setTransform(k, 0, 0, k, 0, 0);
    g.fillStyle = '#070914';
    g.fillRect(0, 0, grid.w, grid.h);
    g.lineCap = g.lineJoin = 'round';
    v.cycles.forEach(function (c, slot) {
      const pts = c.path;
      g.strokeStyle = colors[slot];
      g.globalAlpha = c.crashed ? 0.45 : 1;
      g.lineWidth = 0.7;
      g.beginPath();
      pts.forEach(function (p, i) { if (i) g.lineTo(p[0] + 0.5, p[1] + 0.5); else g.moveTo(p[0] + 0.5, p[1] + 0.5); });
      g.stroke();
      g.globalAlpha = 1;
      const h = pts[pts.length - 1];
      if (slot === v.you && h) {
        g.strokeStyle = '#ffffff';
        g.lineWidth = 0.3;
        g.beginPath();
        g.arc(h[0] + 0.5, h[1] + 0.5, 1.3, 0, Math.PI * 2);
        g.stroke();
      }
    });
  }

  function turn(dir) {
    if (!view || (view.phase !== 'play' && view.phase !== 'countdown')) return;
    api.send({ type: 'turn', dir: dir });
    api.vibrate(15);
    pad.show(dir);
  }

  function render(v) {
    view = v;
    drawArena(v);
    if (!pad) return;
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
    if (v.phase === 'play' || v.phase === 'countdown') pad.show(v.dir);
    pad.el.classList.toggle('hidden', v.phase === 'over');
    root.querySelector('.rematch').classList.toggle('hidden', v.phase !== 'over');
  }

  Ark.register('player', 'tron', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'tron-phone';
      root.innerHTML = '<div class="info"></div><div class="tron-arena"><canvas></canvas></div><button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      arena = root.querySelector('.tron-arena canvas');
      const css = getComputedStyle(document.documentElement);
      colors = [css.getPropertyValue('--p1').trim() || '#22d3ee', css.getPropertyValue('--p2').trim() || '#f472b6'];
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
      const mounted = root;
      padReady.then(function () {
        if (root !== mounted) return; // unmounted while loading
        pad = window.ArkSteerPad.create(turn);
        root.insertBefore(pad.el, root.querySelector('.rematch'));
        if (view) render(view);
      });
    },
    update: render,
    unmount: function () {
      root = pad = info = view = arena = null;
      lastKey = '';
    },
  });
})();
