// Fishing (server/games/minis/fishing.js): wait for the bite, HOOK, then REEL without
// snapping the line. One button (phone) or A (controller) does all three.
(function () {
  const STAGE = {
    wait: '〰️ Waiting for a bite…',
    bite: '❗ BITE! Hook it!',
    reel: '🎣 Reel it in!',
    scared: '💨 Too early: it swam off',
    snapped: '💥 Snap! Re-tying the line',
    caught: '🐟 Caught one!',
  };
  const BUTTON = { wait: '⏳ Wait…', bite: '❗ HOOK!', reel: '🎣 REEL!', scared: '💨', snapped: '💥', caught: '🐟' };

  function bars(L) {
    const hot = L.tension > 0.75 ? ' hot' : '';
    return '<div class="bar"><span>🐟</span><i><b class="prog" style="width:' + L.progress * 100 + '%"></b></i></div>' +
      '<div class="bar"><span>🪢</span><i><b class="tension' + hot + '" style="width:' + L.tension * 100 + '%"></b></i></div>';
  }

  function pond(L) {
    return '<div class="pond ' + L.stage + '"><span class="float">' + (L.stage === 'bite' ? '❗' : L.stage === 'caught' ? '🐟' : '🔴') + '</span></div>';
  }

  // Motion (see public/shared/motion.js): how hard a jerk hooks, and a swing while reeling.
  const HOOK_JOLT = 12; // m/s²
  const REEL_JOLT = 7;
  const REEL_MS = 180; // one reel per swing at most
  // Buzzes when the line changes: the bite (hook now!), a snap, a catch.
  const BUZZ = { bite: [160, 60, 160], snapped: 400, caught: [60, 40, 60, 40, 140], scared: 80 };

  let host = null;
  let phone = null;

  ArkMini.register('fishing', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-fish">' + [0, 1].map(function (p) {
          return '<div class="mi-side p' + (p + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, p) + '</div><div class="catch"></div><div class="body"></div><div class="stage"></div></div>';
        }).join('') + '</div>';
        host = { el: el };
      },
      update: function (s) {
        if (!host) return;
        host.el.querySelectorAll('.mi-side').forEach(function (side, p) {
          const L = s.lines[p];
          side.querySelector('.catch').textContent = L.fish ? '🐟 × ' + L.fish : '';
          side.querySelector('.body').innerHTML = pond(L) + (L.stage === 'reel' ? bars(L) : '');
          side.querySelector('.stage').textContent = STAGE[L.stage];
        });
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-fish-phone"><div class="msg"></div><div class="bars"></div><button class="primary mi-big-btn"></button><div class="how">📳 Jerk the phone up to hook · wind it in circles to reel · or tap</div></div>';
        const p = { el: el, slot: mctx.slot, mctx: mctx, stage: null, tension: 0, lastMove: 0, lastBuzz: 0, nibble: null, stop: null };
        phone = p;
        el.querySelector('button').addEventListener('pointerdown', function () { mctx.send({ type: 'tap' }); mctx.vibrate(10); });
        // Motion: a sharp jerk hooks a biting fish (only then: walking about doesn't scare it);
        // each swing while winding the phone round reels in, like a tap.
        Ark.loadScript('/shared/motion.js').then(function () {
          if (phone !== p) return;
          p.stop = ArkMotion.on(function (r) {
            const now = performance.now();
            if (p.stage === 'bite' && r.jolt > HOOK_JOLT && now - p.lastMove > 300) {
              p.lastMove = now;
              mctx.send({ type: 'tap' });
            } else if (p.stage === 'reel' && r.jolt > REEL_JOLT && now - p.lastMove > REEL_MS) {
              p.lastMove = now;
              mctx.send({ type: 'tap' });
            }
          });
        });
        // While you wait, the odd nibble buzzes the phone: it's not a bite yet!
        const nibble = function () {
          if (phone !== p) return;
          if (p.stage === 'wait' && p.playing) p.mctx.vibrate(15);
          p.nibble = setTimeout(nibble, 700 + Math.random() * 1400);
        };
        p.nibble = setTimeout(nibble, 900);
      },
      update: function (s, v) {
        if (!phone) return;
        phone.playing = v.phase === 'play';
        const L = s.lines[phone.slot];
        const was = phone.stage;
        if (L.stage !== was) phone.mctx.vibrate(BUZZ[L.stage] || 0);
        // A tight line rumbles, more as it nears snapping.
        const now = performance.now();
        if (L.stage === 'reel' && L.tension > 0.6 && now - phone.lastBuzz > 220) {
          phone.lastBuzz = now;
          phone.mctx.vibrate(Math.round(20 + (L.tension - 0.6) * 150));
        }
        phone.stage = L.stage;
        phone.el.querySelector('.msg').textContent = '🐟 ' + L.fish + ' · them ' + s.lines[1 - phone.slot].fish;
        phone.el.querySelector('.bars').innerHTML = L.stage === 'reel' ? bars(L) : '<div class="stage">' + STAGE[L.stage] + '</div>';
        const b = phone.el.querySelector('button');
        b.textContent = BUTTON[L.stage];
        b.className = 'primary mi-big-btn' + (L.stage === 'bite' ? ' mi-bite' : '');
        phone.el.querySelector('.how').classList.toggle('on', window.ArkMotion ? ArkMotion.live() : false);
      },
      unmount: function () {
        if (phone) {
          clearTimeout(phone.nibble);
          if (phone.stop) phone.stop();
        }
        phone = null;
      },
    },
    pad: function (btn) { return btn === 'A' || btn === 'B' || btn === 'X' || btn === 'Y' ? { type: 'tap' } : null; },
    sounds: function (prev, s) {
      const out = [];
      s.lines.forEach(function (L, i) {
        const was = prev.lines[i].stage;
        if (L.stage === was) return;
        if (L.stage === 'bite') out.push('go');
        else if (L.stage === 'caught') out.push('point');
        else if (L.stage === 'snapped') out.push('crash');
        else if (L.stage === 'scared') out.push('wrong');
        else if (L.stage === 'reel') out.push('splash');
      });
      return out;
    },
  });
})();
