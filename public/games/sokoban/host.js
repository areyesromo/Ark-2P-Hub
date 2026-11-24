(function () {
  Ark.loadCss('/games/sokoban/style.css');
  const ready = Ark.loadScript('/games/sokoban/board.js');
  const DIRS = { UP: 'up', DOWN: 'down', LEFT: 'left', RIGHT: 'right' };

  let root = null;
  let view = null;
  let key = '';

  function render() {
    const v = view;
    if (!v || !root || !window.ArkSokoban) return;
    const k = JSON.stringify([v.boxes, v.worker, v.moves, v.levelNo, Math.floor(v.elapsed / 1000)]);
    if (k === key) return;
    key = k;
    root.querySelector('.sk-stats').innerHTML = '<span>Level <strong>' + v.levelNo + '</strong> / ' + v.levels + '</span>' +
      '<span><strong>' + v.moves + '</strong> ' + (v.moves === 1 ? 'move' : 'moves') + ' <span class="muted">· par ' + v.par + '</span></span>' +
      '<span>📦 <strong>' + v.onTarget + '</strong> / ' + v.boxes.length + '</span>';
    root.querySelector('.sk-field').innerHTML = window.ArkSokoban.html(v);
  }

  Ark.register('host', 'sokoban', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return ['fanfare'];
      if (v.onTarget > prev.onTarget) return ['lock'];
      if (v.pushes !== prev.pushes) return ['slide'];
      return [];
    },
    padHint: 'D-pad / arrows walk and push · Y / E undo · X / Q start the level again',
    pad: function (btn, v) {
      if (v.phase !== 'play') return null;
      if (DIRS[btn]) return { type: 'move', dir: DIRS[btn] };
      if (btn === 'Y' || btn === 'B') return { type: 'undo' };
      if (btn === 'X') return { type: 'restart' };
      return null;
    },
    overHtml: function (v) {
      return 'Level ' + v.levelNo + ' in ' + v.moves + ' moves' + (v.moves <= v.par ? ' · on par! ⭐' : ' · par is ' + v.par) +
        (v.levelNo < v.levels ? ' · level ' + (v.levelNo + 1) + ' is open (🎮 Y: settings)' : ' · that was the last one!');
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'sk-host';
      root.innerHTML = '<div class="sk-stats"></div><div class="sk-field"></div>';
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
