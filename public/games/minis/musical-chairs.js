// Musical Chairs (server/games/minis/musical-chairs.js): on the TV the two of you circle a chair
// while the notes float up; STOP! and the quicker one sits. Each screen times its own reaction from
// when it showed the stop (`rt`; -1 if you sat before it did). Phones: a big SIT; controllers: A.
(function () {
  let host = null;
  let tvStopShown = null; // (the TV's own stop moment, for controller players' reactions)
  let tvStopRound = -1;

  function tvSeen(s) {
    if (s.stage === 'stopped' && tvStopRound !== s.round) {
      tvStopRound = s.round;
      tvStopShown = performance.now();
    }
    if (s.stage !== 'stopped') tvStopShown = null;
  }

  function frame() {
    if (!host) return;
    host.raf = requestAnimationFrame(frame);
    const s = host.s;
    if (!s) return;
    // While the music plays, round and round; stopped, they stand.
    const playing = s.stage === 'music';
    host.angle += playing ? 0.025 : 0;
    const t = host.mctx.t();
    [0, 1].forEach(function (i) {
      const a = host.angle + i * Math.PI;
      const el = host.walkers[i];
      const tripped = t < s.trippedUntil[i];
      el.style.transform = 'translate(-50%, -50%) translate(' + (Math.cos(a) * 34) + 'vmin, ' + (Math.sin(a) * 14) + 'vmin)' + (tripped ? ' rotate(80deg)' : '');
      el.classList.toggle('tripped', tripped);
    });
  }

  ArkMini.register('musical-chairs', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-chairs"><div class="ring"></div><div class="chair">🪑</div>' +
          '<div class="walker w0">' + ArkMini.nameOf({ players: mctx.players }, 0) + '</div><div class="walker w1">' + ArkMini.nameOf({ players: mctx.players }, 1) + '</div>' +
          '<div class="notes">🎵 🎶 🎵</div><div class="big"></div><div class="score"></div></div>';
        host = { el: el, mctx: mctx, s: null, angle: 0, walkers: [el.querySelector('.w0'), el.querySelector('.w1')], raf: null };
        host.raf = requestAnimationFrame(frame);
      },
      update: function (s) {
        if (!host) return;
        host.s = s;
        tvSeen(s);
        const el = host.el.querySelector('.mi-chairs');
        el.setAttribute('data-stage', s.stage);
        const big = s.stage === 'stopped' ? 'STOP!' : s.stage === 'dip' ? '⏸…' : s.stage === 'done' && s.last ? (s.last.winner === null ? 'Nobody sat!' : ArkMini.nameOf({ players: host.mctx.players }, s.last.winner) + ' sits!') : '';
        host.el.querySelector('.big').innerHTML = big;
        host.el.querySelector('.score').innerHTML = 'Round ' + s.round + ' · first to ' + s.need + ' · ' + s.wins[0] + ' – ' + s.wins[1];
      },
      unmount: function () { if (host) cancelAnimationFrame(host.raf); host = null; tvStopShown = null; tvStopRound = -1; },
    },
    phone: (function () {
      let phone = null;
      return {
        mount: function (el, mctx) {
          el.innerHTML = '<div class="mi-phone-stage"><div class="msg"></div><button class="primary mi-big-btn mi-sit">🪑 SIT!</button></div>';
          phone = { el: el, slot: mctx.slot, s: null, stopShown: null, round: -1 };
          const p = phone;
          el.querySelector('.mi-sit').addEventListener('pointerdown', function (e) {
            e.preventDefault();
            if (!p.s) return;
            const rt = p.s.stage === 'stopped' && p.stopShown !== null ? Math.round(performance.now() - p.stopShown) : -1;
            mctx.send({ type: 'sit', rt: rt });
            mctx.vibrate(rt < 0 ? [60, 40, 60] : 20);
          });
        },
        update: function (s) {
          if (!phone) return;
          const p = phone;
          p.s = s;
          if (s.stage === 'stopped' && p.round !== s.round) {
            p.round = s.round;
            p.stopShown = performance.now();
          }
          if (s.stage !== 'stopped') p.stopShown = null;
          const me = p.slot;
          const msg = s.stage === 'stopped' ? (s.sat[me] ? 'Sat! Waiting…' : 'STOP! Sit now!') : s.stage === 'done' && s.last ? (s.last.winner === me ? '🪑 You got the chair!' : s.last.winner === null ? 'Nobody sat' : 'They got it') : '🎵 Music… wait for it to stop';
          p.el.querySelector('.msg').textContent = msg + ' · ' + s.wins[me] + ' – ' + s.wins[1 - me];
          p.el.querySelector('.mi-sit').classList.toggle('go', s.stage === 'stopped' && !s.sat[me]);
        },
        unmount: function () { phone = null; },
      };
    })(),
    pad: function (btn, s) {
      if (btn !== 'A' && btn !== 'B') return null;
      const rt = s.stage === 'stopped' && tvStopShown !== null ? Math.round(performance.now() - tvStopShown) : -1;
      return { type: 'sit', rt: rt };
    },
    sounds: function (prev, s) {
      if (s.stage === 'stopped' && prev.stage !== 'stopped') return ['boom'];
      if (s.stage === 'dip' && prev.stage !== 'dip') return ['whoosh'];
      if (s.stage === 'done' && prev.stage !== 'done') return ['point'];
      const tripped = [0, 1].some(function (i) { return s.trippedUntil[i] !== prev.trippedUntil[i]; });
      return tripped ? ['wrong'] : [];
    },
  });
})();
