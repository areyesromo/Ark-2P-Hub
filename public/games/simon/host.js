(function () {
  Ark.loadCss('/games/simon/style.css');
  // Controller: the face buttons match the pads by colour (A green, B red, Y yellow, X blue),
  // and the D-pad by position (↑ green, → red, ← yellow, ↓ blue). Keyboard: the arrows.
  const PAD_OF = { A: 0, B: 1, Y: 2, X: 3, UP: 0, RIGHT: 1, LEFT: 2, DOWN: 3 };

  let root = null;
  let pads = null;
  let msg = null;
  let flash = null; // { pad, until } a press lighting its pad for a moment
  let flashTimer = null;
  let view = null;

  function render() {
    const v = view;
    const lit = v.lit !== null ? v.lit : flash ? flash.pad : null;
    pads.forEach(function (el, i) {
      el.classList.toggle('lit', lit === i);
      el.classList.toggle('expected', v.phase === 'over' && v.expected === i);
      el.classList.toggle('wrong', v.phase === 'over' && v.wrong === i);
    });
    let text = '';
    if (v.phase === 'ready') text = 'Watch closely…';
    else if (v.phase === 'show') text = 'Watch: ' + v.length + (v.length === 1 ? ' pad' : ' pads');
    else if (v.phase === 'repeat') text = 'Your turn · ' + v.step + ' / ' + v.length;
    else if (v.phase === 'right') text = '✓ Right! One more…';
    else if (v.phase === 'over') text = v.timedOut ? '⏱ Too slow' : '✗ Wrong pad';
    msg.textContent = text;
    root.querySelector('.count').textContent = v.score;
  }

  Ark.register('host', 'simon', {
    sounds: function (prev, v) {
      const out = [];
      if (v.lit !== null && v.lit !== prev.lit) out.push('pad' + v.lit);
      if (v.pressed && (!prev.pressed || v.pressed.n !== prev.pressed.n) && v.phase !== 'over') out.push('pad' + v.pressed.pad);
      if (v.phase === 'over' && prev.phase !== 'over') out.push('wrong');
      return out;
    },
    padHint: 'A green · B red · Y yellow · X blue (or the D-pad / arrows by position)',
    pad: function (btn, v) {
      return v.phase === 'repeat' && PAD_OF[btn] !== undefined ? { type: 'press', pad: PAD_OF[btn] } : null;
    },
    overHtml: function (v) {
      return v.score === 1 ? '1 sequence repeated' : v.score + ' sequences repeated';
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'simon-host';
      root.innerHTML =
        '<div class="simon-wrap"><div class="simon-board">' +
        '<div class="pad p0"></div><div class="pad p1"></div><div class="pad p2"></div><div class="pad p3"></div>' +
        '<div class="hub"><span class="count">0</span><span class="label">in a row</span></div>' +
        '</div></div><div class="simon-msg"></div>';
      el.appendChild(root);
      pads = Array.prototype.slice.call(root.querySelectorAll('.pad'));
      msg = root.querySelector('.simon-msg');
    },
    update: function (v) {
      if (root) root.setAttribute('data-look', v.look || 'classic');
      // A press lights its pad for a moment (the server only says which pad, not for how long).
      if (v.pressed && (!view || !view.pressed || v.pressed.n !== view.pressed.n)) {
        flash = { pad: v.pressed.pad };
        clearTimeout(flashTimer);
        flashTimer = setTimeout(function () { flash = null; if (view) render(); }, 220);
      }
      view = v;
      render();
    },
    unmount: function () {
      clearTimeout(flashTimer);
      root = pads = msg = view = flash = null;
    },
  });
})();
