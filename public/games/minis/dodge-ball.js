// DODGE BALL! (server/games/minis/dodge-ball.js) Balls fly at you along three lanes: step up or
// down out of their way.
(function () {
  function court(el, mctx, slot) {
    el.insertAdjacentHTML('beforeend', '<div class="mi-dodge">' + '<i class="lane"></i>'.repeat(3) + '<span class="me">🧍</span></div>');
    const box = el.querySelector('.mi-dodge');
    const me = box.querySelector('.me');
    const markEl = document.createElement('div');
    el.appendChild(markEl);
    let state = null;
    let balls = [];
    let ballsKey = '';
    let raf = requestAnimationFrame(function frame() {
      raf = requestAnimationFrame(frame);
      if (!state) return;
      const t = mctx.t();
      // Each ball from the right edge to the player on the left, over its flight.
      state.balls.forEach(function (b, i) {
        const p = (t - b.at) / state.flightMs;
        balls[i].style.display = p >= 0 && p <= 1.15 ? '' : 'none';
        balls[i].style.left = (92 - p * 84) + '%';
      });
    });
    return {
      update: function (s) {
        const key = JSON.stringify(s.balls);
        if (key !== ballsKey) {
          ballsKey = key;
          balls.forEach(function (b) { b.remove(); });
          balls = s.balls.map(function (b) {
            const e = document.createElement('span');
            e.className = 'ball';
            e.textContent = '🔴';
            e.style.top = (b.lane * 33.3 + 16.6) + '%';
            box.appendChild(e);
            return e;
          });
        }
        state = s;
        me.style.top = (s.lanes[slot] * 33.3 + 16.6) + '%';
        box.classList.toggle('out', s.res[slot] === false);
        markEl.innerHTML = ArkMini.mark(s.res[slot]);
      },
      stop: function () { cancelAnimationFrame(raf); },
    };
  }

  let parts = [];

  ArkMini.register('dodge-ball', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-split">' + [0, 1].map(function (s) {
          return '<div class="mi-side p' + (s + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, s) + '</div></div>';
        }).join('') + '</div>';
        parts = [0, 1].map(function (s) { return court(el.querySelectorAll('.mi-side')[s], mctx, s); });
      },
      update: function (s) { parts.forEach(function (p) { p.update(s); }); },
      unmount: function () { parts.forEach(function (p) { p.stop(); }); parts = []; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage"></div>';
        const stage = el.firstChild;
        parts = [court(stage, mctx, mctx.slot)];
        stage.insertAdjacentHTML('beforeend', '<div class="mi-updown"><button class="primary" data-dir="up">▲</button><button class="primary" data-dir="down">▼</button></div>');
        stage.querySelectorAll('[data-dir]').forEach(function (b) {
          b.addEventListener('pointerdown', function () { mctx.send({ type: 'move', dir: b.getAttribute('data-dir') }); mctx.vibrate(10); });
        });
        // A swipe up or down anywhere does it too.
        let y0 = null;
        stage.addEventListener('pointerdown', function (e) { if (!e.target.closest('[data-dir]')) y0 = e.clientY; });
        stage.addEventListener('pointerup', function (e) {
          if (y0 === null) return;
          const dy = e.clientY - y0;
          y0 = null;
          if (Math.abs(dy) > 30) mctx.send({ type: 'move', dir: dy < 0 ? 'up' : 'down' });
        });
      },
      update: function (s) { parts.forEach(function (p) { p.update(s); }); },
      unmount: function () { parts.forEach(function (p) { p.stop(); }); parts = []; },
    },
    pad: function (btn) { return btn === 'UP' ? { type: 'move', dir: 'up' } : btn === 'DOWN' ? { type: 'move', dir: 'down' } : null; },
    sounds: function (prev, s) { return s.res.some(function (r, i) { return r === false && prev.res[i] === null; }) ? ['wrong'] : []; },
  });
})();
