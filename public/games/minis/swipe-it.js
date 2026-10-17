// SWIPE IT! (server/games/minis/swipe-it.js) Swipe (or D-pad) the way each arrow points.
(function () {
  const A = ArkMini.DIR_ARROW;
  const PAD = { UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right' };

  function arrows(s, slot) {
    return '<div class="mi-arrows">' + s.arrows.map(function (d, i) {
      return '<span class="' + (i < s.done[slot] ? 'done' : i === s.done[slot] && s.res[slot] === null ? 'now' : '') + '">' + A[d] + '</span>';
    }).join('') + '</div>' + ArkMini.mark(s.res[slot]);
  }

  let host = null;
  let phone = null;

  ArkMini.register('swipe-it', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-split">' + [0, 1].map(function (s) {
          return '<div class="mi-side p' + (s + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, s) + '</div><div class="slot"></div></div>';
        }).join('') + '</div>';
        host = el;
      },
      update: function (s) {
        if (host) host.querySelectorAll('.slot').forEach(function (el, i) { el.innerHTML = arrows(s, i); });
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-swipe"><div class="slot"></div><div class="pad">' +
          ['up', 'left', 'right', 'down'].map(function (d) { return '<button class="ghost" data-dir="' + d + '">' + A[d] + '</button>'; }).join('') + '</div></div>';
        phone = { el: el, slot: mctx.slot };
        let start = null;
        const area = el.firstChild;
        area.addEventListener('pointerdown', function (e) { start = { x: e.clientX, y: e.clientY }; });
        area.addEventListener('pointerup', function (e) {
          const b = e.target.closest('[data-dir]');
          if (b) { mctx.send({ type: 'swipe', dir: b.getAttribute('data-dir') }); start = null; return; }
          if (!start) return;
          const dx = e.clientX - start.x;
          const dy = e.clientY - start.y;
          start = null;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < 40) return;
          mctx.send({ type: 'swipe', dir: Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up' });
          mctx.vibrate(10);
        });
      },
      update: function (s) { if (phone) phone.el.querySelector('.slot').innerHTML = arrows(s, phone.slot); },
      unmount: function () { phone = null; },
    },
    pad: function (btn) { return PAD[btn] ? { type: 'swipe', dir: PAD[btn] } : null; },
  });
})();
