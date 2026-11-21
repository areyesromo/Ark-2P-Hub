// Pancake Flip (server/games/minis/pancake-flip.js): a pan each; flip when the meter's green, then
// catch the spinning pancake flat. Each screen runs the meter and the spin on its own clock from the
// last view (the server's minigame time plus the time since), so they move smoothly between views.
// Phones have one big button (FLIP, then CATCH); controllers press A.
(function () {
  const WORD = { flat: 'Flat! 🥞', crooked: 'Crooked…', miss: 'Missed!', drop: 'Dropped!', burnt: 'Burnt! 🔥', raw: 'Too soon: raw!', topple: 'Topple! 💥', golden: 'Golden!', flip: '' };

  /** A kitchen: the pan, the meter, the pancake in the air and the stack, redrawn every frame. */
  function kitchen(el, slot) {
    el.innerHTML = '<div class="mi-pan-k">' +
      '<div class="mi-pan-meter"><i class="band"></i><i class="needle"></i></div>' +
      '<div class="mi-pan-air"><span class="mi-cake fly"></span></div>' +
      '<div class="mi-pan-stove"><span class="mi-pan"><span class="mi-cake in"></span></span></div>' +
      '<div class="mi-pan-plate"><div class="mi-pan-stack"></div><span class="mi-plate"></span></div>' +
      '<b class="mi-pan-word"></b></div>';
    const q = function (sel) { return el.querySelector(sel); };
    let lastWord = 0;
    let stackKey = '';
    return {
      draw: function (s, now) {
        const p = s.pans[slot];
        q('.band').style.left = s.goldenBand[0] * 100 + '%';
        q('.band').style.width = (s.goldenBand[1] - s.goldenBand[0]) * 100 + '%';
        const cooking = p.stage === 'cook';
        const done = cooking ? Math.max(0, (now - p.cookAt) / s.cookMs) : 0;
        q('.needle').style.left = Math.min(1, done) * 100 + '%';
        const inPan = q('.mi-cake.in');
        inPan.style.opacity = cooking && now >= p.cookAt ? 1 : 0;
        // Pale to golden to brown as it cooks.
        inPan.style.setProperty('--done', Math.min(1, done));
        const fly = q('.mi-cake.fly');
        if (p.stage === 'air') {
          const k = Math.min(1, Math.max(0, (now - p.airAt) / s.airMs));
          const angle = (p.spin * (now - p.airAt)) / 1000;
          fly.style.opacity = 1;
          fly.style.transform = 'translateY(' + (-(4 * k * (1 - k)) * 100) + '%) rotateX(' + angle + 'deg)';
        } else {
          fly.style.opacity = 0;
        }
        const key = p.stack.join() + '|' + p.wobble;
        if (key !== stackKey) {
          stackKey = key;
          q('.mi-pan-stack').innerHTML = p.stack.map(function (g, i) { return '<span class="mi-cake st' + (g ? ' golden' : '') + '" style="--i:' + i + '"></span>'; }).join('');
          q('.mi-pan-stack').style.setProperty('--wob', p.wobble);
        }
        if (p.last && p.last.n !== lastWord && WORD[p.last.kind] !== undefined) {
          lastWord = p.last.n;
          const w = q('.mi-pan-word');
          w.textContent = WORD[p.last.kind];
          w.className = 'mi-pan-word show ' + p.last.kind;
          void w.offsetWidth;
        }
      },
    };
  }

  /** The server's minigame time now, from the last view's and the time since it came. */
  function clockFrom(s, got) {
    return s.elapsed + (performance.now() - got);
  }

  let host = null;
  let phone = null;

  function loop() {
    if (host && host.s) host.k.forEach(function (k) { k.draw(host.s, clockFrom(host.s, host.got)); });
    if (phone && phone.s) phone.k.draw(phone.s, clockFrom(phone.s, phone.got));
    if (host || phone) requestAnimationFrame(loop);
  }

  function heights(s) {
    return s.pans.map(function (p) { return p.stack.length; });
  }

  ArkMini.register('pancake-flip', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-split mi-pan-tv">' + [0, 1].map(function (slot) {
          return '<div class="mi-side p' + (slot + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, slot) + ' <b class="h"></b></div><div class="k"></div></div>';
        }).join('') + '</div>';
        const ks = Array.prototype.slice.call(el.querySelectorAll('.k')).map(function (k, slot) { return kitchen(k, slot); });
        host = { el: el, k: ks, s: null, got: 0 };
        requestAnimationFrame(loop);
      },
      update: function (s) {
        if (!host) return;
        host.s = s;
        host.got = performance.now();
        const h = heights(s);
        host.el.querySelectorAll('.h').forEach(function (b, slot) { b.textContent = h[slot] + ' 🥞'; });
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-pan-phone"><div class="mi-pan-head"></div><div class="k"></div><button class="mi-pan-btn">FLIP</button></div>';
        phone = { el: el, slot: mctx.slot, k: kitchen(el.querySelector('.k'), mctx.slot), s: null, got: 0 };
        el.querySelector('.mi-pan-btn').addEventListener('pointerdown', function () {
          if (!phone || !phone.s) return;
          const stage = phone.s.pans[phone.slot].stage;
          mctx.send({ type: stage === 'air' ? 'catch' : 'flip' });
          mctx.vibrate(15);
        });
        requestAnimationFrame(loop);
      },
      update: function (s) {
        if (!phone) return;
        phone.s = s;
        phone.got = performance.now();
        const me = phone.slot;
        const h = heights(s);
        phone.el.querySelector('.mi-pan-head').innerHTML = '<span>You <b>' + h[me] + '</b> 🥞</span><span>Them <b>' + h[1 - me] + '</b> 🥞</span>';
        const air = s.pans[me].stage === 'air';
        const b = phone.el.querySelector('.mi-pan-btn');
        b.textContent = air ? 'CATCH!' : 'FLIP';
        b.classList.toggle('air', air);
      },
      unmount: function () { phone = null; },
    },
    pad: function (btn, s, slot) {
      if (btn !== 'A') return null;
      return { type: s.pans[slot].stage === 'air' ? 'catch' : 'flip' };
    },
    sounds: function (prev, s) {
      const out = [];
      s.pans.forEach(function (p, i) {
        const was = prev.pans[i].last;
        if (!p.last || (was && was.n === p.last.n)) return;
        out.push({ flat: 'correct', crooked: 'knock', miss: 'splash', drop: 'splash', burnt: 'wrong', raw: 'splash', topple: 'crash', golden: 'whoosh', flip: 'whoosh' }[p.last.kind] || 'tick');
      });
      return out;
    },
  });
})();
