// Mirror Me (server/games/minis/mirror-me.js): remember the shape, then join the dots to draw it.
// Phones: tap a dot, then a neighbour to draw a line (and carry on from there); Undo, Done.
// Controllers draw on the TV: D-pad moves between dots, A picks a dot / draws to it, B undoes,
// Start (or X) says done.
(function () {
  const cursors = [5, 6];
  const picked = [null, null]; // a controller's line start

  const xy = function (i, size) { return [(i % size) * 100 / (size - 1), Math.floor(i / size) * 100 / (size - 1)]; };

  /**
   * An SVG of the dots; `sets` are [{ lines, cls }] drawn in order. `cur` / `pick` ring a dot
   * (a controller's cursor and picked start).
   */
  function grid(size, sets, cur, pick) {
    const dots = [];
    for (let i = 0; i < size * size; i++) {
      const [x, y] = xy(i, size);
      dots.push('<circle class="dot' + (i === pick ? ' picked' : '') + (i === cur ? ' cur' : '') + '" data-i="' + i + '" cx="' + x + '" cy="' + y + '" r="5"/>');
    }
    const lines = sets.map(function (set) {
      return (set.lines || []).map(function (l) {
        const [x1, y1] = xy(l[0], size);
        const [x2, y2] = xy(l[1], size);
        return '<line class="' + set.cls + '" x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '"/>';
      }).join('');
    }).join('');
    return '<svg class="mi-mm-grid" viewBox="-10 -10 120 120">' + lines + dots.join('') + '</svg>';
  }
  /** Splits a player's lines into right and wrong against the shape (for the reveal). */
  function marked(lines, shape) {
    const right = (lines || []).filter(function (l) { return shape.some(function (o) { return o[0] === l[0] && o[1] === l[1]; }); });
    const wrong = (lines || []).filter(function (l) { return right.indexOf(l) === -1; });
    return [{ lines: shape, cls: 'ghost' }, { lines: right, cls: 'right' }, { lines: wrong, cls: 'wrong' }];
  }
  function title(s) {
    return 'Round ' + s.round + ' / ' + s.rounds + ' · ' +
      (s.stage === 'show' ? '👀 Remember it!' : s.stage === 'draw' ? '✏️ Draw it!' : '✔ Here\'s how you did');
  }
  /** The time bar under the title: restarted for each stage (updates only come on changes). */
  function timeBar(bar, s) {
    const key = s.round + s.stage;
    if (bar.dataset.key === key) return;
    bar.dataset.key = key;
    bar.classList.remove('run');
    bar.style.setProperty('--ms', s.msLeft + 'ms');
    void bar.offsetWidth;
    bar.classList.add('run');
  }

  let host = null;
  let phone = null;

  function drawHost() {
    if (!host || !host.s) return;
    const s = host.s;
    host.el.querySelector('.mi-mm-title').textContent = title(s);
    timeBar(host.el.querySelector('.mi-mm-bar'), s);
    host.sides.forEach(function (side, slot) {
      const pad = host.players[slot] && host.players[slot].local;
      let sets;
      if (s.stage === 'show') sets = [{ lines: s.shape, cls: 'shape' }];
      else if (s.stage === 'reveal') sets = marked(s.lines[slot], s.shape);
      else sets = [{ lines: s.padLines ? s.padLines[slot] : null, cls: 'mine' }];
      side.querySelector('.board').innerHTML = grid(s.size, sets, pad && s.stage === 'draw' ? cursors[slot] : -1, pad ? picked[slot] : null);
      side.querySelector('.info').innerHTML = s.stage === 'reveal'
        ? '+' + s.roundPoints[slot] + ' · total ' + s.totals[slot]
        : s.stage === 'draw' ? (pad ? '' : '✏️ ' + s.counts[slot] + ' lines') + (s.done[slot] ? ' ✓ done' : '') : 'total ' + s.totals[slot];
    });
  }

  ArkMini.register('mirror-me', {
    host: {
      mount: function (el, mctx) {
        cursors[0] = 5;
        cursors[1] = 6;
        picked[0] = picked[1] = null;
        el.innerHTML = '<div class="mi-mm"><div class="mi-mm-title"></div><div class="mi-mm-bar"></div><div class="mi-split">' + [0, 1].map(function (s) {
          return '<div class="mi-side p' + (s + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, s) + '</div><div class="board"></div><div class="info"></div></div>';
        }).join('') + '</div></div>';
        host = { el: el, players: mctx.players, s: null, sides: el.querySelectorAll('.mi-side') };
      },
      update: function (s) {
        if (!host) return;
        if (s.stage !== 'draw') picked[0] = picked[1] = null;
        host.s = s;
        drawHost();
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-mm-phone"><div class="msg"></div><div class="mi-mm-bar"></div><div class="board"></div>' +
          '<div class="row"><button class="undo">↩ Undo</button><button class="primary done">✓ Done</button></div></div>';
        phone = { el: el, slot: mctx.slot, s: null, from: null };
        el.querySelector('.board').addEventListener('pointerdown', function (e) {
          const dot = e.target.closest('[data-i]');
          if (!dot || !phone.s || phone.s.stage !== 'draw') return;
          const i = Number(dot.getAttribute('data-i'));
          if (phone.from !== null && phone.from !== i) mctx.send({ type: 'line', a: phone.from, b: i });
          phone.from = i; // carry on from here
          mctx.vibrate(6);
          draw();
        });
        el.querySelector('.undo').addEventListener('click', function () { mctx.send({ type: 'undo' }); phone.from = null; draw(); });
        el.querySelector('.done').addEventListener('click', function () { mctx.send({ type: 'done' }); });
      },
      update: function (s) {
        if (!phone) return;
        if (s.stage !== 'draw') phone.from = null;
        phone.s = s;
        draw();
      },
      unmount: function () { phone = null; },
    },
    pad: function (btn, s, slot) {
      if (s.stage !== 'draw') return null;
      if (btn === 'B') { picked[slot] = null; drawHost(); return { type: 'undo' }; }
      if (btn === 'START' || btn === 'X') return { type: 'done' };
      if (btn === 'A') {
        const from = picked[slot];
        picked[slot] = cursors[slot];
        drawHost();
        return from !== null && from !== cursors[slot] ? { type: 'line', a: from, b: cursors[slot] } : null;
      }
      cursors[slot] = ArkMini.moveCursor(cursors[slot], btn, s.size * s.size, s.size);
      drawHost();
      return null;
    },
    sounds: function (prev, s) {
      if (s.stage !== prev.stage) return [s.stage === 'reveal' ? 'reveal' : s.stage === 'draw' ? 'go' : 'tick'];
      return s.counts.some(function (n, i) { return n > prev.counts[i]; }) ? ['lock'] : [];
    },
  });

  function draw() {
    if (!phone || !phone.s) return;
    const s = phone.s;
    const me = phone.slot;
    let sets;
    if (s.stage === 'show') sets = [{ lines: s.shape, cls: 'shape' }];
    else if (s.stage === 'reveal') sets = marked(s.lines[me], s.shape);
    else sets = [{ lines: s.mine, cls: 'mine' }];
    phone.el.querySelector('.board').innerHTML = grid(s.size, sets, -1, s.stage === 'draw' ? phone.from : null);
    phone.el.querySelector('.msg').textContent = title(s) + (s.stage === 'reveal' ? ' · +' + s.roundPoints[me] : '');
    timeBar(phone.el.querySelector('.mi-mm-bar'), s);
    phone.el.querySelector('.row').style.visibility = s.stage === 'draw' && !s.done[me] ? 'visible' : 'hidden';
  }
})();
