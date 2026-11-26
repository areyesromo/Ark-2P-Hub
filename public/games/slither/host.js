(function () {
  Ark.loadCss('/games/slither/style.css');
  const ready = Ark.loadScript('/games/slither/board.js');

  let root = null;
  let view = null;
  let key = '';
  let cursor = 0;

  function render() {
    const v = view;
    if (!v || !root || !window.ArkSlither) return;
    const local = v.player && v.player.local && v.phase === 'play';
    root.querySelector('.sl-top').innerHTML =
      '<span>' + (v.level ? 'Level <strong>' + v.level + '</strong>' : 'Random') + ' · ' + v.w + ' × ' + v.h + '</span>' +
      '<span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong>' + (v.par ? ' / par ' + Ark.clock(v.par * 1000) : '') + '</span>' +
      (v.phase === 'paused' ? '<span class="sl-paused">⏸ Paused</span>' : '');
    const k = JSON.stringify([v.marks, v.clues, v.badCells, v.badDots, v.hint, v.phase, local && cursor]);
    if (k === key) return;
    key = k;
    const board = root.querySelector('.sl-board');
    board.style.setProperty('--ratio', (v.w + 1) / (v.h + 1));
    board.classList.toggle('won', v.won);
    board.innerHTML = window.ArkSlither.svg(v, local ? { cursor: cursor } : null);
  }

  Ark.register('host', 'slither', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return v.won ? ['fanfare'] : [];
      if (v.hintNo > prev.hintNo) return ['reveal'];
      if (v.badCells.length + v.badDots.length > prev.badCells.length + prev.badDots.length) return ['wrong'];
      if (JSON.stringify(v.marks) !== JSON.stringify(prev.marks)) return ['tick'];
      return [];
    },
    padHint: 'D-pad move along the lines · A line / ✕ / nothing · B rub out · X (Q) hint +30 s · Y (E) undo · Start (P) pause',
    pad: function (btn, v) {
      if (btn === 'START') return { type: 'pause' };
      if (v.phase !== 'play') return null;
      const dir = { LEFT: [-1, 0], RIGHT: [1, 0], UP: [0, -1], DOWN: [0, 1] }[btn];
      if (dir) cursor = window.ArkSlither.step(v, cursor, dir[0], dir[1]);
      else if (btn === 'A') return { type: 'tap', edge: cursor };
      else if (btn === 'B') return { type: 'tap', edge: cursor, back: true };
      else if (btn === 'X') return { type: 'hint' };
      else if (btn === 'Y') return { type: 'undo' };
      render();
      return null;
    },
    overHtml: function (v) {
      if (!v.won) return '';
      const help = v.hints ? ' (with ' + v.hints + ' hint' + (v.hints > 1 ? 's' : '') + ')' : '';
      if (!v.level) return 'The loop is closed' + help + ' ➰';
      const par = v.elapsed <= v.par * 1000 ? ', inside par! 🎉' : '';
      return 'Level ' + v.level + ' solved' + help + par + (v.level < v.levels ? ' · Level ' + (v.level + 1) + ' is open now' : ' · that was the last one! 🏆');
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'sl-host';
      root.innerHTML = '<div class="sl-top"></div><div class="sl-wrap"><div class="sl-board"></div></div><div class="sl-rules">One closed loop · never crossing or touching itself · each number counts its square\'s sides on the loop</div>';
      el.appendChild(root);
      ready.then(render);
    },
    update: function (v) {
      if (!view || v.w !== view.w) cursor = 0;
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      key = '';
    },
  });
})();
