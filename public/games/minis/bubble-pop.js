// Bubble Pop (server/games/minis/bubble-pop.js): one grid of bubbles; tap a clump of your colour.
// The same board draws on the TV and the phones: bubbles keep their place by id, so when a clump
// pops the ones above slide down and new ones drop in from the top. Controllers move a cursor and
// pop with A.
(function () {
  const cursors = [24, 31];

  /** A board in `el`: draw(s) moves every bubble to its spot (CSS slides them). */
  function board(el, opts) {
    el.innerHTML = '<div class="mi-bub-board"></div>';
    const box = el.querySelector('.mi-bub-board');
    const dots = {}; // id -> element
    let lastPop = 0;
    return {
      draw: function (s) {
        box.style.setProperty('--cols', s.cols);
        box.style.setProperty('--rows', s.rows);
        const seen = {};
        const newPerCol = {};
        s.grid.forEach(function (b, cell) {
          const id = b[0];
          const k = b[1];
          const x = cell % s.cols;
          const y = Math.floor(cell / s.cols);
          seen[id] = true;
          let d = dots[id];
          if (!d) {
            d = document.createElement(opts.buttons ? 'button' : 'span');
            d.className = 'bub k' + k;
            // New ones start above the board, stacked by how many came in this column.
            newPerCol[x] = (newPerCol[x] || 0) + 1;
            d.style.setProperty('--x', x);
            d.style.setProperty('--y', -newPerCol[x]);
            box.appendChild(d);
            dots[id] = d;
            void d.offsetWidth; // (so the slide down animates)
          }
          d.style.setProperty('--x', x);
          d.style.setProperty('--y', y);
          d.setAttribute('data-cell', cell);
          d.setAttribute('data-id', id);
        });
        Object.keys(dots).forEach(function (id) {
          if (seen[id]) return;
          const d = dots[id];
          delete dots[id];
          d.classList.add('gone');
          d.removeAttribute('data-cell');
          setTimeout(function () { d.remove(); }, 320);
        });
        // A pop's worth floats up where the clump was.
        s.pops.forEach(function (p) {
          if (p.n <= lastPop) return;
          lastPop = p.n;
          const xs = p.cells.map(function (c) { return c % s.cols; });
          const ys = p.cells.map(function (c) { return Math.floor(c / s.cols); });
          const f = document.createElement('b');
          f.className = 'mi-bub-float p' + (p.by + 1) + (p.worth < 0 ? ' neg' : '');
          f.textContent = p.worth > 0 ? '+' + p.worth : p.worth < 0 ? '−1' : '';
          f.style.setProperty('--x', xs.reduce(function (a, b) { return a + b; }, 0) / xs.length);
          f.style.setProperty('--y', ys.reduce(function (a, b) { return a + b; }, 0) / ys.length);
          if (f.textContent) { box.appendChild(f); setTimeout(function () { f.remove(); }, 900); }
        });
      },
    };
  }

  function score(s, slot, players) {
    return '<div class="mi-bub-score p' + (slot + 1) + '"><i class="bub k' + slot + '"></i>' + ArkMini.nameOf({ players: players }, slot) + ' <b>' + s.points[slot] + '</b></div>';
  }

  let host = null;
  let phone = null;

  ArkMini.register('bubble-pop', {
    host: {
      mount: function (el, mctx) {
        cursors[0] = 24;
        cursors[1] = 31;
        el.innerHTML = '<div class="mi-bub-tv"><div class="mi-bub-side s1"></div><div class="mi-bub-wrap"></div><div class="mi-bub-side s2"></div></div>';
        const local = function (slot) { const p = mctx.players[slot]; return p && p.local && !p.bot; };
        host = {
          el: el,
          players: mctx.players,
          b: board(el.querySelector('.mi-bub-wrap'), {}),
          local: local,
          s: null,
        };
      },
      update: function (s) {
        if (!host) return;
        host.s = s;
        host.b.draw(s);
        // Controller cursors: a ring in each local player's colour.
        host.el.querySelectorAll('.bub').forEach(function (d) {
          const c = Number(d.getAttribute('data-cell'));
          d.classList.toggle('cur1', host.local(0) && cursors[0] === c);
          d.classList.toggle('cur2', host.local(1) && cursors[1] === c);
        });
        host.el.querySelector('.s1').innerHTML = score(s, 0, host.players);
        host.el.querySelector('.s2').innerHTML = score(s, 1, host.players);
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-bub-phone"><div class="mi-bub-head"></div><div class="mi-bub-wrap"></div><div class="muted">Tap a clump of 2+ of <b>your</b> colour</div></div>';
        phone = { el: el, slot: mctx.slot, players: mctx.players, b: board(el.querySelector('.mi-bub-wrap'), { buttons: true }), s: null };
        el.addEventListener('pointerdown', function (e) {
          const d = e.target.closest('.bub[data-cell]');
          if (!d || !phone) return;
          mctx.send({ type: 'pop', cell: Number(d.getAttribute('data-cell')), id: Number(d.getAttribute('data-id')) });
          mctx.vibrate(10);
          d.classList.add('tapped');
        });
      },
      update: function (s) {
        if (!phone) return;
        phone.s = s;
        phone.b.draw(s);
        const me = phone.slot;
        phone.el.querySelector('.mi-bub-head').innerHTML = '<span>You <i class="bub k' + me + '"></i> <b>' + s.points[me] + '</b></span><span>Them <b>' + s.points[1 - me] + '</b> <i class="bub k' + (1 - me) + '"></i></span>';
      },
      unmount: function () { phone = null; },
    },
    pad: function (btn, s, slot) {
      if (btn === 'A') return { type: 'pop', cell: cursors[slot], id: s.grid[cursors[slot]][0] };
      cursors[slot] = ArkMini.moveCursor(cursors[slot], btn, s.cols * s.rows, s.cols);
      if (host && host.s) host.el.querySelectorAll('.bub').forEach(function (d) {
        const c = Number(d.getAttribute('data-cell'));
        d.classList.toggle('cur' + (slot + 1), cursors[slot] === c);
      });
      return null;
    },
    sounds: function (prev, s) {
      const last = s.pops[s.pops.length - 1];
      const before = prev.pops[prev.pops.length - 1];
      if (!last || (before && before.n === last.n)) return [];
      return [last.worth < 0 ? 'wrong' : last.cells.length >= 6 ? 'fanfare' : 'eat'];
    },
  });
})();
