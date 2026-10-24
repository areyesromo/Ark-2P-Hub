// Reflex Grid (server/games/minis/reflex-grid.js): tap the lit squares before they fade.
// Phones tap their own 3 x 3 grid; controllers move a cursor on the TV with the D-pad and press A.
(function () {
  const cursors = [4, 4];

  function gridHtml(tag) {
    let h = '<div class="mi-rg-grid">';
    for (let i = 0; i < 9; i++) h += '<' + tag + ' class="cell" data-i="' + i + '"></' + tag + '>';
    return h + '</div>';
  }
  /** Lights the grid for `slot`: a new light starts its fade bar; a light you've hit is ticked. */
  function showGrid(grid, s, slot, cursor) {
    grid.querySelectorAll('.cell').forEach(function (cell, i) {
      const light = s.lights.find(function (l) { return l.cell === i; });
      const id = light ? String(light.id) : '';
      if (cell.dataset.light !== id) {
        cell.dataset.light = id;
        cell.classList.remove('lit');
        if (light) {
          cell.style.setProperty('--left', light.left + 'ms');
          void cell.offsetWidth; // restart the fade for a new light
          cell.classList.add('lit');
        }
      }
      cell.classList.toggle('got', Boolean(light && light.hitBy[slot]));
      cell.classList.toggle('miss', Boolean(s.last && !s.last.good && s.last.slot === slot && s.last.cell === i));
      cell.classList.toggle('cursor', cursor === i);
    });
  }

  let host = null;
  let phone = null;

  function drawHost() {
    if (!host || !host.s) return;
    host.grids.forEach(function (g, slot) {
      const pad = host.players[slot] && host.players[slot].local;
      showGrid(g, host.s, slot, pad ? cursors[slot] : -1);
    });
    host.scores.forEach(function (el, slot) { el.textContent = host.s.points[slot]; });
  }

  ArkMini.register('reflex-grid', {
    host: {
      mount: function (el, mctx) {
        cursors[0] = cursors[1] = 4;
        el.innerHTML = '<div class="mi-split">' + [0, 1].map(function (s) {
          return '<div class="mi-side p' + (s + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, s) + '</div>' +
            '<span class="mi-rg-score">0</span>' + gridHtml('span') + '</div>';
        }).join('') + '</div>';
        host = { players: mctx.players, s: null, grids: el.querySelectorAll('.mi-rg-grid'), scores: el.querySelectorAll('.mi-rg-score') };
      },
      update: function (s) { if (host) { host.s = s; drawHost(); } },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-rg-phone"><div class="msg"></div>' + gridHtml('button') + '</div>';
        phone = { el: el, slot: mctx.slot };
        el.addEventListener('pointerdown', function (e) {
          const b = e.target.closest('[data-i]');
          if (!b) return;
          mctx.send({ type: 'tap', cell: Number(b.getAttribute('data-i')) });
          mctx.vibrate(8);
        });
      },
      update: function (s) {
        if (!phone) return;
        showGrid(phone.el.querySelector('.mi-rg-grid'), s, phone.slot, -1);
        phone.el.querySelector('.msg').textContent = '⚡ ' + s.points[phone.slot] + ' · them ' + s.points[1 - phone.slot];
      },
      unmount: function () { phone = null; },
    },
    pad: function (btn, s, slot) {
      if (btn === 'A' || btn === 'B') return { type: 'tap', cell: cursors[slot] };
      cursors[slot] = ArkMini.moveCursor(cursors[slot], btn, 9, 3);
      drawHost();
      return null;
    },
    sounds: function (prev, s) {
      if (!s.last || (prev.last && prev.last.n === s.last.n)) return [];
      return [s.last.good ? 'point' : 'wrong'];
    },
  });
})();
