(function () {
  Ark.loadCss('/games/minesweeper-1p/style.css');
  const ready = Ark.loadScript('/games/minesweeper-1p/board.js');
  const LONG_PRESS_MS = 450;

  let root = null;
  let field = null;
  let info = null;
  let modeBtn = null;
  let api = null;
  let view = null;
  let flagMode = false;
  let boardKey = '';
  let press = null; // { cell, timer, flagged } while a finger is down

  // A wide board (Hard is 30×16) is drawn turned on an upright phone, so cells stay tappable.
  const transpose = function (v) { return v.w > v.h && window.innerHeight > window.innerWidth; };

  function render() {
    const v = view;
    if (!v || !window.ArkMines || !root) return;
    const t = transpose(v);
    const key = v.board + t;
    if (key !== boardKey) {
      boardKey = key;
      field.innerHTML = window.ArkMines.html(v, { transpose: t });
      field.classList.toggle('big', (t ? v.h : v.w) <= 9);
    }
    info.innerHTML = '💣 <strong>' + (v.mines - v.flags) + '</strong> left · ⏱ ' + Ark.clock(v.elapsed) +
      (v.best === null || v.best === undefined ? '' : ' · best ' + Ark.clock(v.best));
    modeBtn.textContent = flagMode ? '🚩 Flagging (tap to dig)' : '⛏ Digging (tap to flag)';
    modeBtn.classList.toggle('on', flagMode);
  }

  function cellOf(e) {
    const el = e.target.closest && e.target.closest('[data-cell]');
    return el ? Number(el.getAttribute('data-cell')) : null;
  }

  // Tap: dig (or flag, in flag mode). Hold: flag, whatever the mode.
  function down(e) {
    const cell = cellOf(e);
    if (cell === null || !view || view.phase !== 'play') return;
    press = { cell: cell, flagged: false };
    press.timer = setTimeout(function () {
      if (!press) return;
      press.flagged = true;
      api.send({ type: 'flag', cell: press.cell });
      api.vibrate(30);
    }, LONG_PRESS_MS);
  }
  function up(e) {
    if (!press) return;
    clearTimeout(press.timer);
    const p = press;
    press = null;
    if (p.flagged || cellOf(e) !== p.cell) return;
    api.send({ type: flagMode ? 'flag' : 'open', cell: p.cell });
    api.vibrate(10);
  }
  function cancel() {
    if (press) clearTimeout(press.timer);
    press = null;
  }

  Ark.register('player', 'minesweeper-1p', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'mines-phone';
      root.innerHTML = '<div class="info"></div><div class="mines-field"></div><button class="mode">⛏ Digging</button><p class="muted hint">Hold a cell to flag it.</p>';
      el.appendChild(root);
      info = root.querySelector('.info');
      field = root.querySelector('.mines-field');
      modeBtn = root.querySelector('.mode');
      modeBtn.addEventListener('click', function () { flagMode = !flagMode; render(); });
      field.addEventListener('pointerdown', down);
      field.addEventListener('pointerup', up);
      field.addEventListener('pointercancel', cancel);
      field.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      window.addEventListener('resize', render);
      ready.then(render);
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      cancel();
      window.removeEventListener('resize', render);
      root = field = info = modeBtn = view = null;
      boardKey = '';
      flagMode = false;
    },
  });
})();
