(function () {
  Ark.loadCss('/games/traffic/style.css');
  const ready = Ark.loadScript('/games/traffic/board.js');

  let root = null;
  let api = null;
  let view = null;
  let key = '';
  let drag = null; // { car, el, from, lo, hi, start (pointer along the lane), cell (px a square) }

  function render() {
    const v = view;
    if (!v || !root || !window.ArkTraffic) return;
    root.querySelector('.info').innerHTML =
      '<span>' + (v.level ? 'Level <strong>' + v.level + '</strong>' : 'Random') + '</span>' +
      '<span>Moves <strong>' + v.moves + '</strong> / par ' + v.par + '</span>' +
      '<span>' + (v.best === null || v.best === undefined ? '' : 'best ' + v.best) + '</span>';
    const play = v.phase === 'play';
    const tools = root.querySelector('.tj-tools');
    tools.querySelector('.undo').disabled = !play || !v.canUndo;
    tools.querySelector('.restart').disabled = !play || !v.canUndo;
    tools.querySelector('.hint').disabled = !play;
    const k = JSON.stringify([v.cars, v.hint, v.hintNo, v.phase]);
    if (k === key || drag) return;
    key = k;
    const lot = root.querySelector('.tj-lot');
    lot.style.setProperty('--n', v.size);
    lot.innerHTML = window.ArkTraffic.html(v, null);
  }

  Ark.register('player', 'traffic', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'tj-phone';
      root.innerHTML = '<div class="info"></div><div class="tj-lot"></div><div class="tj-rules">Drag a car or truck along its lane · get the red car out on the right</div>' +
        '<div class="tj-tools"><button type="button" class="undo">↶ Undo</button><button type="button" class="hint">💡 Hint +2</button><button type="button" class="restart">↺ Start again</button></div>';
      el.appendChild(root);
      const lot = root.querySelector('.tj-lot');
      lot.addEventListener('pointerdown', function (e) {
        const carEl = e.target.closest('.tj-car');
        if (!carEl || !view || view.phase !== 'play') return;
        e.preventDefault();
        lot.setPointerCapture && lot.setPointerCapture(e.pointerId);
        const i = Number(carEl.getAttribute('data-car'));
        const c = view.cars[i];
        const r = window.ArkTraffic.range(view, i);
        const box = lot.getBoundingClientRect();
        drag = { car: i, el: carEl, across: c.across, from: c.across ? c.x : c.y, lo: r[0], hi: r[1], start: c.across ? e.clientX : e.clientY, cell: box.width / view.size, off: 0 };
        carEl.classList.add('grabbed');
      });
      lot.addEventListener('pointermove', function (e) {
        if (!drag) return;
        // Slide with the finger, as far as the lane is clear.
        const d = ((drag.across ? e.clientX : e.clientY) - drag.start) / drag.cell;
        drag.off = Math.max(drag.lo - drag.from, Math.min(drag.hi - drag.from, d));
        drag.el.style.transform = drag.across ? 'translateX(' + drag.off * 100 / (view.cars[drag.car].len) + '%)' : 'translateY(' + drag.off * 100 / (view.cars[drag.car].len) + '%)';
      });
      const end = function () {
        if (!drag) return;
        const to = drag.from + Math.round(drag.off);
        const d = drag;
        drag = null;
        if (to !== d.from) {
          api.send({ type: 'move', car: d.car, to: to });
          api.vibrate(12);
        } else {
          d.el.style.transform = '';
          d.el.classList.remove('grabbed');
        }
        key = '';
      };
      lot.addEventListener('pointerup', end);
      lot.addEventListener('pointercancel', end);
      root.querySelector('.tj-tools').addEventListener('click', function (e) {
        const b = e.target.closest('button');
        if (!b || !view) return;
        if (b.classList.contains('undo')) api.send({ type: 'undo' });
        else if (b.classList.contains('hint')) api.send({ type: 'hint' });
        else if (b.classList.contains('restart')) api.send({ type: 'restart' });
      });
      ready.then(render);
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = drag = null;
      key = '';
    },
  });
})();
