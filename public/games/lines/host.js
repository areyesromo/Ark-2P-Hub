(function () {
  Ark.loadCss('/games/lines/style.css');
  const ready = Ark.loadScript('/games/lines/board.js');

  let root = null;
  let view = null;
  let key = '';
  let cursor = 40;
  let sel = -1; // the ball picked up

  function render() {
    const v = view;
    if (!v || !root || !window.ArkLines) return;
    if (v.phase !== 'play' || (sel >= 0 && v.board[sel] === null)) sel = -1;
    const local = v.player && v.player.local && v.phase === 'play';
    const k = JSON.stringify([v.board, v.next, v.points, v.phase, sel, local && cursor]);
    if (k === key) return;
    key = k;
    root.querySelector('.ln-top').innerHTML = '<span>Points <strong>' + v.points + '</strong></span><span class="ln-next">' + window.ArkLines.next(v) + '</span>';
    root.querySelector('.ln-board').innerHTML = window.ArkLines.board(v, sel, local ? cursor : -1);
  }

  Ark.register('host', 'lines', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return ['end'];
      if (v.cleared > prev.cleared) return ['correct'];
      if (v.board !== prev.board && JSON.stringify(v.board) !== JSON.stringify(prev.board)) return ['slide'];
      return [];
    },
    padHint: 'D-pad move the cursor · A pick up a ball, then A on an empty square to send it there · B put it down',
    pad: function (btn, v) {
      if (v.phase !== 'play') return null;
      const n = v.n;
      const x = cursor % n;
      const y = Math.floor(cursor / n);
      if (btn === 'LEFT') cursor = y * n + (x + n - 1) % n;
      else if (btn === 'RIGHT') cursor = y * n + (x + 1) % n;
      else if (btn === 'UP') cursor = ((y + n - 1) % n) * n + x;
      else if (btn === 'DOWN') cursor = ((y + 1) % n) * n + x;
      else if (btn === 'B') sel = -1;
      else if (btn === 'A') {
        if (v.board[cursor] !== null) sel = cursor;
        else if (sel >= 0) {
          const input = { type: 'move', from: sel, to: cursor };
          sel = -1;
          return input;
        }
      }
      render();
      return null;
    },
    overHtml: function (v) {
      return 'The board filled up with ' + v.points + ' points';
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'ln-host';
      root.innerHTML = '<div class="ln-top"></div><div class="ln-board"></div>';
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
      cursor = 40;
      sel = -1;
    },
  });
})();
