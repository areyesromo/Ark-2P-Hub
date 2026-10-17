(function () {
  Ark.loadCss('/games/minis/style.css');
  const miniReady = Ark.loadScript('/games/minis/mini.js');

  function hearts(n) {
    return new Array(n + 1).join('❤️') || '💀';
  }

  const cfg = {
    cls: 'mx',
    top: function (v, me) {
      return '<span>You ' + hearts(v.lives[me]) + '</span><span class="mx-level">' + (v.suddenDeath ? '⚡ Sudden death' : 'Speed ' + v.level) + '</span><span>Them ' + hearts(v.lives[1 - me]) + '</span>';
    },
    result: function (v, me) {
      const ok = v.lastResult.pass[me];
      return '<div class="big ' + (ok ? 'ok' : 'bad') + '">' + (ok ? '✔ Nice!' : '✖ Missed it') + '</div>' +
        '<div class="muted">They ' + (v.lastResult.pass[1 - me] ? 'made it' : 'missed it') + '</div>';
    },
    over: function (v, me) {
      return '<div class="big">' + (v.winner === me ? 'You win! 🏆' : 'You lose') + '</div><div class="muted">Up to speed ' + v.level + '</div>';
    },
    buzz: function (v, me) { return v.lastResult.pass[me] ? 20 : [60, 40, 60]; },
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

  Ark.register('player', 'micro-mayhem', {
    mount: function (el, a) { mountEl = el; api = a; if (frame) frame.mount(el, a); },
    update: function (v) { lastView = v; if (frame) frame.update(v); },
    unmount: function () { if (frame) frame.unmount(); mountEl = lastView = null; },
  });
})();
