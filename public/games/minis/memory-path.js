// Memory Path (server/games/minis/memory-path.js): watch the path, then repeat it.
(function () {
  const STEP_MS = 600; // as TIMING.stepMs on the server
  const cursors = [4, 4];

  /** Which tile is lit while the path is shown (-1: none), from when this screen saw it start. */
  function showing() {
    let key = null;
    let at = 0;
    return function (s) {
      if (s.stage !== 'show') { key = null; return -1; }
      const k = s.length + ':' + s.seq.join('');
      if (k !== key) { key = k; at = performance.now(); }
      const i = Math.floor((performance.now() - at) / STEP_MS);
      return i < s.seq.length && (performance.now() - at) % STEP_MS < STEP_MS * 0.8 ? s.seq[i] : -1;
    };
  }

  function grid(lit, cur, buttons, disabled) {
    let h = '<div class="mi-tiles">';
    for (let i = 0; i < 9; i++) {
      const cls = (i === lit ? ' lit' : '') + (i === cur ? ' cur' : '');
      h += buttons ? '<button class="tile' + cls + '" data-i="' + i + '"' + (disabled ? ' disabled' : '') + '></button>' : '<span class="tile' + cls + '"></span>';
    }
    return h + '</div>';
  }

  function progress(s, slot) {
    if (s.out[slot]) return '<b class="mi-bad">✖ Slipped</b>';
    if (s.finished[slot]) return '<b class="mi-ok">✔ Done</b>';
    return s.stage === 'input' ? s.step[slot] + ' / ' + s.length : 'Watch…';
  }

  let host = null;
  let phone = null;

  ArkMini.register('memory-path', {
    host: {
      mount: function (el, mctx) {
        cursors[0] = cursors[1] = 4;
        el.innerHTML = '<div class="mi-memory"><div class="mi-side p1"></div><div class="mid"></div><div class="mi-side p2"></div></div>';
        host = { el: el.firstChild, players: mctx.players, s: null, lit: showing() };
        host.raf = requestAnimationFrame(function frame() {
          host.raf = requestAnimationFrame(frame);
          if (!host.s) return;
          const s = host.s;
          const lit = host.lit(s);
          const key = JSON.stringify([lit, s.stage, s.length, s.step, s.out, s.finished, cursors]);
          if (key === host.drawn) return;
          host.drawn = key;
          host.el.querySelector('.mid').innerHTML = '<div class="len">Path of ' + s.length + '</div>' + grid(lit, -1, false);
          host.el.querySelectorAll('.mi-side').forEach(function (side, slot) {
            const local = host.players[slot] && host.players[slot].local;
            side.innerHTML = '<div class="who">' + ArkMini.nameOf({ players: host.players }, slot) + '</div><div class="prog">' + progress(s, slot) + '</div>' +
              (local && s.stage === 'input' ? grid(-1, cursors[slot], false) : '');
          });
        });
      },
      update: function (s) { if (host) host.s = s; },
      unmount: function () { if (host) cancelAnimationFrame(host.raf); host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-memory-phone"><div class="prog"></div><div class="g"></div></div>';
        phone = { el: el, slot: mctx.slot, s: null, lit: showing(), drawn: '' };
        el.addEventListener('pointerdown', function (e) {
          const b = e.target.closest('[data-i]');
          if (!b || b.disabled) return;
          mctx.send({ type: 'cell', i: Number(b.getAttribute('data-i')) });
          mctx.vibrate(10);
          b.classList.add('lit');
          setTimeout(function () { b.classList.remove('lit'); }, 150);
        });
        phone.raf = requestAnimationFrame(function frame() {
          phone.raf = requestAnimationFrame(frame);
          if (!phone.s) return;
          const s = phone.s;
          const lit = phone.lit(s);
          const done = s.stage !== 'input' || s.out[phone.slot] || s.finished[phone.slot];
          const key = [lit, s.stage, done, s.step[phone.slot]].join();
          if (key === phone.drawn) return;
          phone.drawn = key;
          phone.el.querySelector('.prog').innerHTML = s.stage === 'show' ? 'Watch the path…' : progress(s, phone.slot);
          phone.el.querySelector('.g').innerHTML = grid(lit, -1, true, done);
        });
      },
      update: function (s) { if (phone) phone.s = s; },
      unmount: function () { if (phone) cancelAnimationFrame(phone.raf); phone = null; },
    },
    pad: function (btn, s, slot) {
      if (s.stage !== 'input') return null;
      if (btn === 'A') return { type: 'cell', i: cursors[slot] };
      cursors[slot] = ArkMini.moveCursor(cursors[slot], btn, 9, 3);
      return null;
    },
  });
})();
