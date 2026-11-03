// Snake Battle on the phone (server/games/snake.js): the whole arena, small, above the steering
// pad (tap a side or swipe to turn), so you can play without watching the TV.
(function () {
  Ark.loadCss('/games/snake/style.css');
  Ark.loadCss('/shared/steer-pad.css');
  const padReady = Ark.loadScript('/shared/steer-pad.js');

  let root = null;
  let pad = null; // ArkSteerPad
  let info = null;
  let api = null;
  let view = null;
  let lastKey = '';
  let prevLen = 0; // your length on the last view, to buzz when you grow
  let arena = null;
  let colors = null;

  /** The board as on the TV, simpler: the food, both snakes (heads brighter), yours ringed. */
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
    g.fillStyle = '#fb923c';
    v.food.forEach(function (f) {
      g.beginPath();
      g.arc(f[0] + 0.5, f[1] + 0.5, 0.35, 0, Math.PI * 2);
      g.fill();
    });
    v.snakes.forEach(function (s, slot) {
      g.fillStyle = colors[slot];
      s.body.forEach(function (c, i) {
        g.globalAlpha = i === 0 ? 1 : s.crashed ? 0.35 : 0.7;
        g.fillRect(c[0] + 0.08, c[1] + 0.08, 0.84, 0.84);
      });
      g.globalAlpha = 1;
      if (slot === v.you && s.body[0]) {
        g.strokeStyle = '#ffffff';
        g.lineWidth = 0.15;
        g.strokeRect(s.body[0][0] - 0.1, s.body[0][1] - 0.1, 1.2, 1.2);
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
    const mins = Math.floor(v.timeLeft / 60) + ':' + String(v.timeLeft % 60).padStart(2, '0');
    const lengths = 'Your length <strong>' + v.lengths[you] + '</strong> · theirs ' + v.lengths[1 - you] + ' · ⏱ ' + mins;
    let status = '';
    let cls = '';
    const r = v.result;
    if (v.phase === 'countdown') status = 'Round ' + v.round + ' starts in ' + v.countdown + '…';
    else if (v.phase === 'play') status = 'Tap a side or swipe to turn';
    else if (v.phase === 'roundEnd' && r) {
      if (r.draw) status = r.reason === 'time' ? 'Time! Same length. Draw!' : 'Both crashed. Draw!';
      else if (r.reason === 'time') status = r.roundWinner === you ? 'Time! You were longer 🎉' : 'Time! They were longer';
      else status = r.roundWinner === you ? 'They crashed! Round to you 🎉' : 'You crashed 💥';
    } else if (v.phase === 'over') {
      cls = v.winner === you ? 'won' : 'lost';
      status = v.winner === you ? 'You win! 🏆' : 'You lose';
    }
    if (v.phase === 'play' && prevLen && v.lengths[you] > prevLen) api.vibrate(25);
    prevLen = v.lengths[you];
    const key = score + lengths + status + v.phase + v.dir;
    if (key === lastKey) return; // views arrive every tick; only touch the DOM on change
    lastKey = key;
    info.innerHTML =
      '<div class="score">' + score + '</div>' +
      '<div class="lengths">' + lengths + '</div>' +
      '<div class="status ' + cls + '">' + status + '</div>';
    if (v.phase === 'play' || v.phase === 'countdown') pad.show(v.dir);
    pad.el.classList.toggle('hidden', v.phase === 'over');
    root.querySelector('.rematch').classList.toggle('hidden', v.phase !== 'over');
  }

  Ark.register('player', 'snake', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'snake-phone';
      root.innerHTML = '<div class="info"></div><div class="snake-arena"><canvas></canvas></div><button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      arena = root.querySelector('.snake-arena canvas');
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
      prevLen = 0;
    },
  });
})();
