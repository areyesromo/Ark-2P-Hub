(function () {
  Ark.loadCss('/games/word-hunt/style.css');
  const ready = Ark.loadScript('/games/word-hunt/board.js');

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

  function top(v) {
    const you = v.you;
    if (v.phase === 'countdown') return 'Grid ' + v.round + ' coming up…';
    if (v.phase === 'over') return v.winner === you ? '<span class="won">You win! 🏆</span>' : '<span class="lost">You lose</span>';
    const r = v.result;
    if (v.phase === 'result' && r) return r.winner === null ? 'Level: nobody takes this grid' : r.winner === you ? '<span class="won">Your grid!</span>' : '<span class="lost">Their grid</span>';
    return 'You <strong>' + v.counts[you] + '</strong> – ' + v.counts[1 - you] + ' Them · grids ' + v.scores[you] + ' – ' + v.scores[1 - you];
  }

  function render() {
    const v = view;
    if (!root || !v || !window.ArkHunt) return;
    const k = JSON.stringify([v.phase, v.round, v.scores, v.grid, v.found, v.words, v.result, from, to]);
    if (k === key) return;
    key = k;
    root.querySelector('.info').innerHTML = top(v);
    field.innerHTML = v.grid ? window.ArkHunt.html(v, from === null ? [] : [{ slot: v.you, from: from, to: to }]) : '';
    root.querySelector('.wh-list').innerHTML = v.grid ? window.ArkHunt.words(v) : '';
    root.querySelector('.rematch').style.display = v.phase === 'over' ? '' : 'none';
    if (v.nope[v.you] > nope) {
      const g = field.querySelector('.wh-grid');
      if (g) g.classList.add('shake');
      api.vibrate([40, 30, 40]);
    }
    nope = v.nope[v.you];
  }

  // The cell under the finger (pointer capture keeps events on the grid while dragging).
  function cellAt(e) {
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cell = el && el.closest && el.closest('[data-cell]');
    return cell ? Number(cell.getAttribute('data-cell')) : null;
  }

  function finish(a, b) {
    from = to = null;
    if (a !== b && window.ArkHunt.line(view.n, a, b)) {
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

  Ark.register('player', 'word-hunt', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'wh-phone';
      root.innerHTML = '<div class="info"></div><div class="wh-field"></div><div class="wh-list"></div><p class="muted hint">Drag from a word\'s first letter to its last (or tap both).</p><button class="primary rematch" style="display:none">Rematch</button>';
      el.appendChild(root);
      field = root.querySelector('.wh-field');
      field.addEventListener('pointerdown', down);
      field.addEventListener('pointermove', move);
      field.addEventListener('pointerup', up);
      field.addEventListener('pointercancel', function () { dragging = false; from = to = null; render(); });
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
      ready.then(render);
    },
    update: function (v) {
      if (!view || view.round !== v.round) {
        from = to = null;
        dragging = false;
        nope = v.nope[v.you];
      }
      view = v;
      render();
    },
    unmount: function () {
      root = field = view = null;
      key = '';
      from = to = null;
      dragging = false;
    },
  });
})();
