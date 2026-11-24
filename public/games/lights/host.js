(function () {
  Ark.loadCss('/games/lights/style.css');
  const ready = Ark.loadScript('/games/lights/board.js');

  let root = null;
  let view = null;
  let key = '';

  function render() {
    const v = view;
    if (!v || !root || !window.ArkLights) return;
    const local = v.player && v.player.local && v.phase === 'play';
    const k = v.board.join('') + '|' + (local ? v.selected : '') + '|' + v.moves + '|' + Math.floor(v.elapsed / 1000);
    if (k === key) return;
    key = k;
    root.querySelector('.lo-field').innerHTML = window.ArkLights.html(v, { cursor: local ? v.selected : null });
    root.querySelector('.lo-stats').innerHTML =
      '<span>💡 <strong>' + v.lit + '</strong> on</span>' +
      '<span><strong>' + v.moves + '</strong> ' + (v.moves === 1 ? 'move' : 'moves') + ' <span class="muted">· par ' + v.par + '</span></span>' +
      '<span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong></span>';
  }

  /** The light next to the selected one, wrapping round. */
  function step(v, btn) {
    const n = v.n;
    const r = Math.floor(v.selected / n);
    const c = v.selected % n;
    if (btn === 'LEFT') return r * n + (c + n - 1) % n;
    if (btn === 'RIGHT') return r * n + (c + 1) % n;
    if (btn === 'UP') return ((r + n - 1) % n) * n + c;
    return ((r + 1) % n) * n + c;
  }

  Ark.register('host', 'lights', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return ['fanfare'];
      if (v.moves > prev.moves) return ['lock'];
      if (v.resets > prev.resets) return ['whoosh'];
      return [];
    },
    padHint: 'D-pad move · A press · Y / E start again',
    pad: function (btn, v) {
      if (v.phase !== 'play') return null;
      if (btn === 'UP' || btn === 'DOWN' || btn === 'LEFT' || btn === 'RIGHT') return { type: 'select', cell: step(v, btn) };
      if (btn === 'A') return { type: 'press', cell: v.selected };
      if (btn === 'Y') return { type: 'reset' };
      return null;
    },
    overHtml: function (v) {
      return v.variant + ': all off in ' + v.moves + ' ' + (v.moves === 1 ? 'move' : 'moves') + (v.moves <= v.par ? ' · on par or better! ⭐' : ' · par was ' + v.par);
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'lo-host';
      root.innerHTML = '<div class="lo-stats"></div><div class="lo-field"></div><p class="muted lo-rule">A press flips that light and the four next to it.</p>';
      el.appendChild(root);
      ready.then(render);
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      key = '';
    },
  });
})();
