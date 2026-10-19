// Sword Duel (server/games/minis/sword-duel.js): slash your phone the way the arrow points
// (or swipe the screen). Phones only.
(function () {
  const ARROW = { up: '⬆️', down: '⬇️', left: '⬅️', right: '➡️' };
  const SLASH_JOLT = 15; // m/s²: a slash, not a twitch
  const SWIPE_PX = 40;

  function pips(n, win) {
    let h = '';
    for (let i = 0; i < win; i++) h += i < n ? '⚔️' : '<i>·</i>';
    return h;
  }

  function banner(s, players) {
    if (s.stage === 'wait') return '<span class="hush">Hold still…</span>';
    if (s.stage === 'go') return '<span class="arrow">' + ARROW[s.dir] + '</span>';
    const l = s.last;
    const name = function (i) { return ArkMini.nameOf({ players: players }, i); };
    if (!l) return '';
    if (l.why === 'foul') return name(l.by) + ' jumped the gun! Point to ' + name(1 - l.by);
    if (l.why === 'fast') return name(l.winner) + ' strikes first! ⚔️';
    return l.why === 'slow' ? 'Too slow! No point' : 'Both missed! No point';
  }

  /** The direction of a slash from a motion reading (the first jolt goes the way you swing). */
  function slashDir(m) {
    return Math.abs(m.x) > Math.abs(m.y) ? (m.x > 0 ? 'right' : 'left') : m.y > 0 ? 'up' : 'down';
  }

  let host = null;
  let phone = null;

  ArkMini.register('sword-duel', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-sword">' +
          [0, 1].map(function (p) { return '<div class="mi-side p' + (p + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, p) + '</div><div class="pips"></div><div class="state"></div></div>'; }).join('') +
          '<div class="mid"></div></div>';
        host = { el: el, players: mctx.players };
      },
      update: function (s) {
        if (!host) return;
        host.el.querySelector('.mid').innerHTML = banner(s, host.players);
        host.el.querySelectorAll('.mi-side').forEach(function (side, p) {
          side.querySelector('.pips').innerHTML = pips(s.points[p], s.win);
          side.querySelector('.state').textContent = s.out[p] && s.stage !== 'point' ? '❌ Missed' : '';
        });
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-sword-phone"><div class="msg"></div><div class="arena"><div class="big"></div><div class="how">Slash the phone the way of the arrow · or swipe here</div></div></div>';
        const p = { el: el, slot: mctx.slot, mctx: mctx, s: null, start: null, lastSlash: 0, stop: null, stage: null, n: 0 };
        phone = p;
        const slash = function (dir) {
          const now = performance.now();
          if (now - p.lastSlash < 500 || !p.s || p.s.stage === 'point' || p.s.out[p.slot]) return;
          p.lastSlash = now;
          mctx.send({ type: 'slash', dir: dir });
          mctx.vibrate(20);
        };
        const pad = el.querySelector('.arena');
        pad.addEventListener('pointerdown', function (e) { p.start = { x: e.clientX, y: e.clientY }; });
        pad.addEventListener('pointerup', function (e) {
          if (!p.start) return;
          const dx = e.clientX - p.start.x;
          const dy = e.clientY - p.start.y;
          p.start = null;
          if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
          slash(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up');
        });
        Ark.loadScript('/shared/motion.js').then(function () {
          if (phone !== p) return;
          p.stop = ArkMotion.on(function (r) {
            if (r.jolt > SLASH_JOLT) slash(slashDir(r.move));
          });
        });
      },
      update: function (s) {
        if (!phone) return;
        const p = phone;
        const me = p.slot;
        // Buzz: the arrow is up; the point is yours / theirs.
        if (s.stage === 'go' && p.stage !== 'go') p.mctx.vibrate(60);
        if (s.stage === 'point' && p.stage !== 'point' && s.last) p.mctx.vibrate(s.last.winner === me ? [50, 30, 50] : s.last.winner === null ? 0 : 220);
        p.stage = s.stage;
        p.s = s;
        p.el.querySelector('.msg').innerHTML = pips(s.points[me], s.win) + ' · them ' + s.points[1 - me];
        const big = s.out[me] && s.stage !== 'point' ? '❌' : s.stage === 'go' ? ARROW[s.dir] : s.stage === 'wait' ? '🤺' : s.last && s.last.winner === me ? '🏅' : '😵';
        p.el.querySelector('.big').textContent = big;
        p.el.querySelector('.arena').classList.toggle('go', s.stage === 'go');
      },
      unmount: function () {
        if (phone && phone.stop) phone.stop();
        phone = null;
      },
    },
    sounds: function (prev, s) {
      const out = [];
      if (s.stage === 'go' && prev.stage !== 'go') out.push('go');
      if (s.stage === 'point' && prev.stage !== 'point' && s.last) out.push(s.last.why === 'fast' ? 'point' : 'wrong');
      return out;
    },
  });
})();
