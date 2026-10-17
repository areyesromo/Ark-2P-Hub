// Tug of War (server/games/minis/tug-of-war.js): pull on the beat.
(function () {
  const GRADE = { perfect: '💪 Perfect!', good: '👍 Good', miss: '😅 Off beat' };

  /** A pulse that peaks on every beat (beats are counted from when this screen saw play start). */
  function beatPulse(el, mctx, beatMs) {
    let raf = requestAnimationFrame(function frame() {
      raf = requestAnimationFrame(frame);
      const t = mctx.t();
      const off = Math.min(t % beatMs, beatMs - (t % beatMs)) / (beatMs / 2); // 0 on the beat
      el.style.transform = 'scale(' + (1.25 - off * 0.35) + ')';
      el.style.opacity = String(1 - off * 0.6);
    });
    return function () { cancelAnimationFrame(raf); };
  }

  let host = null;
  let phone = null;

  ArkMini.register('tug-of-war', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-tug"><div class="names"><span>' + ArkMini.nameOf({ players: mctx.players }, 0) + '</span><span class="beat">🥁</span><span>' + ArkMini.nameOf({ players: mctx.players }, 1) + '</span></div>' +
          '<div class="track"><i class="line l"></i><i class="line r"></i><div class="rope"><span class="flag">🚩</span></div></div>' +
          '<div class="grades"><span class="g0"></span><span class="g1"></span></div></div>';
        host = { el: el, stop: beatPulse(el.querySelector('.beat'), mctx, 600) };
      },
      update: function (s) {
        if (!host) return;
        host.el.querySelector('.flag').style.left = (50 + s.rope * 40) + '%';
        [0, 1].forEach(function (i) { host.el.querySelector('.g' + i).textContent = s.last[i] ? GRADE[s.last[i]] : ''; });
      },
      unmount: function () { if (host) host.stop(); host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage"><div class="msg"></div><button class="primary mi-big-btn mi-pull">🪢 PULL!</button></div>';
        phone = { el: el, slot: mctx.slot, stop: beatPulse(el.querySelector('.mi-pull'), mctx, 600) };
        el.querySelector('button').addEventListener('pointerdown', function () { mctx.send({ type: 'pull' }); mctx.vibrate(12); });
      },
      update: function (s) {
        if (!phone) return;
        const mineWinning = (phone.slot === 0 ? -s.rope : s.rope) > 0;
        phone.el.querySelector('.msg').textContent = (s.last[phone.slot] ? GRADE[s.last[phone.slot]] + ' · ' : '') + (s.rope === 0 ? 'Even' : mineWinning ? 'You\'re winning' : 'They\'re winning');
      },
      unmount: function () { if (phone) phone.stop(); phone = null; },
    },
    pad: function (btn) { return btn === 'A' || btn === 'B' || btn === 'X' || btn === 'Y' ? { type: 'pull' } : null; },
    sounds: function (prev, s) {
      return s.rope !== prev.rope ? ['tick'] : [];
    },
  });
})();
