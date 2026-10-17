(function () {
  Ark.loadCss('/games/minis/style.css');
  const miniReady = Ark.loadScript('/games/minis/mini.js');

  function hearts(n, max) {
    let s = '';
    for (let i = 0; i < max; i++) s += '<i class="' + (i < n ? 'on' : '') + '">❤️</i>';
    return '<span class="mx-hearts">' + s + '</span>';
  }

  const cfg = {
    cls: 'mx',
    top: function (v) {
      return {
        left: ArkMini.nameOf(v, 0) + hearts(v.lives[0], v.startLives),
        mid: v.suddenDeath ? '<span class="mx-sudden">⚡ SUDDEN DEATH</span>' : '<span class="mx-level">Speed ' + v.level + '</span>',
        right: hearts(v.lives[1], v.startLives) + ArkMini.nameOf(v, 1),
      };
    },
    result: function (v) {
      return '<div class="mx-verdicts">' + [0, 1].map(function (s) {
        const ok = v.lastResult.pass[s];
        return '<div class="' + (ok ? 'ok' : 'bad') + '">' + ArkMini.nameOf(v, s) + '<b>' + (ok ? '✔ Nice!' : '✖ −❤️') + '</b></div>';
      }).join('') + '</div>';
    },
    over: function (v) {
      return '<div class="title">🏆 ' + ArkMini.nameOf(v, v.winner) + ' wins!</div><div class="muted">' + v.count + ' micro-games, up to speed ' + v.level + '</div>';
    },
  };

  let frame = null;
  let mountEl = null;
  let lastView = null;
  miniReady.then(function () {
    frame = ArkMini.hostFrame(cfg);
    if (mountEl) frame.mount(mountEl);
    if (mountEl && lastView) frame.update(lastView);
  });

  Ark.register('host', 'micro-mayhem', {
    padHint: 'Do what the screen says! D-pad / stick + A · A: rematch at the end',
    // Go on each micro, a chime or a buzz on the result, a fanfare at the end.
    sounds: function (prev, v) {
      const out = [];
      if (v.phase === 'play' && prev.phase !== 'play') out.push('go');
      if (v.phase === 'result' && prev.phase !== 'result') out.push(v.lastResult.pass.every(Boolean) ? 'correct' : 'wrong');
      if (v.phase === 'over' && prev.phase !== 'over') out.push('fanfare');
      if (window.ArkMini) out.push.apply(out, ArkMini.miniSounds(prev, v));
      return out;
    },
    mount: function (el) { mountEl = el; if (frame) frame.mount(el); },
    update: function (v) { lastView = v; if (frame) frame.update(v); },
    unmount: function () { if (frame) frame.unmount(); mountEl = lastView = null; },
    pad: function (btn, v, slot) { return frame ? frame.pad(btn, v, slot) : null; },
    padPoll: function (pad, v, slot) { return frame ? frame.padPoll(pad, v, slot) : null; },
  });
})();
