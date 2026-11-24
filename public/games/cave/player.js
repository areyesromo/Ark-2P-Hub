(function () {
  Ark.loadCss('/games/cave/style.css');

  let root = null;
  let btn = null;
  let api = null;
  let lastKey = '';
  let phase = '';

  function set(on) {
    return function (e) {
      e.preventDefault();
      if (on) try { btn.setPointerCapture(e.pointerId); } catch (err) { /* fine */ }
      btn.classList.toggle('on', on);
      api.send({ type: 'hold', on: on });
      if (on) api.vibrate(8);
    };
  }

  function render(v) {
    if (v.phase === 'over' && phase === 'play') api.vibrate(200); // crashed
    phase = v.phase;
    const key = [v.phase, v.score, v.best, v.map, v.vehicle].join('|');
    if (key === lastKey) return;
    lastKey = key;
    root.querySelector('.info').innerHTML = '<strong>' + v.score + ' m</strong>' + (v.best === null || v.best === undefined ? '' : ' · best ' + v.best + ' m') +
      '<div class="where">' + Ark.escapeHtml(v.vehicle + ' · ' + v.map) + '</div>';
    btn.querySelector('.sub').textContent = v.phase === 'ready' ? 'Hold to take off' : 'Hold to climb, let go to drop';
    btn.classList.toggle('off', v.phase === 'paused');
    root.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
    root.querySelector('.pause').disabled = v.phase !== 'play' && v.phase !== 'paused';
  }

  Ark.register('player', 'cave', {
    // A run that earned a map or a vehicle says so.
    overHtml: function (v) {
      const got = (v.record && v.record.unlocked) || [];
      return got.filter(function (a) { return v.unlocks && v.unlocks[a.id]; }).map(function (a) { return '<strong>' + Ark.escapeHtml(v.unlocks[a.id]) + '</strong>'; }).join(' · ');
    },
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'cave-phone';
      root.innerHTML = '<div class="info"></div><button class="cave-hold"><span class="big">⬆ CLIMB</span><span class="sub"></span></button><button class="ghost pause">⏸ Pause</button>';
      el.appendChild(root);
      btn = root.querySelector('.cave-hold');
      btn.addEventListener('pointerdown', set(true));
      btn.addEventListener('pointerup', set(false));
      btn.addEventListener('pointercancel', set(false));
      btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      root.querySelector('.pause').addEventListener('click', function () { api.send({ type: 'pause' }); });
    },
    update: render,
    unmount: function () {
      root = btn = null;
      lastKey = phase = '';
    },
  });
})();
