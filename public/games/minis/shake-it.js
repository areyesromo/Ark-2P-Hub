// SHAKE IT! (server/games/minis/shake-it.js) Shake the phone (or tap the
// button fast); controllers wiggle the stick or mash A.
(function () {
  const SHAKE_MS = 120;
  const SHAKE_G = 18; // m/s², gravity included
  const lastSide = [0, 0];

  function meter(got, need, res) {
    return '<div class="mi-meter' + (res ? ' full' : '') + '" style="--k:' + Math.min(100, (100 * got) / need) + '%"><i></i></div>';
  }

  let hostEl = null;
  let phone = null;

  ArkMini.register('shake-it', {
    host: {
      mount: function (el, mctx) {
        lastSide[0] = lastSide[1] = 0;
        hostEl = el;
        hostEl.innerHTML = '<div class="mi-split">' + [0, 1].map(function (s) {
          return '<div class="mi-side p' + (s + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, s) + '</div><div class="slot"></div><div class="emoji">🥤</div></div>';
        }).join('') + '</div>';
      },
      update: function (s) {
        if (!hostEl) return;
        hostEl.querySelectorAll('.mi-side .slot').forEach(function (el, i) { el.innerHTML = meter(s.got[i], s.need, s.res[i]) + ArkMini.mark(s.res[i]); });
        hostEl.querySelectorAll('.mi-side .emoji').forEach(function (el, i) { el.classList.toggle('shaking', s.got[i] > 0 && s.res[i] === null); });
      },
      unmount: function () { hostEl = null; },
    },
    phone: {
      mount: function (el, mctx) {
        let last = 0;
        const shake = function () {
          const now = performance.now();
          if (now - last < SHAKE_MS) return;
          last = now;
          mctx.send({ type: 'shake' });
          mctx.vibrate(10);
        };
        const onMotion = function (e) {
          const a = e.accelerationIncludingGravity;
          if (a && Math.hypot(a.x || 0, a.y || 0, a.z || 0) > SHAKE_G) shake();
        };
        el.innerHTML = '<div class="mi-phone-stage"><div class="slot"></div><button class="primary mi-big-btn">🥤 SHAKE! (or tap)</button></div>';
        el.querySelector('button').addEventListener('pointerdown', function () {
          // iOS asks for motion access on a tap; meanwhile taps count too.
          if (window.DeviceMotionEvent && DeviceMotionEvent.requestPermission && !phone.asked) {
            phone.asked = true;
            DeviceMotionEvent.requestPermission().catch(function () {});
          }
          shake();
        });
        window.addEventListener('devicemotion', onMotion);
        phone = { el: el, onMotion: onMotion, asked: false };
      },
      update: function (s, v) {
        if (phone) phone.el.querySelector('.slot').innerHTML = meter(s.got[v.you], s.need, s.res[v.you]) + ArkMini.mark(s.res[v.you]);
      },
      unmount: function () {
        if (phone) window.removeEventListener('devicemotion', phone.onMotion);
        phone = null;
      },
    },
    pad: function (btn) { return btn === 'A' ? { type: 'shake' } : null; },
    padPoll: function (pad, s, slot) {
      const side = pad.stick.x > 0.6 || pad.stick.y > 0.6 ? 1 : pad.stick.x < -0.6 || pad.stick.y < -0.6 ? -1 : 0;
      if (!side || side === lastSide[slot]) return null;
      lastSide[slot] = side;
      return { type: 'shake' };
    },
  });
})();
