// Hurdle Dash (server/games/minis/hurdle-dash.js): a race over the same hurdles; you only jump.
// The TV shows the whole track, one lane each; phones have one big JUMP button.
(function () {
  const LIFT = 4.5; // rem at the top of a jump: well over a hurdle (2.6rem)

  /** The lanes and hurdles, once per minigame (the course doesn't change). */
  function lanes(s, players) {
    return [0, 1].map(function (slot) {
      return '<div class="mi-hd-lane p' + (slot + 1) + '">' +
        '<div class="who">' + ArkMini.nameOf({ players: players }, slot) + '</div>' +
        s.hurdles.map(function (h) { return '<span class="hurdle" style="left:' + (h / s.length) * 100 + '%"></span>'; }).join('') +
        '<span class="finish"></span><span class="runner">🏃</span></div>';
    }).join('');
  }

  let host = null;
  let phone = null;

  ArkMini.register('hurdle-dash', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-hd"></div>';
        host = { el: el.firstChild, players: mctx.players };
      },
      update: function (s) {
        if (!host) return;
        if (!host.built) {
          host.el.innerHTML = lanes(s, host.players);
          host.built = true;
        }
        // Only the runners move, so their transitions and the stumble wiggle keep playing.
        host.el.querySelectorAll('.runner').forEach(function (el, slot) {
          const r = s.runners[slot];
          el.style.left = (r.pos / s.length) * 100 + '%';
          el.style.bottom = 0.4 + (r.air ? Math.sin(r.air * Math.PI) * LIFT : 0) + 'rem';
          el.classList.toggle('stumbling', r.stumbling);
        });
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage"><div class="msg"></div><button class="primary mi-big-btn">JUMP!</button></div>';
        phone = { el: el, slot: mctx.slot };
        el.querySelector('button').addEventListener('pointerdown', function () { mctx.send({ type: 'jump' }); mctx.vibrate(10); });
      },
      update: function (s) {
        if (!phone) return;
        const me = s.runners[phone.slot];
        const them = s.runners[1 - phone.slot];
        phone.el.querySelector('.msg').innerHTML = (me.stumbling ? '<span class="mi-bad">Ouch! Stumbled</span><br>' : '') +
          Math.round(me.pos) + ' m · them ' + Math.round(them.pos) + ' m';
      },
      unmount: function () { phone = null; },
    },
    pad: function (btn) { return btn === 'A' || btn === 'B' || btn === 'UP' ? { type: 'jump' } : null; },
    sounds: function (prev, s) {
      const out = [];
      if (s.runners.some(function (r, i) { return r.clipped > prev.runners[i].clipped; })) out.push('wall');
      if (s.runners.some(function (r, i) { return r.air && !prev.runners[i].air; })) out.push('whoosh');
      return out;
    },
  });
})();
