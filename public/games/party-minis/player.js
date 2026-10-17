(function () {
  Ark.loadCss('/games/minis/style.css');
  const miniReady = Ark.loadScript('/games/minis/mini.js');

  const cfg = {
    cls: 'pm',
    top: function (v, me) {
      return '<span>You ' + v.wins[me] + ' ⭐</span><span class="pm-round">First to ' + v.target + '</span><span>Them ' + v.wins[1 - me] + ' ⭐</span>';
    },
    result: function (v, me) {
      const w = v.lastResult.winner;
      return '<div class="big ' + (w === me ? 'ok' : w === null ? '' : 'bad') + '">' + (w === null ? '🤝 A draw' : w === me ? '⭐ You win it!' : 'They win it') + '</div>';
    },
    over: function (v, me) {
      return '<div class="big">' + (v.winner === me ? 'You win the party! 🏆' : 'You lose') + '</div><div class="muted">' + v.wins[me] + ' – ' + v.wins[1 - me] + '</div>';
    },
    buzz: function (v, me) { return v.lastResult.winner === me ? [30, 30, 30] : 40; },
  };

  let frame = null;
  let mountEl = null;
  let api = null;
  let lastView = null;
  miniReady.then(function () {
    frame = ArkMini.phoneFrame(cfg);
    if (mountEl) frame.mount(mountEl, api);
    if (mountEl && lastView) frame.update(lastView);
  });

  Ark.register('player', 'party-minis', {
    mount: function (el, a) { mountEl = el; api = a; if (frame) frame.mount(el, a); },
    update: function (v) { lastView = v; if (frame) frame.update(v); },
    unmount: function () { if (frame) frame.unmount(); mountEl = lastView = null; },
  });
})();
