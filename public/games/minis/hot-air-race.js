// Hot Air Race (server/games/minis/hot-air-race.js): two balloons over wind bands to the flag. The
// same sky on the TV and the phones; each band's arrows drift at its wind's speed, the fastest band
// glows. Phones hold BURN; controllers hold A.
(function () {
  const pads = [null, null];

  function sky(s) {
    const fastest = s.winds.length ? Math.max.apply(null, s.winds) : 0;
    let bands = '';
    for (let i = s.bands - 1; i >= 0; i--) {
      const w = s.winds[i] || 1; // (the first view can come before the winds)
      bands += '<div class="mi-air-band' + (w === fastest ? ' fast' : '') + '" style="--speed:' + (6 / w).toFixed(2) + 's"><span class="arrows"></span><b>' + w.toFixed(1) + '</b></div>';
    }
    const balloons = s.balloons.map(function (b, slot) {
      return '<span class="mi-air-balloon p' + (slot + 1) + (b.burn ? ' burn' : '') + '" style="--x:' + (b.x / s.length) + ';--y:' + b.y + '"><i class="env"></i><i class="flame"></i><i class="basket"></i></span>';
    }).join('');
    return '<div class="mi-air-sky"><div class="mi-air-bands">' + bands + '</div><span class="mi-air-flag"></span><span class="mi-air-ground"></span>' + balloons + '</div>';
  }

  function progress(s, slot, players) {
    const b = s.balloons[slot];
    return '<div class="mi-air-who p' + (slot + 1) + '">' + ArkMini.nameOf({ players: players }, slot) + ' <b>' + Math.round((100 * b.x) / s.length) + '%</b></div>';
  }

  let host = null;
  let phone = null;

  ArkMini.register('hot-air-race', {
    host: {
      mount: function (el, mctx) { host = { el: el, players: mctx.players, key: '' }; },
      update: function (s) {
        if (!host) return;
        // The bands only change now and then: redraw the sky when they do, otherwise just move the balloons.
        const key = s.shifts + ':' + s.winds.join();
        if (key !== host.key || !host.el.querySelector('.mi-air-sky')) {
          host.key = key;
          host.el.innerHTML = '<div class="mi-air"><div class="mi-air-top">' + progress(s, 0, host.players) + '<span class="muted">Hold BURN to rise · ride the fastest wind</span>' + progress(s, 1, host.players) + '</div>' + sky(s) + '</div>';
          return;
        }
        host.el.querySelectorAll('.mi-air-balloon').forEach(function (n, slot) {
          const b = s.balloons[slot];
          n.style.setProperty('--x', b.x / s.length);
          n.style.setProperty('--y', b.y);
          n.classList.toggle('burn', b.burn);
        });
        host.el.querySelectorAll('.mi-air-who b').forEach(function (n, slot) { n.textContent = Math.round((100 * s.balloons[slot].x) / s.length) + '%'; });
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-air phone"><div class="mi-air-scene"></div><button class="mi-air-burn">🔥 BURN</button><p class="muted">Hold to rise, let go to sink</p></div>';
        phone = { el: el, slot: mctx.slot, players: mctx.players, on: false, key: '' };
        const btn = el.querySelector('.mi-air-burn');
        const set = function (on, e) {
          if (e) e.preventDefault();
          if (!phone || phone.on === on) return;
          phone.on = on;
          btn.classList.toggle('on', on);
          mctx.send({ type: 'burn', on: on });
          if (on) mctx.vibrate(10);
        };
        btn.addEventListener('pointerdown', function (e) { btn.setPointerCapture && btn.setPointerCapture(e.pointerId); set(true, e); });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { btn.addEventListener(ev, function (e) { set(false, e); }); });
        btn.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      },
      update: function (s) {
        if (!phone) return;
        const scene = phone.el.querySelector('.mi-air-scene');
        const key = s.shifts + ':' + s.winds.join();
        if (key !== phone.key) { phone.key = key; scene.innerHTML = sky(s); }
        scene.querySelectorAll('.mi-air-balloon').forEach(function (n, slot) {
          const b = s.balloons[slot];
          n.style.setProperty('--x', b.x / s.length);
          n.style.setProperty('--y', b.y);
          n.classList.toggle('burn', b.burn);
          n.classList.toggle('me', slot === phone.slot);
        });
      },
      unmount: function () { phone = null; },
    },
    padPoll: function (pad, s, slot) {
      if (!pads[slot]) pads[slot] = { on: false, armed: false };
      const p = pads[slot];
      const held = pad.held.indexOf('A') !== -1 || pad.held.indexOf('RT') !== -1;
      if (!held) p.armed = true; // (A still down from Ready doesn't burn: let go first)
      if (!p.armed || held === p.on) return null;
      p.on = held;
      return { type: 'burn', on: held };
    },
    sounds: function (prev, s) {
      if (s.finish !== null && prev.finish === null) return ['fanfare'];
      return s.shifts !== prev.shifts ? ['whoosh'] : [];
    },
  });
})();
