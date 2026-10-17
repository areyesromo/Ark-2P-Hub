// TAP IT! (server/games/minis/tap-it.js) Phones tap the drifting target;
// controllers steer a cursor with the stick / D-pad and press A.
(function () {
  // Same as targetAt in server/games/minis/tap-it.js.
  function targetAt(ms, seed) {
    const a = (seed % 628) / 100;
    return { x: 0.5 + 0.35 * Math.sin(ms / 700 + a), y: 0.5 + 0.35 * Math.sin(ms / 530 + a * 1.7) };
  }
  const cursors = [{ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }];
  const STEP = 0.025;

  function place(el, p, size) {
    el.style.left = 'calc(' + p.x * 100 + '% - ' + size / 2 + 'px)';
    el.style.top = 'calc(' + p.y * 100 + '% - ' + size / 2 + 'px)';
  }

  /** An arena with the target (and optional cursor), animated each frame. */
  function arena(el, mctx, withCursor, slot) {
    el.innerHTML = '<div class="mi-arena"><span class="tgt">🎯</span>' + (withCursor ? '<span class="cur">✛</span>' : '') + '</div>';
    const box = el.querySelector('.mi-arena');
    const tgt = box.querySelector('.tgt');
    const cur = box.querySelector('.cur');
    let state = null;
    let raf = requestAnimationFrame(function frame() {
      raf = requestAnimationFrame(frame);
      if (!state) return;
      const size = tgt.offsetWidth || 60;
      place(tgt, targetAt(mctx.t(), state.seed), size);
      if (cur) place(cur, cursors[slot], cur.offsetWidth || 40);
    });
    return {
      box: box,
      update: function (s) { state = s; box.classList.toggle('done', s.res[slot] !== null); box.classList.toggle('hit', s.res[slot] === true); },
      stop: function () { cancelAnimationFrame(raf); },
    };
  }

  let hostParts = [];
  let phonePart = null;

  ArkMini.register('tap-it', {
    host: {
      mount: function (el, mctx) {
        cursors[0] = { x: 0.5, y: 0.5 };
        cursors[1] = { x: 0.5, y: 0.5 };
        el.innerHTML = '<div class="mi-split"><div class="mi-side p1"></div><div class="mi-side p2"></div></div>';
        hostParts = [0, 1].map(function (s) {
          const side = el.querySelectorAll('.mi-side')[s];
          const local = mctx.players[s] && mctx.players[s].local;
          return arena(side, mctx, local, s);
        });
      },
      update: function (s) { hostParts.forEach(function (p) { p.update(s); }); },
      unmount: function () { hostParts.forEach(function (p) { p.stop(); }); hostParts = []; },
    },
    phone: {
      mount: function (el, mctx) {
        phonePart = arena(el, mctx, false, mctx.slot);
        phonePart.box.addEventListener('pointerdown', function (e) {
          const r = phonePart.box.getBoundingClientRect();
          mctx.send({ type: 'tap', x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height });
        });
      },
      update: function (s) { if (phonePart) phonePart.update(s); },
      unmount: function () { if (phonePart) phonePart.stop(); phonePart = null; },
    },
    pad: function (btn, s, slot) {
      return btn === 'A' ? { type: 'tap', x: cursors[slot].x, y: cursors[slot].y } : null;
    },
    padPoll: function (pad, s, slot) {
      const c = cursors[slot];
      let dx = Math.abs(pad.stick.x) > 0.2 ? pad.stick.x : 0;
      let dy = Math.abs(pad.stick.y) > 0.2 ? pad.stick.y : 0;
      if (pad.held.indexOf('LEFT') !== -1) dx = -1;
      if (pad.held.indexOf('RIGHT') !== -1) dx = 1;
      if (pad.held.indexOf('UP') !== -1) dy = -1;
      if (pad.held.indexOf('DOWN') !== -1) dy = 1;
      c.x = Math.min(1, Math.max(0, c.x + dx * STEP));
      c.y = Math.min(1, Math.max(0, c.y + dy * STEP));
      return null;
    },
  });
})();
