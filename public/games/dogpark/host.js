(function () {
  Ark.loadCss('/games/dogpark/style.css');
  const ready = Ark.loadScript('/games/dogpark/board.js');

  let root = null;
  let view = null;
  let key = '';
  let cursor = 0; // a controller's square

  function render() {
    const v = view;
    if (!v || !root || !window.ArkDogPark) return;
    const local = v.player && v.player.local && v.phase === 'play';
    const top = root.querySelector('.dgp-top');
    top.innerHTML =
      '<span>' + (v.level ? 'Level <strong>' + v.level + '</strong>' + (v.expert ? ' · Expert' : '') : 'Random') + ' · ' + v.n + ' × ' + v.n + '</span>' +
      '<span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong>' + (v.par ? ' / par ' + window.ArkDogPark.par(v.par) : '') + '</span>' +
      '<span>' + window.ArkDogPark.art(v.look).dog.replace('<svg', '<svg width="1.2em" height="1.2em" style="vertical-align:-0.2em"') + ' <strong>' + v.dogs + '</strong> / ' + v.n + '</span>' +
      (v.phase === 'paused' ? '<span class="dgp-paused">⏸ Paused</span>' : '');
    const k = JSON.stringify([v.marks, v.regions, v.clashes, v.hint, v.phase, v.look, local && cursor]);
    if (k === key) return;
    key = k;
    const park = root.querySelector('.dgp-park');
    park.style.setProperty('--n', v.n);
    park.classList.toggle('won', v.won);
    park.innerHTML = window.ArkDogPark.html(v, { cursor: local ? cursor : null });
  }

  Ark.register('host', 'dogpark', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return v.won ? ['fanfare'] : [];
      if (v.hintNo > prev.hintNo) return ['reveal'];
      if (v.clashes.length > prev.clashes.length) return ['wrong'];
      if (v.dogs > prev.dogs) return ['flag'];
      if (JSON.stringify(v.marks) !== JSON.stringify(prev.marks)) return ['tick'];
      return [];
    },
    padHint: 'D-pad move · A ball / dog / empty · B empty · LB or RB (F) fill balls · X (Q) hint +30 s · Y (E) undo · Start (P) pause',
    pad: function (btn, v) {
      if (btn === 'START') return { type: 'pause' };
      if (v.phase !== 'play') return null;
      const n = v.n;
      const x = cursor % n;
      const y = Math.floor(cursor / n);
      if (btn === 'LEFT') cursor = y * n + ((x + n - 1) % n);
      else if (btn === 'RIGHT') cursor = y * n + ((x + 1) % n);
      else if (btn === 'UP') cursor = ((y + n - 1) % n) * n + x;
      else if (btn === 'DOWN') cursor = ((y + 1) % n) * n + x;
      else if (btn === 'A') return { type: 'tap', cell: cursor };
      else if (btn === 'B') return { type: 'mark', cell: cursor, mark: 0 };
      else if (btn === 'X') return { type: 'hint' };
      else if (btn === 'Y') return { type: 'undo' };
      else if (btn === 'LB' || btn === 'RB') return { type: 'fill' };
      render();
      return null;
    },
    typing: function (k, v) {
      if (v.phase !== 'play') return null;
      if (k === 'f' || k === 'F') return { type: 'fill' };
      return null;
    },
    overHtml: function (v) {
      if (!v.won) return '';
      const help = v.hints ? ' (with ' + v.hints + ' hint' + (v.hints > 1 ? 's' : '') + ')' : '';
      if (!v.level) return 'Every dog in its spot' + help + ' 🐾';
      const par = v.elapsed <= v.par * 1000 ? ', inside par! 🎉' : '';
      return 'Level ' + v.level + ' solved' + help + par + (v.level < v.levels ? ' · Level ' + (v.level + 1) + ' is open now' : ' · that was the last one! 🏆');
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'dgp-host';
      root.innerHTML = '<div class="dgp-top"></div><div class="dgp-wrap"><div class="dgp-park"></div></div><div class="dgp-rules"></div>';
      el.appendChild(root);
      ready.then(function () {
        root.querySelector('.dgp-rules').textContent = window.ArkDogPark.RULES;
        render();
      });
    },
    update: function (v) {
      if (!view || v.n !== view.n) cursor = Math.floor((v.n * v.n) / 2);
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      key = '';
    },
  });
})();
