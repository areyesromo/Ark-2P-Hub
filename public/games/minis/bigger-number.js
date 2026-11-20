// BIGGER NUMBER! (server/games/minis/bigger-number.js) Pick the bigger of two, three pairs running.
(function () {
  let host = null;
  let phone = null;

  /** The pair this player is on (or the last one, once done), with dots for the three. */
  function pairHtml(s, slot, buttons) {
    const k = Math.min(s.done[slot], s.pairs.length - 1);
    const pair = s.pairs[k];
    const dots = '<div class="mi-dots">' + s.pairs.map(function (_p, i) { return '<i class="' + (i < s.done[slot] ? 'on' : '') + '"></i>'; }).join('') + '</div>';
    const off = s.res[slot] !== null ? ' disabled' : '';
    const nums = pair.map(function (n, side) {
      return buttons ? '<button class="ghost mi-num" data-side="' + side + '"' + off + '>' + n + '</button>' : '<span class="mi-num">' + n + '</span>';
    }).join('<span class="mi-vs">or</span>');
    return dots + '<div class="mi-pair">' + nums + '</div>' + ArkMini.mark(s.res[slot]);
  }

  ArkMini.register('bigger-number', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-split">' + [0, 1].map(function (s) {
          return '<div class="mi-side p' + (s + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, s) + '</div><div class="mi-bn"></div></div>';
        }).join('') + '</div>';
        host = el;
      },
      update: function (s) { if (host) host.querySelectorAll('.mi-bn').forEach(function (el, i) { el.innerHTML = pairHtml(s, i, false); }); },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage"><div class="mi-bn"></div></div>';
        phone = { el: el, slot: mctx.slot };
        el.addEventListener('click', function (e) {
          const b = e.target.closest('[data-side]');
          if (!b || b.disabled) return;
          mctx.send({ type: 'pick', side: Number(b.getAttribute('data-side')) });
          mctx.vibrate(15);
        });
      },
      update: function (s) { if (phone) phone.el.querySelector('.mi-bn').innerHTML = pairHtml(s, phone.slot, true); },
      unmount: function () { phone = null; },
    },
    // ◀ or X: the left one; ▶ or B: the right one.
    pad: function (btn) {
      if (btn === 'LEFT' || btn === 'X') return { type: 'pick', side: 0 };
      if (btn === 'RIGHT' || btn === 'B') return { type: 'pick', side: 1 };
      return null;
    },
  });
})();
