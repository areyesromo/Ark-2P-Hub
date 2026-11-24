(function () {
  Ark.loadCss('/games/hopper/style.css');

  let root = null;
  let api = null;
  let key = '';
  let deaths = 0;
  let start = null; // where a swipe began

  function hop(dir) {
    api.send({ type: 'hop', dir: dir });
    api.vibrate(8);
  }

  function render(v) {
    if (v.death && v.death.n !== deaths) {
      deaths = v.death.n;
      api.vibrate(150);
    }
    const k = [v.phase, v.score, v.lives, v.level, v.best].join('|');
    if (k === key) return;
    key = k;
    root.querySelector('.info').innerHTML = '<strong>' + Ark.formatScore(v.score, 'pts') + '</strong> · ' + '🐸'.repeat(Math.max(0, v.lives)) +
      (v.best === null || v.best === undefined ? '' : ' · best ' + Ark.formatScore(v.best, 'pts'));
    root.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
    root.querySelector('.pause').disabled = v.phase !== 'play' && v.phase !== 'paused';
    root.querySelector('.hopper-pad').classList.toggle('off', v.phase !== 'play');
  }

  Ark.register('player', 'hopper', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'hopper-phone';
      root.innerHTML = '<div class="info"></div><div class="hopper-pad">' +
        '<button class="up" data-dir="up">▲</button><button class="left" data-dir="left">◀</button><button class="right" data-dir="right">▶</button><button class="down" data-dir="down">▼</button>' +
        '<span class="hint">Tap an arrow, or swipe anywhere here</span></div><button class="ghost pause">⏸ Pause</button>';
      el.appendChild(root);
      const pad = root.querySelector('.hopper-pad');
      // A tap on an arrow hops at once; a swipe elsewhere hops the way it went.
      pad.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        const b = e.target.closest('[data-dir]');
        if (b) return hop(b.getAttribute('data-dir'));
        start = { x: e.clientX, y: e.clientY };
      });
      pad.addEventListener('pointerup', function (e) {
        if (!start) return;
        const dx = e.clientX - start.x;
        const dy = e.clientY - start.y;
        start = null;
        if (Math.max(Math.abs(dx), Math.abs(dy)) < 20) return hop('up'); // a tap on the pad hops forward
        hop(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
      });
      pad.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      root.querySelector('.pause').addEventListener('click', function () { api.send({ type: 'pause' }); });
    },
    update: render,
    unmount: function () {
      root = null;
      key = '';
      deaths = 0;
    },
  });
})();
