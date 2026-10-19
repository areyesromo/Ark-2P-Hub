// Pour It (server/games/minis/pour-it.js): tilt your phone to pour (or hold POUR), level it
// to stop; get closest to the line without spilling. Phones only.
(function () {
  const TILT_START = 18; // degrees from how you held the phone at the start before it pours…
  const TILT_FULL = 55; // …and where it pours flat out
  const SEND_MS = 100;

  function glass(g, line) {
    const cls = 'glass' + (g.spilled ? ' spilled' : g.done ? ' done' : g.pouring ? ' pouring' : '');
    return '<div class="' + cls + '"><i class="line" style="bottom:' + line * 100 + '%"></i><b class="drink" style="height:' + Math.min(1, g.fill) * 100 + '%"></b>' +
      (g.spilled ? '<span class="tag">💦 Spilled!</span>' : g.done ? '<span class="tag">' + off(g.fill, line) + '</span>' : '') + '</div>';
  }

  function off(fill, line) {
    const d = Math.round((fill - line) * 100);
    return d === 0 ? '🎯 Spot on!' : (d > 0 ? '+' : '') + d + '%';
  }

  let host = null;
  let phone = null;

  ArkMini.register('pour-it', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-pour">' + [0, 1].map(function (p) {
          return '<div class="mi-side p' + (p + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, p) + '</div><div class="g"></div></div>';
        }).join('') + '</div>';
        host = { el: el };
      },
      update: function (s) {
        if (!host) return;
        host.el.querySelectorAll('.mi-side .g').forEach(function (el, p) { el.innerHTML = glass(s.glasses[p], s.line); });
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-pour-phone"><div class="msg"></div><div class="g"></div><button class="primary mi-big-btn">🫗 Hold to POUR</button><div class="how">Tilt the phone to pour, level it to stop · or hold the button</div></div>';
        const p = { el: el, slot: mctx.slot, mctx: mctx, tiltV: 0, holdV: 0, sent: -1, lastSend: 0, timer: null, stop: null, lastBuzz: 0, was: null };
        phone = p;
        const send = function () {
          const v = Math.round(Math.max(p.tiltV, p.holdV) * 20) / 20;
          if (v === p.sent && performance.now() - p.lastSend < 1000) return;
          p.sent = v;
          p.lastSend = performance.now();
          mctx.send({ type: 'pour', v: v });
        };
        p.timer = setInterval(send, SEND_MS);
        const btn = el.querySelector('button');
        const hold = function (v) { return function (e) { e.preventDefault(); p.holdV = v; send(); }; };
        btn.addEventListener('pointerdown', hold(1));
        btn.addEventListener('pointerup', hold(0));
        btn.addEventListener('pointercancel', hold(0));
        btn.addEventListener('pointerleave', hold(0));
        Ark.loadScript('/shared/motion.js').then(function () {
          if (phone !== p) return;
          // Pouring is tipping the phone away from how you held it when the minigame began,
          // whichever way up that was (portrait or landscape): the angle between the two.
          p.stop = ArkMotion.on(function (r) {
            const g = r.gravity;
            const len = Math.hypot(g.x, g.y, g.z) || 1;
            if (!p.playing) { p.rest = { x: g.x / len, y: g.y / len, z: g.z / len }; p.tiltV = 0; return; }
            if (!p.rest) p.rest = { x: g.x / len, y: g.y / len, z: g.z / len };
            const dot = (g.x * p.rest.x + g.y * p.rest.y + g.z * p.rest.z) / len;
            const deg = Math.acos(Math.max(-1, Math.min(1, dot))) * 180 / Math.PI;
            p.tiltV = Math.max(0, Math.min(1, (deg - TILT_START) / (TILT_FULL - TILT_START)));
          });
        });
      },
      update: function (s, v) {
        if (!phone) return;
        const p = phone;
        p.playing = v.phase === 'play';
        const g = s.glasses[p.slot];
        const them = s.glasses[1 - p.slot];
        // Buzz: a tick as you near the line, a long one if you spill.
        const now = performance.now();
        if (!g.done && g.fill > s.line - 0.06 && g.fill < s.line && now - p.lastBuzz > 250) { p.lastBuzz = now; p.mctx.vibrate(12); }
        if (g.spilled && !(p.was && p.was.spilled)) p.mctx.vibrate(500);
        p.was = g;
        p.el.querySelector('.msg').textContent = g.done ? (g.spilled ? 'Spilled! 💦' : 'Done: ' + off(g.fill, s.line)) : 'Fill to the line · them ' + (them.spilled ? '💦' : them.done ? '✅' : '…');
        p.el.querySelector('.g').innerHTML = glass(g, s.line);
        p.el.querySelector('button').disabled = g.done;
      },
      unmount: function () {
        if (phone) {
          clearInterval(phone.timer);
          if (phone.stop) phone.stop();
        }
        phone = null;
      },
    },
    sounds: function (prev, s) {
      const out = [];
      s.glasses.forEach(function (g, i) {
        if (g.spilled && !prev.glasses[i].spilled) out.push('splash');
        else if (g.done && !prev.glasses[i].done) out.push('lock');
      });
      return out;
    },
  });
})();
