// DON'T TOUCH! (server/games/minis/dont-touch.js) Any tap or button fails.
(function () {
  let host = null;
  let phone = null;

  ArkMini.register('dont-touch', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-split">' + [0, 1].map(function (s) {
          return '<div class="mi-side p' + (s + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, s) + '</div><div class="mi-hand">✋</div></div>';
        }).join('') + '</div>';
        host = el;
      },
      update: function (s) {
        if (host) host.querySelectorAll('.mi-hand').forEach(function (el, i) { el.textContent = s.res[i] === false ? '💥' : '✋'; });
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-donttouch"><div class="mi-hand">🙅</div><div class="msg">Hands off!</div></div>';
        phone = { el: el, slot: mctx.slot };
        el.firstChild.addEventListener('pointerdown', function () { mctx.send({ type: 'touch' }); mctx.vibrate(80); });
      },
      update: function (s) {
        if (phone && s.res[phone.slot] === false) phone.el.querySelector('.msg').textContent = '💥 You touched it!';
      },
      unmount: function () { phone = null; },
    },
    pad: function () { return { type: 'touch' }; },
  });
})();
