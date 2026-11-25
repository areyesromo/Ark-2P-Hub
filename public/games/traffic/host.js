(function () {
  Ark.loadCss('/games/traffic/style.css');
  const ready = Ark.loadScript('/games/traffic/board.js');

  let root = null;
  let view = null;
  let key = '';
  let cursor = 0; // a controller's square
  let grabbed = null; // the vehicle a controller has picked up, and where it's being slid to
  let ghost = 0;

  function render() {
    const v = view;
    if (!v || !root || !window.ArkTraffic) return;
    const local = v.player && v.player.local && v.phase === 'play';
    root.querySelector('.tj-top').innerHTML =
      '<span>' + (v.level ? 'Level <strong>' + v.level + '</strong>' : 'Random') + '</span>' +
      '<span>Moves <strong>' + v.moves + '</strong> / par ' + v.par + '</span>' +
      (v.hints ? '<span>💡 ' + v.hints + '</span>' : '');
    const k = JSON.stringify([v.cars, v.hint, v.hintNo, v.phase, local && cursor, grabbed, ghost]);
    if (k === key) return;
    key = k;
    const lot = root.querySelector('.tj-lot');
    lot.style.setProperty('--n', v.size);
    lot.innerHTML = window.ArkTraffic.html(v, local ? { cursor: cursor, grabbed: grabbed, ghost: ghost } : null);
  }

  Ark.register('host', 'traffic', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return v.won ? ['fanfare'] : [];
      if (v.hintNo > prev.hintNo) return ['reveal'];
      if (v.moves !== prev.moves) return ['knock'];
      return [];
    },
    padHint: 'D-pad move · A pick up a vehicle, D-pad slides it, A puts it down · B lets go · X (Q) hint +2 · Y (E) undo · LB start again',
    pad: function (btn, v) {
      if (v.phase !== 'play') return null;
      const n = v.size;
      if (grabbed !== null) {
        const c = v.cars[grabbed];
        const r = window.ArkTraffic.range(v, grabbed);
        const back = c.across ? btn === 'LEFT' : btn === 'UP';
        const on = c.across ? btn === 'RIGHT' : btn === 'DOWN';
        if (back) ghost = Math.max(r[0], ghost - 1);
        else if (on) ghost = Math.min(r[1], ghost + 1);
        else if (btn === 'A') {
          const from = c.across ? c.x : c.y;
          const move = ghost !== from ? { type: 'move', car: grabbed, to: ghost } : null;
          cursor = (c.across ? c.y : ghost) * n + (c.across ? ghost : c.x);
          grabbed = null;
          render();
          return move;
        } else if (btn === 'B') grabbed = null;
        render();
        return null;
      }
      const x = cursor % n;
      const y = Math.floor(cursor / n);
      if (btn === 'LEFT') cursor = y * n + ((x + n - 1) % n);
      else if (btn === 'RIGHT') cursor = y * n + ((x + 1) % n);
      else if (btn === 'UP') cursor = ((y + n - 1) % n) * n + x;
      else if (btn === 'DOWN') cursor = ((y + 1) % n) * n + x;
      else if (btn === 'A') {
        const i = window.ArkTraffic.grid(v)[cursor];
        if (i >= 0) {
          grabbed = i;
          ghost = v.cars[i].across ? v.cars[i].x : v.cars[i].y;
        }
      } else if (btn === 'X') return { type: 'hint' };
      else if (btn === 'Y') return { type: 'undo' };
      else if (btn === 'LB') return { type: 'restart' };
      render();
      return null;
    },
    overHtml: function (v) {
      if (!v.won) return '';
      const star = v.starred ? ' ⭐ In par!' : v.hints ? ' (with ' + v.hints + ' hint' + (v.hints > 1 ? 's' : '') + ')' : ' · par is ' + v.par;
      if (!v.level) return 'Out of the jam in ' + v.moves + ' moves' + star;
      return 'Level ' + v.level + ' in ' + v.moves + ' moves' + star + (v.level < v.levels ? ' · Level ' + (v.level + 1) + ' is open now' : ' · that was the last one! 🏆');
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'tj-host';
      root.innerHTML = '<div class="tj-top"></div><div class="tj-wrap"><div class="tj-lot"></div></div><div class="tj-rules">Slide the cars and trucks along their lanes · get the red car out on the right</div>';
      el.appendChild(root);
      ready.then(render);
    },
    update: function (v) {
      if (!view || v.level !== view.level) cursor = v.exitRow * v.size;
      if (view && JSON.stringify(view.cars) !== JSON.stringify(v.cars)) grabbed = null;
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      grabbed = null;
      key = '';
    },
  });
})();
