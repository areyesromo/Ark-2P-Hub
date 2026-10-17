// STOP IT! (server/games/minis/stop-it.js) Stop the sweeping needle in the green.
(function () {
  // Same as needleAt in server/games/minis/stop-it.js.
  function needleAt(ms, periodMs) {
    const p = (ms % periodMs) / periodMs;
    return p < 0.5 ? p * 2 : 2 - p * 2;
  }

  function gauge(el, mctx, slot) {
    el.insertAdjacentHTML('beforeend', '<div class="mi-gauge"><i class="zone"></i><i class="needle"></i></div>');
    const g = el.querySelector('.mi-gauge');
    const zone = g.querySelector('.zone');
    const needle = g.querySelector('.needle');
    let state = null;
    let raf = requestAnimationFrame(function frame() {
      raf = requestAnimationFrame(frame);
      if (!state) return;
      const stopped = state.stops[slot];
      needle.style.left = (stopped !== null ? stopped : needleAt(mctx.t(), state.periodMs)) * 100 + '%';
    });
    return {
      update: function (s) {
        state = s;
        zone.style.left = s.zone.from * 100 + '%';
        zone.style.width = (s.zone.to - s.zone.from) * 100 + '%';
        g.classList.toggle('ok', s.res[slot] === true);
        g.classList.toggle('bad', s.res[slot] === false);
      },
      stop: function () { cancelAnimationFrame(raf); },
    };
  }

  let parts = [];

  ArkMini.register('stop-it', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-split"><div class="mi-side p1"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, 0) + '</div></div><div class="mi-side p2"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, 1) + '</div></div></div>';
        parts = [0, 1].map(function (s) { return gauge(el.querySelectorAll('.mi-side')[s], mctx, s); });
      },
      update: function (s) { parts.forEach(function (p) { p.update(s); }); },
      unmount: function () { parts.forEach(function (p) { p.stop(); }); parts = []; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage"></div>';
        const stage = el.firstChild;
        parts = [gauge(stage, mctx, mctx.slot)];
        stage.insertAdjacentHTML('beforeend', '<button class="primary mi-big-btn">STOP!</button>');
        stage.querySelector('button').addEventListener('pointerdown', function () { mctx.send({ type: 'stop' }); mctx.vibrate(20); });
      },
      update: function (s) { parts.forEach(function (p) { p.update(s); }); },
      unmount: function () { parts.forEach(function (p) { p.stop(); }); parts = []; },
    },
    pad: function (btn) { return btn === 'A' || btn === 'B' || btn === 'X' || btn === 'Y' ? { type: 'stop' } : null; },
    sounds: function (prev, s) { return s.stops.some(function (x, i) { return x !== null && prev.stops[i] === null; }) ? ['lock'] : []; },
  });
})();
