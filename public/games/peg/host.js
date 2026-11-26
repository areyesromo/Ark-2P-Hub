(function () {
  Ark.loadCss('/games/peg/style.css');
  const ready = Ark.loadScript('/games/peg/board.js');

  let root = null;
  let view = null;
  let key = '';
  let cursor = 24;
  let picked = null; // a controller's picked peg

  function note(v) {
    if (v.stuck) return 'No way down to one peg from here: ↶ undo a few';
    if (v.busy) return 'Too many ways to look through yet: try a few more jumps';
    if (v.hint) return '💡 Jump the glowing peg into the ringed hole';
    return 'Jump a peg over its neighbour into an empty hole · finish with one';
  }

  function render() {
    const v = view;
    if (!v || !root || !window.ArkPeg) return;
    const local = v.player && v.player.local && v.phase === 'play';
    root.querySelector('.pg-top').innerHTML =
      '<span><strong>' + v.boardName + '</strong></span>' +
      '<span>Pegs left <strong>' + v.left + '</strong> / ' + v.start + '</span>' +
      (v.hints ? '<span>💡 ' + v.hints + '</span>' : '');
    root.querySelector('.pg-rules').textContent = note(v);
    const k = JSON.stringify([v.pegs, v.jumps, v.hint, v.phase, local && cursor, local && picked]);
    if (k === key) return;
    key = k;
    const board = root.querySelector('.pg-board');
    board.classList.toggle('won', v.perfect);
    board.innerHTML = window.ArkPeg.html(v, local ? { cursor: cursor, picked: picked } : null);
  }

  Ark.register('host', 'peg', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return [v.left === 1 ? 'fanfare' : 'reveal'];
      if (v.hintNo > prev.hintNo) return ['reveal'];
      if (v.left < prev.left) return ['knock'];
      if (v.left > prev.left) return ['tick'];
      return [];
    },
    padHint: 'D-pad move · A pick a peg, A on a ringed hole jumps · B put it down · X (Q) hint · Y (E) undo · LB start again',
    pad: function (btn, v) {
      if (btn === 'Y') return { type: 'undo' };
      if (v.phase !== 'play') return null;
      const x = cursor % 7;
      const y = Math.floor(cursor / 7);
      const has = function (i) { return v.holes.indexOf(i) >= 0; };
      const go = function (dx, dy) {
        // To the next hole that way (the corners have none).
        for (let k = 1; k < 7; k++) {
          const xx = x + dx * k;
          const yy = y + dy * k;
          if (xx < 0 || yy < 0 || xx > 6 || yy > 6) return;
          if (has(yy * 7 + xx)) { cursor = yy * 7 + xx; return; }
        }
      };
      if (btn === 'LEFT') go(-1, 0);
      else if (btn === 'RIGHT') go(1, 0);
      else if (btn === 'UP') go(0, -1);
      else if (btn === 'DOWN') go(0, 1);
      else if (btn === 'A') {
        if (picked !== null && v.jumps.some(function (j) { return j[0] === picked && j[1] === cursor; })) {
          const move = { type: 'jump', from: picked, to: cursor };
          picked = null;
          return move;
        }
        picked = v.jumps.some(function (j) { return j[0] === cursor; }) ? cursor : null;
      } else if (btn === 'B') picked = null;
      else if (btn === 'X') return { type: 'hint' };
      else if (btn === 'LB') return { type: 'restart' };
      render();
      return null;
    },
    overHtml: function (v) {
      if (v.perfect) return 'One peg, right in the middle: a perfect game! 🎯';
      if (v.left === 1) return 'Down to one peg! 📍';
      return v.left + ' pegs left with no jump to make' + (v.canUndo ? ' (↶ undo for one more go)' : '');
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'pg-host';
      root.innerHTML = '<div class="pg-top"></div><div class="pg-wrap"><div class="pg-board"></div></div><div class="pg-rules"></div>';
      el.appendChild(root);
      ready.then(render);
    },
    update: function (v) {
      if (view && JSON.stringify(view.pegs) !== JSON.stringify(v.pegs)) picked = null;
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
