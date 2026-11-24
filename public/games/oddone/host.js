(function () {
  Ark.loadCss('/games/oddone/style.css');

  let root = null;
  let view = null;
  let key = '';
  let cursor = 0;

  function grid(v, withCursor) {
    let out = '<div class="oo-grid" style="--n:' + v.size + '">';
    for (let i = 0; i < v.size * v.size; i++) {
      out += '<button type="button" class="oo-cell' + (withCursor && cursor === i ? ' cursor' : '') + '" data-cell="' + i + '" style="background:' + (i === v.odd ? v.oddColour : v.base) + '"></button>';
    }
    return out + '</div>';
  }

  function render() {
    const v = view;
    if (!v || !root) return;
    const local = v.player && v.player.local && v.phase === 'play';
    if (cursor >= v.size * v.size) cursor = 0;
    const secs = Math.ceil(v.timeLeft / 1000);
    const k = JSON.stringify([v.phase, v.round, v.base, v.score, secs, local && cursor, v.last && v.last.n]);
    if (k === key) return;
    key = k;
    root.querySelector('.oo-top').innerHTML = '<span>✓ <strong>' + v.score + '</strong></span><span class="' + (secs <= 10 && v.phase === 'play' ? 'low' : '') + '">⏱ <strong>' + secs + '</strong> s</span>' +
      (v.last && !v.last.ok ? '<span class="miss">−3 s</span>' : '');
    root.querySelector('.oo-field').innerHTML = v.phase === 'play' ? grid(v, local) : v.phase === 'ready' ? '<div class="big">Get ready…</div>' : '';
  }

  Ark.register('host', 'oddone', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return ['end'];
      if (v.last && (!prev.last || v.last.n !== prev.last.n)) return [v.last.ok ? 'correct' : 'wrong'];
      return [];
    },
    padHint: 'D-pad move · A pick',
    pad: function (btn, v) {
      if (v.phase !== 'play') return null;
      const n = v.size;
      const r = Math.floor(cursor / n);
      const c = cursor % n;
      if (btn === 'LEFT') cursor = r * n + (c + n - 1) % n;
      else if (btn === 'RIGHT') cursor = r * n + (c + 1) % n;
      else if (btn === 'UP') cursor = ((r + n - 1) % n) * n + c;
      else if (btn === 'DOWN') cursor = ((r + 1) % n) * n + c;
      else if (btn === 'A') return { type: 'pick', cell: cursor };
      render();
      return null;
    },
    overHtml: function (v) {
      return v.score + ' found · ' + v.wrong + ' wrong tap' + (v.wrong === 1 ? '' : 's');
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'oo-host';
      root.innerHTML = '<div class="oo-top"></div><div class="oo-field"></div><p class="muted oo-rule">One square is a shade different. Find it!</p>';
      el.appendChild(root);
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      key = '';
      cursor = 0;
    },
  });
})();
