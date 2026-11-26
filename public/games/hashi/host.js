(function () {
  Ark.loadCss('/games/hashi/style.css');
  const ready = Ark.loadScript('/games/hashi/board.js');

  let root = null;
  let view = null;
  let key = '';
  let cursor = 0;
  let picked = null;

  function render() {
    const v = view;
    if (!v || !root || !window.ArkHashi) return;
    const local = v.player && v.player.local && v.phase === 'play';
    const done = v.counts.filter(function (c, k) { return c === v.numbers[k]; }).length;
    root.querySelector('.hs-top').innerHTML =
      '<span>' + (v.level ? 'Level <strong>' + v.level + '</strong>' : 'Random') + ' · ' + v.w + ' × ' + v.h + '</span>' +
      '<span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong>' + (v.par ? ' / par ' + Ark.clock(v.par * 1000) : '') + '</span>' +
      '<span>🏝️ <strong>' + done + '</strong> / ' + v.islands.length + '</span>' +
      (v.phase === 'paused' ? '<span class="hs-paused">⏸ Paused</span>' : '');
    const k = JSON.stringify([v.bridges, v.islands, v.hint, v.phase, local && cursor, local && picked]);
    if (k === key) return;
    key = k;
    const board = root.querySelector('.hs-board');
    board.style.setProperty('--ratio', v.w / v.h);
    board.classList.toggle('won', v.won);
    board.innerHTML = window.ArkHashi.svg(v, local ? { cursor: cursor, picked: picked } : null);
  }

  Ark.register('host', 'hashi', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return v.won ? ['fanfare'] : [];
      if (v.hintNo > prev.hintNo) return ['reveal'];
      if (JSON.stringify(v.bridges) !== JSON.stringify(prev.bridges)) return ['knock'];
      return [];
    },
    padHint: 'D-pad move between islands · A pick one, then a D-pad way adds a bridge (again for two, again for none) · B let go · X (Q) hint +30 s · Y (E) undo · Start (P) pause',
    pad: function (btn, v) {
      if (btn === 'START') return { type: 'pause' };
      if (v.phase !== 'play' || !v.islands.length) return null;
      const dir = { LEFT: [-1, 0], RIGHT: [1, 0], UP: [0, -1], DOWN: [0, 1] }[btn];
      if (dir && picked !== null) {
        const o = window.ArkHashi.neighbour(v, picked, dir[0], dir[1]);
        return o === null ? null : { type: 'bridge', a: picked, b: o };
      }
      if (dir) cursor = window.ArkHashi.step(v, cursor, dir[0], dir[1]);
      else if (btn === 'A') picked = picked === cursor ? null : cursor;
      else if (btn === 'B') picked = null;
      else if (btn === 'X') return { type: 'hint' };
      else if (btn === 'Y') return { type: 'undo' };
      render();
      return null;
    },
    overHtml: function (v) {
      if (!v.won) return '';
      const help = v.hints ? ' (with ' + v.hints + ' hint' + (v.hints > 1 ? 's' : '') + ')' : '';
      if (!v.level) return 'Every island joined up' + help + ' 🌉';
      const par = v.elapsed <= v.par * 1000 ? ', inside par! 🎉' : '';
      return 'Level ' + v.level + ' solved' + help + par + (v.level < v.levels ? ' · Level ' + (v.level + 1) + ' is open now' : ' · that was the last one! 🏆');
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'hs-host';
      root.innerHTML = '<div class="hs-top"></div><div class="hs-wrap"><div class="hs-board"></div></div><div class="hs-rules">As many bridges as each number · one or two between two islands · no crossing · all joined up</div>';
      el.appendChild(root);
      ready.then(render);
    },
    update: function (v) {
      if (!view || v.level !== view.level || v.islands.length !== view.islands.length) { cursor = 0; picked = null; }
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      picked = null;
      key = '';
    },
  });
})();
