(function () {
  Ark.loadCss('/games/flood/style.css');
  const ready = Ark.loadScript('/games/flood/board.js');

  let root = null;
  let view = null;
  let key = '';
  let cursor = 0;

  function render() {
    const v = view;
    if (!v || !root || !window.ArkFlood) return;
    const local = v.player && v.player.local && v.phase === 'play';
    const k = JSON.stringify([v.board, v.moves, v.phase, local && cursor]);
    if (k === key) return;
    key = k;
    root.querySelector('.fld-top').innerHTML = window.ArkFlood.info(v);
    window.ArkFlood.draw(root.querySelector('canvas'), v);
    root.querySelector('.fld-keys').innerHTML = window.ArkFlood.buttons(v, local ? cursor : -1);
  }

  Ark.register('host', 'flood', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return [v.won ? 'fanfare' : 'end'];
      if (v.moves > prev.moves) return ['drop'];
      return [];
    },
    padHint: '← → pick a colour · A flood with it · keyboard: 1–6',
    pad: function (btn, v) {
      if (v.phase !== 'play') return null;
      if (btn === 'LEFT') cursor = (cursor + v.colours - 1) % v.colours;
      else if (btn === 'RIGHT') cursor = (cursor + 1) % v.colours;
      else if (btn === 'A') return { type: 'pick', colour: cursor };
      render();
      return null;
    },
    typing: function (k, v) {
      if (v.phase !== 'play' || !/^[1-6]$/.test(k)) return null;
      return { type: 'pick', colour: Number(k) - 1 };
    },
    overHtml: function (v) {
      return v.won ? 'Flooded the ' + v.variant + ' board in ' + v.moves + ' moves (a greedy player needs ' + v.par + ')' : 'Out of moves: a lost game doesn\'t count';
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'fld-host';
      root.innerHTML = '<div class="fld-top"></div><canvas class="fld-canvas"></canvas><div class="fld-keys"></div>';
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
      cursor = 0;
    },
  });
})();
