// Whack-a-Mole (server/games/minis/whack-a-mole.js): whack the moles in your colour.
// Phones tap the holes; controllers move a cursor with the D-pad and press A.
(function () {
  const cursors = [4, 4];
  const MOLE = { 0: '🐹', 1: '🐹', gold: '⭐' };

  /** The 3 × 3 field; `cur` lists [hole, slot] cursors to ring; `seen` holds mole ids already drawn (only new ones pop up). */
  function field(s, buttons, cur, seen) {
    let h = '<div class="mi-moles">';
    s.holes.forEach(function (m, i) {
      const who = m ? (m.who === 'gold' ? ' gold' : ' p' + (m.who + 1)) : '';
      const rings = cur.filter(function (c) { return c[0] === i; }).map(function (c) { return ' cur' + (c[1] + 1); }).join('');
      const whacked = s.last && s.last.hole === i && s.last.ago < 400 && !m ? ' whacked' : '';
      const inner = m ? '<span class="mole' + (seen.has(m.id) ? '' : ' new') + '">' + MOLE[m.who] + '</span>' : '';
      if (m) seen.add(m.id);
      h += buttons ? '<button class="hole' + who + rings + whacked + '" data-i="' + i + '">' + inner + '</button>' : '<span class="hole' + who + rings + whacked + '">' + inner + '</span>';
    });
    return h + '</div>';
  }

  let host = null;
  let phone = null;

  function drawHost() {
    if (!host || !host.s) return;
    const s = host.s;
    const cur = [0, 1].filter(function (p) { return host.players[p] && host.players[p].local; }).map(function (p) { return [cursors[p], p]; });
    host.el.querySelector('.mid').innerHTML = field(s, false, cur, host.seen);
    host.el.querySelector('.score.p1').textContent = s.points[0];
    host.el.querySelector('.score.p2').textContent = s.points[1];
  }

  ArkMini.register('whack-a-mole', {
    host: {
      mount: function (el, mctx) {
        cursors[0] = cursors[1] = 4;
        el.innerHTML = '<div class="mi-whack"><div class="side p1"><b>' + ArkMini.nameOf({ players: mctx.players }, 0) + '</b><span class="score p1">0</span><span class="mole p1">🐹</span></div>' +
          '<div class="mid"></div>' +
          '<div class="side p2"><b>' + ArkMini.nameOf({ players: mctx.players }, 1) + '</b><span class="score p2">0</span><span class="mole p2">🐹</span></div></div>';
        host = { el: el, players: mctx.players, s: null, seen: new Set() };
      },
      update: function (s) { if (host) { host.s = s; drawHost(); } },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-whack-phone"><div class="msg"></div><div class="g"></div></div>';
        phone = { el: el, slot: mctx.slot, seen: new Set() };
        el.addEventListener('pointerdown', function (e) {
          const b = e.target.closest('[data-i]');
          if (!b) return;
          mctx.send({ type: 'whack', hole: Number(b.getAttribute('data-i')) });
          mctx.vibrate(10);
        });
      },
      update: function (s) {
        if (!phone) return;
        const p = phone.slot;
        phone.el.querySelector('.msg').innerHTML = '<span class="p' + (p + 1) + '-text">🐹 is yours</span> · ' + s.points[p] + ' · them ' + s.points[1 - p];
        phone.el.querySelector('.g').innerHTML = field(s, true, [], phone.seen);
      },
      unmount: function () { phone = null; },
    },
    pad: function (btn, s, slot) {
      if (btn === 'A' || btn === 'B') return { type: 'whack', hole: cursors[slot] };
      cursors[slot] = ArkMini.moveCursor(cursors[slot], btn, 9, 3);
      drawHost();
      return null;
    },
    sounds: function (prev, s) {
      if (!s.last || (prev.last && prev.last.id === s.last.id)) return [];
      return [s.last.kind === 'theirs' ? 'wrong' : 'point'];
    },
  });
})();
