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
        el.innerHTML = '<div class="mi-phone-stage mi-fish-phone"><div class="msg"></div><div class="bars"></div><button class="primary mi-big-btn"></button></div>';
        phone = { el: el, slot: mctx.slot, mctx: mctx, stage: null };
        el.querySelector('button').addEventListener('pointerdown', function () { mctx.send({ type: 'tap' }); mctx.vibrate(10); });
      },
      update: function (s) {
        if (!phone) return;
        const L = s.lines[phone.slot];
        if (L.stage === 'bite' && phone.stage !== 'bite') phone.mctx.vibrate(120);
        phone.stage = L.stage;
        phone.el.querySelector('.msg').textContent = '🐟 ' + L.fish + ' · them ' + s.lines[1 - phone.slot].fish;
        phone.el.querySelector('.bars').innerHTML = L.stage === 'reel' ? bars(L) : '<div class="stage">' + STAGE[L.stage] + '</div>';
        const b = phone.el.querySelector('button');
        b.textContent = BUTTON[L.stage];
        b.className = 'primary mi-big-btn' + (L.stage === 'bite' ? ' mi-bite' : '');
      },
      unmount: function () { phone = null; },
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
