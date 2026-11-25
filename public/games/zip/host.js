(function () {
  Ark.loadCss('/games/zip/style.css');
  const ready = Ark.loadScript('/games/zip/board.js');

  let root = null;
  let view = null;
  let key = '';

  function render() {
    const v = view;
    if (!v || !root || !window.ArkZip) return;
    const Z = window.ArkZip;
    const local = v.player && v.player.local && v.phase === 'play';
    root.querySelector('.zp-top').innerHTML =
      '<span>' + (v.level ? 'Level <strong>' + v.level + '</strong>' : 'Random') + ' · ' + v.n + ' × ' + v.n + '</span>' +
      '<span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong>' + (v.par ? ' / par ' + Z.par(v.par) : '') + '</span>' +
      '<span><strong>' + v.filled + '</strong> / ' + v.n * v.n + '</span>' +
      (v.phase === 'paused' ? '<span class="zp-paused">⏸ Paused</span>' : '');
    const k = JSON.stringify([v.path, v.numbers, v.walls, v.hint, v.phase, local]);
    if (k === key) return;
    key = k;
    const board = root.querySelector('.zp-board');
    board.style.setProperty('--n', v.n);
    board.classList.toggle('won', v.won);
    board.innerHTML = Z.html(v, { cursor: local });
  }

  Ark.register('host', 'zip', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return v.won ? ['fanfare'] : [];
      if (v.hintNo > prev.hintNo) return ['reveal'];
      if (v.next > prev.next) return ['correct'];
      if (v.filled !== prev.filled) return ['tick'];
      return [];
    },
    padHint: 'D-pad draws the path (back over it to take it back) · B (E) a step back · X (Q) hint +30 s · Y clear · Start (P) pause',
    pad: function (btn, v) {
      if (btn === 'START') return { type: 'pause' };
      if (v.phase !== 'play') return null;
      const n = v.n;
      const head = v.path[v.path.length - 1];
      const x = head % n;
      const y = Math.floor(head / n);
      if (btn === 'LEFT' && x > 0) return { type: 'to', cell: head - 1 };
      if (btn === 'RIGHT' && x < n - 1) return { type: 'to', cell: head + 1 };
      if (btn === 'UP' && y > 0) return { type: 'to', cell: head - n };
      if (btn === 'DOWN' && y < n - 1) return { type: 'to', cell: head + n };
      if (btn === 'B') return { type: 'back' };
      if (btn === 'X') return { type: 'hint' };
      if (btn === 'Y') return { type: 'clear' };
      return null;
    },
    typing: function (k, v) {
      if (v.phase !== 'play') return null;
      if (k === 'e' || k === 'E') return { type: 'back' };
      return null;
    },
    overHtml: function (v) {
      if (!v.won) return '';
      const help = v.hints ? ' (with ' + v.hints + ' hint' + (v.hints > 1 ? 's' : '') + ')' : '';
      if (!v.level) return 'Every square, every number' + help + ' 〰️';
      const par = v.elapsed <= v.par * 1000 ? ', inside par! 🎉' : '';
      return 'Level ' + v.level + ' solved' + help + par + (v.level < v.levels ? ' · Level ' + (v.level + 1) + ' is open now' : ' · that was the last one! 🏆');
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'zp-host';
      root.innerHTML = '<div class="zp-top"></div><div class="zp-wrap"><div class="zp-board"></div></div><div class="zp-rules"></div>';
      el.appendChild(root);
      ready.then(function () {
        root.querySelector('.zp-rules').textContent = window.ArkZip.RULES;
        render();
      });
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
