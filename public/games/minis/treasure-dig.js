// Treasure Dig (server/games/minis/treasure-dig.js): dig your patch of sand; each hole says how
// close your chest is. Phones tap a square; controllers move a cursor with the D-pad and dig with A.
(function () {
  const HEAT = { hot: '🔥', warm: '♨️', cool: '🌤️', cold: '❄️', chest: '💰' };
  const cursors = [0, 0];

  function patch(s, slot, cursorOn, buttons) {
    const dug = {};
    s.digs[slot].forEach(function (d) { dug[d.cell] = d.heat; });
    let html = '<div class="mi-dig" style="--n:' + s.size + '">';
    for (let c = 0; c < s.size * s.size; c++) {
      const h = dug[c];
      const cls = 'sq' + (h ? ' dug ' + h : '') + (cursorOn && cursors[slot] === c ? ' cur' : '') + (s.chests[slot] === c ? ' found' : '');
      const inner = h ? HEAT[h] : '';
      html += buttons ? '<button class="' + cls + '" data-c="' + c + '"' + (h ? ' disabled' : '') + '>' + inner + '</button>' : '<span class="' + cls + '">' + inner + '</span>';
    }
    return html + '</div>';
  }

  function wins(s, slot) {
    return '<div class="mi-dots">' + [0, 1, 2].map(function (i) { return '<i class="' + (i < s.wins[slot] ? 'on' : '') + '"></i>'; }).join('') + '</div>';
  }

  const LEGEND = '<div class="mi-dig-legend">🔥 next to it · ♨️ warm · 🌤️ cool · ❄️ cold</div>';

  let host = null;
  let phone = null;

  function drawHost() {
    if (!host || !host.s) return;
    const s = host.s;
    host.sides.forEach(function (el, slot) {
      const local = host.players[slot] && host.players[slot].local && !host.players[slot].bot;
      el.innerHTML = '<div class="who">' + ArkMini.nameOf({ players: host.players }, slot) + '</div>' + wins(s, slot) + patch(s, slot, local, false) +
        (s.found === slot ? '<div class="mi-dig-found">Found it! 💰</div>' : '');
    });
  }

  ArkMini.register('treasure-dig', {
    host: {
      mount: function (el, mctx) {
        cursors[0] = cursors[1] = 0;
        el.innerHTML = '<div class="mi-pick"><div class="mi-question">' + LEGEND + '</div><div class="mi-split"><div class="mi-side p1"></div><div class="mi-side p2"></div></div></div>';
        host = { sides: Array.prototype.slice.call(el.querySelectorAll('.mi-side')), players: mctx.players, s: null };
      },
      update: function (s) { if (host) { host.s = s; drawHost(); } },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage"><div class="mi-dig-wrap"></div>' + LEGEND + '</div>';
        phone = { el: el, slot: mctx.slot, s: null };
        el.addEventListener('click', function (e) {
          const b = e.target.closest('[data-c]');
          if (!b || b.disabled || !phone || !phone.s) return;
          mctx.send({ type: 'dig', cell: Number(b.getAttribute('data-c')) });
          mctx.vibrate(15);
        });
      },
      update: function (s) {
        if (!phone) return;
        phone.s = s;
        phone.el.querySelector('.mi-dig-wrap').innerHTML = wins(s, phone.slot) + patch(s, phone.slot, false, true) +
          (s.found === phone.slot ? '<div class="mi-dig-found">Found it! 💰</div>' : s.found !== null ? '<div class="muted">They found theirs</div>' : '');
      },
      unmount: function () { phone = null; },
    },
    pad: function (btn, s, slot) {
      if (btn === 'A') return { type: 'dig', cell: cursors[slot] };
      cursors[slot] = ArkMini.moveCursor(cursors[slot], btn, s.size * s.size, s.size);
      drawHost();
      return null;
    },
    sounds: function (prev, s) {
      if (s.found !== null && prev.found === null) return ['fanfare'];
      return s.digs.some(function (d, i) { return d.length > prev.digs[i].length; }) ? ['drop'] : [];
    },
  });
})();
