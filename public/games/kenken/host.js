(function () {
  Ark.loadCss('/games/kenken/style.css');
  const ready = Ark.loadScript('/games/kenken/board.js');

  let root = null;
  let view = null;
  let key = '';

  function render() {
    const v = view;
    if (!v || !root || !window.ArkKenKen) return;
    const k = JSON.stringify([v.grid, v.selected, v.clashes, v.phase, Math.floor(v.elapsed / 1000)]);
    if (k === key) return;
    key = k;
    root.querySelector('.kk-stats').innerHTML = '<span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong></span><span><strong>' + v.filled + '</strong> / ' + v.n * v.n + ' filled</span>' +
      (v.clashes.length ? '<span class="bad">⚠ ' + v.clashes.length + ' clash' + (v.clashes.length === 1 ? '' : 'es') + '</span>' : '');
    root.querySelector('.kk-field').innerHTML = window.ArkKenKen.html(v);
  }

  /** The square next to the selected one, wrapping round. */
  function step(v, btn) {
    const n = v.n;
    const r = Math.floor(v.selected / n);
    const c = v.selected % n;
    if (btn === 'LEFT') return r * n + (c + n - 1) % n;
    if (btn === 'RIGHT') return r * n + (c + 1) % n;
    if (btn === 'UP') return ((r + n - 1) % n) * n + c;
    return ((r + 1) % n) * n + c;
  }

  Ark.register('host', 'kenken', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return ['fanfare'];
      if (v.clashes.length > prev.clashes.length) return ['wrong'];
      if (v.filled !== prev.filled) return ['lock'];
      return [];
    },
    padHint: 'D-pad move · A next number · Y the one before · X / B clear · keyboard: type the number',
    pad: function (btn, v) {
      if (v.phase !== 'play') return null;
      if (btn === 'UP' || btn === 'DOWN' || btn === 'LEFT' || btn === 'RIGHT') return { type: 'select', cell: step(v, btn) };
      const now = v.grid[v.selected];
      if (btn === 'A') return { type: 'set', cell: v.selected, value: (now + 1) % (v.n + 1) };
      if (btn === 'Y') return { type: 'set', cell: v.selected, value: (now + v.n) % (v.n + 1) };
      if (btn === 'X' || btn === 'B') return { type: 'set', cell: v.selected, value: 0 };
      return null;
    },
    typing: function (k, v) {
      if (v.phase !== 'play') return null;
      if (/^[0-9]$/.test(k) && Number(k) <= v.n) return { type: 'set', cell: v.selected, value: Number(k) };
      if (k === 'Delete') return { type: 'set', cell: v.selected, value: 0 };
      return null;
    },
    overHtml: function (v) {
      return v.n + ' × ' + v.n + ' solved in ' + Ark.clock(v.elapsed);
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'kk-host';
      root.innerHTML = '<div class="kk-stats"></div><div class="kk-field"></div><p class="muted kk-rule">Each number once per row and column; each cage makes its target with its sign.</p>';
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
