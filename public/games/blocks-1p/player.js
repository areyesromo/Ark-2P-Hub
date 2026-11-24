(function () {
  Ark.loadCss('/games/blocks-1p/style.css');
  const DAS_MS = 170; // hold ◀ ▶ ▼ this long and they repeat
  const ARR_MS = 50;

  let root = null;
  let info = null;
  let api = null;
  let lastKey = '';
  let repeat = null; // { timer } while a repeating button is held
  let clears = null; // the clear count last seen, to buzz on a new one

  const INPUTS = {
    left: { type: 'move', dir: 'left' },
    right: { type: 'move', dir: 'right' },
    soft: { type: 'soft' },
    ccw: { type: 'rotate', dir: 'ccw' },
    cw: { type: 'rotate', dir: 'cw' },
    drop: { type: 'drop' },
    hold: { type: 'hold' },
  };
  const REPEATS = { left: true, right: true, soft: true };

  function stopRepeat() {
    if (repeat) clearTimeout(repeat.timer);
    repeat = null;
  }

  // On touch-down, not on click: a falling piece can't wait for the finger to lift.
  function down(e) {
    const btn = e.target.closest && e.target.closest('[data-b]');
    if (!btn) return;
    e.preventDefault();
    const what = btn.getAttribute('data-b');
    api.send(INPUTS[what]);
    api.vibrate(8);
    stopRepeat();
    if (!REPEATS[what]) return;
    const step = function () {
      api.send(INPUTS[what]);
      repeat.timer = setTimeout(step, ARR_MS);
    };
    repeat = { timer: setTimeout(step, DAS_MS) };
  }

  function render(v) {
    const key = [v.phase, v.score, v.lines, v.level, v.hold, v.next, v.canHold, v.best].join('|');
    if (clears !== null && v.clears > clears && v.cleared) api.vibrate(v.cleared.n === 4 ? [60, 40, 120] : 40);
    clears = v.clears;
    if (key === lastKey) return;
    lastKey = key;
    info.innerHTML =
      '<div class="score">Score <strong>' + Ark.formatScore(v.score, 'pts') + '</strong>' + (v.best === null || v.best === undefined ? '' : ' · best ' + Ark.formatScore(v.best, 'pts')) + '</div>' +
      '<div class="status">Level ' + v.level + ' · ' + v.lines + ' lines · next <strong>' + v.next + '</strong>' + (v.hold ? ' · holding <strong>' + v.hold + '</strong>' : '') + '</div>';
    root.querySelector('[data-b="hold"]').disabled = !v.canHold;
    root.querySelector('.pause').textContent = v.phase === 'paused' ? '▶ Carry on' : '⏸ Pause';
    root.querySelector('.blocks-pad').classList.toggle('off', v.phase !== 'play');
  }

  Ark.register('player', 'blocks-1p', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'blocks-phone';
      root.innerHTML =
        '<div class="info"></div>' +
        '<div class="blocks-pad">' +
        '<button data-b="hold" class="small">Hold</button><button data-b="ccw">⟲</button><button data-b="cw">⟳</button>' +
        '<button data-b="left">◀</button><button data-b="soft">▼</button><button data-b="right">▶</button>' +
        '<button data-b="drop" class="wide">⤓ Drop</button>' +
        '</div>' +
        '<button class="ghost pause">⏸ Pause</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      const pad = root.querySelector('.blocks-pad');
      pad.addEventListener('pointerdown', down);
      ['pointerup', 'pointercancel', 'pointerleave'].forEach(function (ev) { pad.addEventListener(ev, stopRepeat); });
      pad.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      root.querySelector('.pause').addEventListener('click', function () { api.send({ type: 'pause' }); });
    },
    update: render,
    unmount: function () {
      stopRepeat();
      root = info = clears = null;
      lastKey = '';
    },
  });
})();
