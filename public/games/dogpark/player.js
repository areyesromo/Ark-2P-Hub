(function () {
  Ark.loadCss('/games/dogpark/style.css');
  const ready = Ark.loadScript('/games/dogpark/board.js');

  let root = null;
  let api = null;
  let view = null;
  let key = '';
  let clearArmed = false;
  let drag = null; // { start, moved, seen } while a finger is down on the park

  function render() {
    const v = view;
    if (!v || !root || !window.ArkDogPark) return;
    root.querySelector('.info').innerHTML =
      '<span>' + (v.level ? 'Level <strong>' + v.level + '</strong>' : 'Random') + ' · ' + v.n + '×' + v.n + '</span>' +
      '<span>⏱ ' + Ark.clock(v.elapsed) + (v.par ? ' / ' + window.ArkDogPark.par(v.par) : '') + '</span>' +
      '<span>🐕 <strong>' + v.dogs + '</strong>/' + v.n + (v.best === null || v.best === undefined ? '' : ' · best ' + Ark.clock(v.best)) + '</span>';
    const play = v.phase === 'play';
    const tools = root.querySelector('.dgp-tools');
    tools.querySelector('.undo').disabled = !play || !v.canUndo;
    tools.querySelector('.fill').disabled = !play || !v.dogs;
    tools.querySelector('.fill').textContent = (v.look === 'aussie' ? '🦴' : '🎾') + ' Fill';
    tools.querySelector('.hint').disabled = !play;
    tools.querySelector('.clear').disabled = !play;
    tools.querySelector('.clear').textContent = clearArmed ? 'Sure?' : '🧹 Clear';
    tools.querySelector('.clear').classList.toggle('armed', clearArmed);
    tools.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
    tools.querySelector('.pause').disabled = v.phase === 'over';
    const k = JSON.stringify([v.marks, v.regions, v.clashes, v.hint, v.phase, v.look]);
    if (k === key) return;
    key = k;
    const park = root.querySelector('.dgp-park');
    park.style.setProperty('--n', v.n);
    park.classList.toggle('won', v.won);
    park.innerHTML = window.ArkDogPark.html(v, null);
  }

  const cellAt = function (x, y) {
    const el = document.elementFromPoint(x, y);
    const sq = el && el.closest && el.closest('.dgp-sq');
    return sq && root.contains(sq) ? Number(sq.getAttribute('data-i')) : null;
  };
  const open = function (i) { return i !== null && view.regions[i] >= 0; };

  Ark.register('player', 'dogpark', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'dgp-phone';
      root.innerHTML = '<div class="info"></div><div class="dgp-park"></div><div class="dgp-rules"></div>' +
        '<div class="dgp-tools"><button type="button" class="undo">↶ Undo</button><button type="button" class="fill">🎾 Fill</button>' +
        '<button type="button" class="hint">💡 Hint +30 s</button><button type="button" class="clear">🧹 Clear</button><button type="button" class="pause">⏸ Pause</button></div>';
      el.appendChild(root);
      const park = root.querySelector('.dgp-park');
      // A tap goes empty → ball → dog → empty. Dragging across the park drops a ball on every empty square it passes.
      park.addEventListener('pointerdown', function (e) {
        if (!view || view.phase !== 'play') return;
        const i = cellAt(e.clientX, e.clientY);
        if (!open(i)) return;
        e.preventDefault();
        drag = { start: i, moved: false, seen: {} };
        drag.seen[i] = true;
      });
      park.addEventListener('pointermove', function (e) {
        if (!drag) return;
        const i = cellAt(e.clientX, e.clientY);
        if (!open(i) || drag.seen[i]) return;
        if (!drag.moved) {
          drag.moved = true;
          if (view.marks[drag.start] === 0) api.send({ type: 'mark', cell: drag.start, mark: 1 });
        }
        drag.seen[i] = true;
        if (view.marks[i] === 0) {
          api.send({ type: 'mark', cell: i, mark: 1 });
          api.vibrate(3);
        }
      });
      const end = function () {
        if (!drag) return;
        if (!drag.moved) {
          api.send({ type: 'tap', cell: drag.start });
          api.vibrate(view.marks[drag.start] === 1 ? 15 : 5);
        }
        drag = null;
      };
      park.addEventListener('pointerup', end);
      park.addEventListener('pointercancel', function () { drag = null; });
      root.querySelector('.dgp-tools').addEventListener('click', function (e) {
        const b = e.target.closest('button');
        if (!b || !view) return;
        if (!b.classList.contains('clear')) clearArmed = false;
        if (b.classList.contains('undo')) api.send({ type: 'undo' });
        else if (b.classList.contains('fill')) api.send({ type: 'fill' });
        else if (b.classList.contains('hint')) api.send({ type: 'hint' });
        else if (b.classList.contains('pause')) api.send({ type: 'pause' });
        else if (b.classList.contains('clear')) {
          if (clearArmed) api.send({ type: 'clear' });
          clearArmed = !clearArmed;
        }
        render();
      });
      ready.then(function () {
        root.querySelector('.dgp-rules').textContent = window.ArkDogPark.RULES;
        render();
      });
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = drag = null;
      key = '';
      clearArmed = false;
    },
  });
})();
