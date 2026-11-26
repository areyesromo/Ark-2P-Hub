(function () {
  Ark.loadCss('/games/futoshiki/style.css');
  const ready = Ark.loadScript('/games/futoshiki/board.js');

  let root = null;
  let view = null;
  let key = '';
  let digit = 1; // a controller's picked number

  function render() {
    const v = view;
    if (!v || !root || !window.ArkFutoshiki) return;
    const local = v.player && v.player.local && v.phase === 'play';
    root.querySelector('.ft-top').innerHTML =
      '<span><strong>' + v.n + ' × ' + v.n + '</strong></span>' +
      '<span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong></span>' +
      '<span><strong>' + v.filled + '</strong> / ' + v.n * v.n + '</span>' +
      (v.phase === 'paused' ? '<span class="ft-paused">⏸ Paused</span>' : '');
    let pick = '';
    if (local) for (let d = 1; d <= v.n; d++) pick += '<span class="' + (d === digit ? 'on' : '') + '">' + d + '</span>';
    root.querySelector('.ft-pick').innerHTML = pick;
    const k = JSON.stringify([v.grid, v.notes, v.signs, v.clashes, v.selected, v.hint, v.phase]);
    if (k === key) return;
    key = k;
    const board = root.querySelector('.ft-board');
    board.style.setProperty('--n', v.n);
    board.classList.toggle('won', v.won);
    board.innerHTML = window.ArkFutoshiki.html(v);
  }

  Ark.register('host', 'futoshiki', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return v.won ? ['fanfare'] : [];
      if (v.hintNo > prev.hintNo) return ['reveal'];
      if (v.clashes.length > prev.clashes.length) return ['wrong'];
      if (v.filled !== prev.filled) return ['lock'];
      if (JSON.stringify(v.notes) !== JSON.stringify(prev.notes)) return ['tick'];
      return [];
    },
    padHint: 'D-pad move · LB / RB pick a number · A put it in · B pencil it · X clear · Y (E) undo · RT (Q) hint +30 s · Start (P) pause · keyboard: type the number',
    pad: function (btn, v) {
      if (btn === 'START') return { type: 'pause' };
      if (v.phase !== 'play') return null;
      const n = v.n;
      const r = Math.floor(v.selected / n);
      const c = v.selected % n;
      if (btn === 'LEFT') return { type: 'select', cell: r * n + ((c + n - 1) % n) };
      if (btn === 'RIGHT') return { type: 'select', cell: r * n + ((c + 1) % n) };
      if (btn === 'UP') return { type: 'select', cell: ((r + n - 1) % n) * n + c };
      if (btn === 'DOWN') return { type: 'select', cell: ((r + 1) % n) * n + c };
      if (btn === 'LB') digit = ((digit + n - 2) % n) + 1;
      else if (btn === 'RB') digit = (digit % n) + 1;
      else if (btn === 'A') return { type: 'set', cell: v.selected, value: digit };
      else if (btn === 'B') return { type: 'note', cell: v.selected, value: digit };
      else if (btn === 'X') return { type: 'set', cell: v.selected, value: 0 };
      else if (btn === 'Y') return { type: 'undo' };
      else if (btn === 'RT') return { type: 'hint' };
      render();
      return null;
    },
    typing: function (k, v) {
      if (v.phase !== 'play') return null;
      if (/^[0-9]$/.test(k) && Number(k) <= v.n) return { type: 'set', cell: v.selected, value: Number(k) };
      return null;
    },
    overHtml: function (v) {
      if (!v.won) return '';
      return 'Every number in its place' + (v.hints ? ' (with ' + v.hints + ' hint' + (v.hints > 1 ? 's' : '') + ')' : '') + ' ✨';
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'ft-host';
      root.innerHTML = '<div class="ft-top"></div><div class="ft-wrap"><div class="ft-board"></div></div><div class="ft-pick"></div><div class="ft-rules">Each number once in every row and column · the open side of each sign faces the bigger number</div>';
      el.appendChild(root);
      ready.then(render);
    },
    update: function (v) {
      if (!view || v.n !== view.n) digit = 1;
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      key = '';
    },
  });
})();
