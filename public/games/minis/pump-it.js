// PUMP IT! (server/games/minis/pump-it.js) Pump the tyre up into the green; past it, it bursts.
(function () {
  function gauge(s, slot) {
    const full = s.top;
    const pct = function (n) { return Math.min(100, (n / full) * 100); };
    const burst = s.burst[slot];
    return '<div class="mi-pump"><div class="tube"><i class="zone" style="bottom:' + pct(s.zone.from - 0.5) + '%;height:' + pct(s.zone.to - s.zone.from + 1) + '%"></i>' +
      '<i class="air' + (burst ? ' burst' : '') + '" style="height:' + pct(s.air[slot]) + '%"></i></div>' +
      '<div class="tyre' + (burst ? ' burst' : '') + '" style="--k:' + (0.55 + 0.45 * Math.min(1, s.air[slot] / full)) + '">' + (burst ? '💥' : '🛞') + '</div></div>' +
      ArkMini.mark(s.res[slot]);
  }

  let host = null;
  let phone = null;

  ArkMini.register('pump-it', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-split">' + [0, 1].map(function (s) {
          return '<div class="mi-side p' + (s + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, s) + '</div><div class="slot"></div></div>';
        }).join('') + '</div>';
        host = el;
      },
      update: function (s) { if (host) host.querySelectorAll('.slot').forEach(function (el, i) { el.innerHTML = gauge(s, i); }); },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage"><div class="slot"></div><button class="primary mi-big-btn">PUMP!</button></div>';
        phone = { el: el, slot: mctx.slot };
        el.querySelector('button').addEventListener('pointerdown', function () { mctx.send({ type: 'pump' }); mctx.vibrate(10); });
      },
      update: function (s) { if (phone) phone.el.querySelector('.slot').innerHTML = gauge(s, phone.slot); },
      unmount: function () { phone = null; },
    },
    pad: function (btn) { return btn === 'A' || btn === 'B' || btn === 'X' || btn === 'Y' ? { type: 'pump' } : null; },
    sounds: function (prev, s) {
      if (s.burst.some(function (b, i) { return b && !prev.burst[i]; })) return ['boom'];
      return s.air.some(function (a, i) { return a > prev.air[i]; }) ? ['tick'] : [];
    },
  });
})();
