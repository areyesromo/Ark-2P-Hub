// Quick Draw (server/games/minis/quick-draw.js): fire on BANG!, not before.
(function () {
  function status(s, names, me) {
    if (s.stage === 'bang') return '<div class="mi-bang">BANG!</div>';
    if (s.stage === 'wait') return '<div class="mi-wait">Wait for it…</div>';
    const l = s.last;
    if (!l) return '';
    if (l.early !== null) return '<div class="mi-wait">' + (me === undefined ? names[l.early] : l.early === me ? 'You' : 'They') + ' fired too early!</div>';
    if (l.winner === null) return '<div class="mi-wait">Nobody fired…</div>';
    const ms = l.ms.map(function (x) { return x === null ? '—' : x + ' ms'; });
    return '<div class="mi-wait">' + (me === undefined ? names[l.winner] : l.winner === me ? 'You' : 'They') + ' win the duel!</div><div class="muted">' + ms[0] + ' · ' + ms[1] + '</div>';
  }
  function duels(s) { return '<div class="mi-duels">' + s.duelWins[0] + ' – ' + s.duelWins[1] + '</div>'; }

  let host = null;
  let phone = null;

  ArkMini.register('quick-draw', {
    host: {
      mount: function (el, mctx) {
        const names = [0, 1].map(function (s) { return ArkMini.nameOf({ players: mctx.players }, s); });
        el.innerHTML = '<div class="mi-draw"><div class="cowboy p1">🤠<div>' + names[0] + '</div></div><div class="mid"></div><div class="cowboy p2">🤠<div>' + names[1] + '</div></div></div>';
        host = { el: el.firstChild, names: names };
      },
      update: function (s) {
        if (!host) return;
        host.el.querySelector('.mid').innerHTML = duels(s) + status(s, host.names);
        host.el.classList.toggle('bang', s.stage === 'bang');
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-draw-phone"><div class="msg"></div><button class="mi-big-btn mi-fire">🔫 FIRE!</button></div>';
        phone = { el: el, slot: mctx.slot };
        el.querySelector('button').addEventListener('pointerdown', function () { mctx.send({ type: 'fire' }); mctx.vibrate(30); });
      },
      update: function (s) {
        if (!phone) return;
        phone.el.querySelector('.msg').innerHTML = duels(s) + status(s, null, phone.slot);
        phone.el.classList.toggle('bang', s.stage === 'bang');
      },
      unmount: function () { phone = null; },
    },
    pad: function (btn) { return btn === 'A' || btn === 'B' || btn === 'X' || btn === 'Y' || btn === 'RT' ? { type: 'fire' } : null; },
    sounds: function (prev, s) { return s.stage === 'bang' && prev.stage !== 'bang' ? ['boom'] : []; },
  });
})();
