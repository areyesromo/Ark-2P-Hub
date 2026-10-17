// Sweet Spot (server/games/minis/sweet-spot.js): stop your wheel on a big number.
(function () {
  const SPINS = 3;
  // Same as wheelValue in server/games/minis/sweet-spot.js.
  function wheelValue(ms, offset, step) {
    return 1 + (Math.floor((ms + offset) / step) % 10);
  }

  function wheel(el, mctx, slot) {
    el.insertAdjacentHTML('beforeend', '<div class="mi-wheel"><div class="num">–</div><div class="spins"></div></div>');
    const num = el.querySelector('.mi-wheel .num');
    const spins = el.querySelector('.mi-wheel .spins');
    let s = null;
    let raf = requestAnimationFrame(function frame() {
      raf = requestAnimationFrame(frame);
      if (!s) return;
      const t = mctx.t();
      const done = s.spins[slot].length >= SPINS;
      const waiting = t < s.spinStart[slot];
      num.textContent = done ? '✔' : waiting ? s.spins[slot][s.spins[slot].length - 1] || '–' : wheelValue(t - s.spinStart[slot], s.offset[slot], s.step);
      num.classList.toggle('spinning', !done && !waiting);
    });
    return {
      update: function (state) {
        s = state;
        const got = s.spins[slot];
        spins.innerHTML = [0, 1, 2].map(function (i) { return '<span>' + (got[i] === undefined ? '·' : got[i]) + '</span>'; }).join('') +
          '<b>= ' + got.reduce(function (a, b) { return a + b; }, 0) + '</b>';
      },
      stop: function () { cancelAnimationFrame(raf); },
    };
  }

  let parts = [];

  ArkMini.register('sweet-spot', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-split">' + [0, 1].map(function (s) {
          return '<div class="mi-side p' + (s + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, s) + '</div></div>';
        }).join('') + '</div>';
        parts = [0, 1].map(function (s) { return wheel(el.querySelectorAll('.mi-side')[s], mctx, s); });
      },
      update: function (s) { parts.forEach(function (p) { p.update(s); }); },
      unmount: function () { parts.forEach(function (p) { p.stop(); }); parts = []; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage"></div>';
        parts = [wheel(el.firstChild, mctx, mctx.slot)];
        el.firstChild.insertAdjacentHTML('beforeend', '<button class="primary mi-big-btn">STOP!</button>');
        el.querySelector('button').addEventListener('pointerdown', function () { mctx.send({ type: 'stop' }); mctx.vibrate(20); });
      },
      update: function (s) { parts.forEach(function (p) { p.update(s); }); },
      unmount: function () { parts.forEach(function (p) { p.stop(); }); parts = []; },
    },
    pad: function (btn) { return btn === 'A' || btn === 'B' || btn === 'X' || btn === 'Y' ? { type: 'stop' } : null; },
    sounds: function (prev, s) {
      return s.spins.some(function (x, i) { return x.length > prev.spins[i].length; }) ? ['lock'] : [];
    },
  });
})();
