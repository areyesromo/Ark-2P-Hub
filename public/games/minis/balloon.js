// Balloon Pump (server/games/minis/balloon.js): mash to pop your balloon first.
(function () {
  function balloon(pumps, need) {
    const k = Math.min(1, pumps / need);
    return '<div class="mi-balloon' + (k >= 1 ? ' popped' : '') + '" style="font-size:' + (3 + k * 9) + 'rem">' + (k >= 1 ? '💥' : '🎈') + '</div><div class="mi-count">' + pumps + ' / ' + need + '</div>';
  }
  let host = null;
  let phone = null;

  ArkMini.register('balloon', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-split">' + [0, 1].map(function (s) {
          return '<div class="mi-side p' + (s + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, s) + '</div><div class="slot"></div></div>';
        }).join('') + '</div>';
        host = el;
      },
      update: function (s) { if (host) host.querySelectorAll('.slot').forEach(function (el, i) { el.innerHTML = balloon(s.pumps[i], s.need); }); },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage"><div class="slot"></div><button class="primary mi-big-btn">PUMP!</button></div>';
        phone = { el: el, slot: mctx.slot };
        el.querySelector('button').addEventListener('pointerdown', function () { mctx.send({ type: 'pump' }); mctx.vibrate(8); });
      },
      update: function (s) { if (phone) phone.el.querySelector('.slot').innerHTML = balloon(s.pumps[phone.slot], s.need); },
      unmount: function () { phone = null; },
    },
    pad: function (btn) { return btn === 'A' || btn === 'B' || btn === 'X' || btn === 'Y' ? { type: 'pump' } : null; },
    sounds: function (prev, s) {
      return s.pumps.some(function (n, i) { return Math.floor(n / 5) > Math.floor(prev.pumps[i] / 5); }) ? ['drop'] : [];
    },
  });
})();
