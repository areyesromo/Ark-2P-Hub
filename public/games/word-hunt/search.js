// Word Search, the 1 player mode of Word Hunt (view.solo): the TV's and the phone's screens.
// The game's own renderers hand over to these (window.ArkWordSearch.host / .player).
(function () {

  // A colour per found word, so crossing words stay readable (the marker pens themselves).
  const PENS = ['#f472b6', '#60a5fa', '#4ade80', '#facc15', '#c084fc', '#fb923c', '#2dd4bf', '#f87171', '#a3e635', '#38bdf8'];

  /** The cells on the straight line from a to b (across, down or diagonal), or null. */
  function line(n, a, b) {
    const ax = a % n, ay = Math.floor(a / n), bx = b % n, by = Math.floor(b / n);
    const dx = Math.sign(bx - ax), dy = Math.sign(by - ay);
    const len = Math.max(Math.abs(bx - ax), Math.abs(by - ay));
    if (dx && dy && Math.abs(bx - ax) !== Math.abs(by - ay)) return null;
    const out = [];
    for (let k = 0; k <= len; k++) out.push((ay + dy * k) * n + ax + dx * k);
    return out;
  }

  /**
   * The grid's markup. opts.from is where a mark starts, opts.to where it's heading
   * (the line between shows as a pencil mark); opts.cursor outlines a cell (the TV's controller).
   */
  function html(v, opts) {
    opts = opts || {};
    const pen = {};
    v.found.forEach(function (f, k) {
      line(v.n, f.a, f.b).forEach(function (i) { pen[i] = PENS[k % PENS.length]; });
    });
    const marking = {};
    if (opts.from !== null && opts.from !== undefined) {
      (line(v.n, opts.from, opts.to === null || opts.to === undefined ? opts.from : opts.to) || [opts.from]).forEach(function (i) { marking[i] = true; });
    }
    let out = '<div class="ws-grid" style="--n:' + v.n + '">';
    for (let i = 0; i < v.n * v.n; i++) {
      out += '<div class="ws-cell' + (pen[i] ? ' found' : '') + (marking[i] ? ' marking' : '') + (opts.cursor === i ? ' cursor' : '') +
        '" data-cell="' + i + '"' + (pen[i] ? ' style="--pen:' + pen[i] + '"' : '') + '>' + v.grid[i] + '</div>';
    }
    return out + '</div>';
  }

  function words(v) {
    return '<ul class="ws-words">' + v.words.map(function (w) {
      return '<li class="' + (w.found ? 'found' : '') + '">' + w.word + '</li>';
    }).join('') + '</ul>';
  }


  // ---- the TV ----
  const host = (function () {

    const ready = Promise.resolve();

    let root = null;
    let view = null;
    let key = '';
    let nope = 0;
    const cursor = { x: 0, y: 0 }; // a controller player's cursor
    let from = null; // the first letter picked with the controller

    function render() {
      const v = view;
      if (!v || !root) return;
      const local = v.player && v.player.local && v.phase === 'play';
      const at = cursor.y * v.n + cursor.x;
      const k = JSON.stringify([v.grid, v.found, v.words, local && at, local && from, Math.floor(v.elapsed / 1000)]);
      if (k === key) return;
      key = k;
      const left = v.words.filter(function (w) { return !w.found; }).length;
      root.querySelector('.ws-stats').innerHTML = '<span><strong>' + left + '</strong> to find</span><span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong></span>';
      root.querySelector('.ws-field').innerHTML = html(v, local ? { cursor: at, from: from, to: at } : {});
      root.querySelector('.ws-side').innerHTML = words(v);
      if (v.nope !== nope) {
        nope = v.nope;
        root.querySelector('.ws-grid').classList.add('shake');
      }
    }

    function moveCursor(dx, dy) {
      cursor.x = (cursor.x + dx + view.n) % view.n;
      cursor.y = (cursor.y + dy + view.n) % view.n;
      render();
    }


    return {
      sounds: function (prev, v) {
        if (v.phase === 'over' && prev.phase !== 'over') return ['fanfare'];
        if (v.found.length > prev.found.length) return ['correct'];
        if (v.nope > prev.nope) return ['wrong'];
        return [];
      },
      padHint: 'D-pad move · A on the first letter, then A on the last · B let go',
      pad: function (btn, v) {
        if (v.phase !== 'play') return null;
        if (btn === 'UP') moveCursor(0, -1);
        else if (btn === 'DOWN') moveCursor(0, 1);
        else if (btn === 'LEFT') moveCursor(-1, 0);
        else if (btn === 'RIGHT') moveCursor(1, 0);
        else if (btn === 'B') {
          from = null;
          render();
        } else if (btn === 'A') {
          const at = cursor.y * v.n + cursor.x;
          if (from === null || from === at) {
            from = from === at ? null : at;
            render();
            return null;
          }
          const input = { type: 'mark', a: from, b: at };
          from = null;
          render();
          return input;
        }
        return null;
      },
      overHtml: function (v) {
        return 'All ' + v.words.length + ' words found on the ' + v.variant + ' grid';
      },
      mount: function (el) {
        root = document.createElement('div');
        root.className = 'ws-host';
        root.innerHTML = '<div class="ws-stats"></div><div class="ws-main"><div class="ws-field"></div><div class="ws-side"></div></div>';
        el.appendChild(root);
        ready.then(render);
      },
      update: function (v) {
        if (!view || view.n !== v.n || v.found.length < view.found.length) {
          cursor.x = cursor.y = Math.floor(v.n / 2);
          from = null;
          nope = v.nope;
        }
        view = v;
        render();
      },
      unmount: function () {
        root = view = null;
        key = '';
        from = null;
      },
};
  })();

  // ---- the phone ----
  const player = (function () {

    const ready = Promise.resolve();

    let root = null;
    let field = null;
    let api = null;
    let view = null;
    let key = '';
    let nope = 0;
    // Drag from the first letter to the last, or tap one then the other.
    let from = null;
    let to = null;
    let dragging = false;

    function render() {
      const v = view;
      if (!v || !root) return;
      const k = JSON.stringify([v.grid, v.found, v.words, from, to, v.phase]);
      if (k === key) return;
      key = k;
      field.innerHTML = html(v, { from: from, to: to });
      root.querySelector('.ws-side').innerHTML = words(v);
      if (v.nope !== nope) {
        nope = v.nope;
        field.querySelector('.ws-grid').classList.add('shake');
        api.vibrate([40, 30, 40]);
      }
    }

    // The cell under the finger (pointer capture keeps events on the grid while dragging).
    function cellAt(e) {
      const el = document.elementFromPoint(e.clientX, e.clientY);
      const cell = el && el.closest && el.closest('[data-cell]');
      return cell ? Number(cell.getAttribute('data-cell')) : null;
    }

    function finish(a, b) {
      from = to = null;
      if (a !== b) {
        api.send({ type: 'mark', a: a, b: b });
        api.vibrate(10);
      }
      render();
    }

    function down(e) {
      const cell = cellAt(e);
      if (cell === null || !view || view.phase !== 'play') return;
      e.preventDefault();
      field.setPointerCapture(e.pointerId);
      // A second tap ends a mark started with a tap.
      if (from !== null && !dragging && cell !== from) return finish(from, cell);
      from = to = cell;
      dragging = true;
      render();
    }
    function move(e) {
      if (!dragging) return;
      const cell = cellAt(e);
      if (cell !== null && cell !== to) {
        to = cell;
        render();
      }
    }
    function up() {
      if (!dragging) return;
      dragging = false;
      if (to !== from) finish(from, to); // a drag; a plain tap waits for the last letter
    }


    return {
      mount: function (el, a) {
        api = a;
        root = document.createElement('div');
        root.className = 'ws-phone';
        root.innerHTML = '<div class="ws-field"></div><div class="ws-side"></div><p class="muted hint">Drag from the first letter to the last (or tap both).</p>';
        el.appendChild(root);
        field = root.querySelector('.ws-field');
        field.addEventListener('pointerdown', down);
        field.addEventListener('pointermove', move);
        field.addEventListener('pointerup', up);
        field.addEventListener('pointercancel', function () { dragging = false; from = to = null; render(); });
        ready.then(render);
      },
      update: function (v) {
        if (!view || v.found.length < view.found.length) nope = v.nope;
        view = v;
        render();
      },
      unmount: function () {
        root = field = view = null;
        key = '';
        from = to = null;
        dragging = false;
      },
};
  })();

  window.ArkWordSearch = { host: host, player: player };
})();
