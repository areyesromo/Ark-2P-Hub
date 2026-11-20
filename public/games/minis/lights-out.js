// LIGHTS OUT! (server/games/minis/lights-out.js) Five red lights go out one by one: tap as the
// last one goes, not before.
(function () {
  // Same as lightsOn in server/games/minis/lights-out.js.
  function lightsOn(off, t) { return off.filter(function (at) { return t < at; }).length; }

  /** A row of lights, kept up to date each frame. */
  function lights(el, mctx, slot) {
    el.insertAdjacentHTML('beforeend', '<div class="mi-lights">' + '<i></i>'.repeat(5) + '</div>');
    const row = el.querySelector('.mi-lights');
    const bulbs = row.querySelectorAll('i');
    const markEl = document.createElement('div');
    el.appendChild(markEl);
    let state = null;
    let raf = requestAnimationFrame(function frame() {
      raf = requestAnimationFrame(frame);
      if (!state) return;
      const on = lightsOn(state.off, mctx.t());
      bulbs.forEach(function (b, i) { b.classList.toggle('on', i < on); });
    });
    return {
      update: function (s) {
        state = s;
        markEl.innerHTML = ArkMini.mark(s.res[slot]) + (s.taps[slot] !== null && s.taps[slot] < 0 ? '<div class="muted">Jumped the start!</div>' : '');
      },
      stop: function () { cancelAnimationFrame(raf); },
    };
  }

  let parts = [];

  ArkMini.register('lights-out', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-split">' + [0, 1].map(function (s) {
          return '<div class="mi-side p' + (s + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, s) + '</div></div>';
        }).join('') + '</div>';
        parts = [0, 1].map(function (s) { return lights(el.querySelectorAll('.mi-side')[s], mctx, s); });
      },
      update: function (s) { parts.forEach(function (p) { p.update(s); }); },
      unmount: function () { parts.forEach(function (p) { p.stop(); }); parts = []; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage"></div>';
        const stage = el.firstChild;
        parts = [lights(stage, mctx, mctx.slot)];
        stage.insertAdjacentHTML('beforeend', '<button class="primary mi-big-btn">GO!</button>');
        stage.querySelector('button').addEventListener('pointerdown', function () { mctx.send({ type: 'tap' }); mctx.vibrate(20); });
      },
      update: function (s) { parts.forEach(function (p) { p.update(s); }); },
      unmount: function () { parts.forEach(function (p) { p.stop(); }); parts = []; },
    },
    pad: function (btn) { return btn === 'A' || btn === 'B' || btn === 'X' || btn === 'Y' ? { type: 'tap' } : null; },
    sounds: function (prev, s) { return s.taps.some(function (x, i) { return x !== null && prev.taps[i] === null; }) ? ['lock'] : []; },
  });
})();
