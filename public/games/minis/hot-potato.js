// Hot Potato (server/games/minis/hot-potato.js): pass the bomb before it blows.
(function () {
  let host = null;
  let phone = null;

  ArkMini.register('hot-potato', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-potato"><div class="mi-side p1"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, 0) + '</div></div>' +
          '<div class="bomb">💣</div><div class="mi-side p2"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, 1) + '</div></div></div>';
        host = el.firstChild;
      },
      update: function (s) {
        if (!host) return;
        // While flying the bomb heads for the other side.
        host.setAttribute('data-at', s.flying ? 'p' + (2 - s.holder) : 'p' + (s.holder + 1));
        host.classList.toggle('flying', s.flying);
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage"><div class="msg"></div><button class="mi-big-btn mi-pass">💣 PASS IT!</button></div>';
        phone = { el: el, slot: mctx.slot };
        el.querySelector('button').addEventListener('pointerdown', function () { mctx.send({ type: 'pass' }); mctx.vibrate(25); });
      },
      update: function (s) {
        if (!phone) return;
        const mine = s.holder === phone.slot && !s.flying;
        phone.el.querySelector('.msg').textContent = mine ? 'You have the bomb!' : s.holder === phone.slot ? 'Thrown! 💨' : 'Phew… they have it 😅';
        phone.el.querySelector('button').disabled = !mine;
        phone.el.classList.toggle('mi-hot', mine);
      },
      unmount: function () { phone = null; },
    },
    pad: function (btn) { return btn === 'A' || btn === 'B' || btn === 'X' || btn === 'Y' ? { type: 'pass' } : null; },
    sounds: function (prev, s) { return s.passes > prev.passes ? ['drop'] : []; },
  });
})();
