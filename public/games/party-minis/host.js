(function () {
  Ark.loadCss('/games/minis/style.css');
  const miniReady = Ark.loadScript('/games/minis/mini.js');

  function stars(n, target) {
    let s = '';
    for (let i = 0; i < target; i++) s += '<i class="' + (i < n ? 'on' : '') + '">⭐</i>';
    return '<span class="pm-stars">' + s + '</span>';
  }

  const cfg = {
    cls: 'pm',
    top: function (v) {
      return {
        left: ArkMini.nameOf(v, 0) + stars(v.wins[0], v.target),
        mid: '<span class="pm-round">' + (v.phase === 'over' ? 'Final' : 'Game ' + (v.count + (v.phase === 'result' ? 0 : 1))) + ' · first to ' + v.target + '</span>',
        right: stars(v.wins[1], v.target) + ArkMini.nameOf(v, 1),
      };
    },
    result: function (v) {
      const w = v.lastResult.winner;
      return '<div class="title">' + (w === null ? '🤝 A draw' : '⭐ ' + ArkMini.nameOf(v, w) + ' wins it!') + '</div>';
    },
    over: function (v) {
      return '<div class="title">🏆 ' + ArkMini.nameOf(v, v.winner) + ' wins the party!</div><div class="muted">' + v.wins[0] + ' – ' + v.wins[1] + '</div>';
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

  Ark.register('host', 'party-minis', {
    padHint: 'A: ready · then follow the minigame (A, D-pad / stick) · A: rematch at the end',
    // Go on each minigame, a point for its winner, a fanfare at the end.
    sounds: function (prev, v) {
      const out = [];
      if (v.phase === 'play' && prev.phase !== 'play') out.push('go');
      if (v.phase === 'result' && prev.phase !== 'result' && v.lastResult.winner !== null) out.push('point');
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
