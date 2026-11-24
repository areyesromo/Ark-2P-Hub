(function () {
  Ark.loadCss('/games/wordsearch-1p/style.css');
  const ready = Ark.loadScript('/games/wordsearch-1p/board.js');

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
    if (!v || !root || !window.ArkWordSearch) return;
    const k = JSON.stringify([v.grid, v.found, v.words, from, to, v.phase]);
    if (k === key) return;
    key = k;
    field.innerHTML = window.ArkWordSearch.html(v, { from: from, to: to });
    root.querySelector('.ws-side').innerHTML = window.ArkWordSearch.words(v);
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

  Ark.register('player', 'wordsearch-1p', {
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
  });
})();
