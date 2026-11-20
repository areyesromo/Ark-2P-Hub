// CATCH IT! (server/games/minis/catch-it.js) A claw swings a present back and forth: let go when
// it's over your basket, and watch it drop.
(function () {
  // Same as clawAt (and needleAt) in server/games/minis/catch-it.js.
  function clawAt(t, periodMs, phase) {
    const p = (((t + phase * periodMs) % periodMs) + periodMs) % periodMs / periodMs;
    return p < 0.5 ? p * 2 : 2 - p * 2;
  }
  const BASKET = 0.09; // (half its width: as the server's BASKET)

  function field(el, mctx, slot) {
    el.insertAdjacentHTML('beforeend', '<div class="mi-catch"><i class="rail"></i><span class="claw">🪝</span><span class="gift">🎁</span><span class="basket">🧺</span></div>');
    const box = el.querySelector('.mi-catch');
    const claw = box.querySelector('.claw');
    const gift = box.querySelector('.gift');
    const basket = box.querySelector('.basket');
    const markEl = document.createElement('div');
    el.appendChild(markEl);
    let state = null;
    let raf = requestAnimationFrame(function frame() {
      raf = requestAnimationFrame(frame);
      if (!state) return;
      const dropped = state.drops[slot];
      const x = dropped !== null ? dropped : clawAt(mctx.t(), state.periodMs, state.phase);
      claw.style.left = (dropped !== null ? clawAt(mctx.t(), state.periodMs, state.phase) : x) * 100 + '%';
      gift.style.left = x * 100 + '%';
    });
    return {
      update: function (s) {
        state = s;
        basket.style.left = s.basket * 100 + '%';
        basket.style.width = BASKET * 200 + '%';
        box.classList.toggle('dropped', s.drops[slot] !== null);
        box.classList.toggle('caught', s.res[slot] === true);
        markEl.innerHTML = ArkMini.mark(s.res[slot]);
      },
      stop: function () { cancelAnimationFrame(raf); },
    };
  }

  let parts = [];

  ArkMini.register('catch-it', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-split">' + [0, 1].map(function (s) {
          return '<div class="mi-side p' + (s + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, s) + '</div></div>';
        }).join('') + '</div>';
        parts = [0, 1].map(function (s) { return field(el.querySelectorAll('.mi-side')[s], mctx, s); });
      },
      update: function (s) { parts.forEach(function (p) { p.update(s); }); },
      unmount: function () { parts.forEach(function (p) { p.stop(); }); parts = []; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage"></div>';
        const stage = el.firstChild;
        parts = [field(stage, mctx, mctx.slot)];
        stage.insertAdjacentHTML('beforeend', '<button class="primary mi-big-btn">DROP!</button>');
        stage.querySelector('button').addEventListener('pointerdown', function () { mctx.send({ type: 'drop' }); mctx.vibrate(20); });
      },
      update: function (s) { parts.forEach(function (p) { p.update(s); }); },
      unmount: function () { parts.forEach(function (p) { p.stop(); }); parts = []; },
    },
    pad: function (btn) { return btn === 'A' || btn === 'B' || btn === 'X' || btn === 'Y' ? { type: 'drop' } : null; },
    sounds: function (prev, s) { return s.drops.some(function (x, i) { return x !== null && prev.drops[i] === null; }) ? ['drop'] : []; },
  });
})();
