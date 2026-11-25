// Minesweeper, the 1 player mode of Mine Duel (view.solo): the TV's and the phone's screens.
// The game's own renderers hand over to these (window.ArkSweeper.host / .player).
(function () {

  const FACE = { '#': '', F: '🚩', '*': '💣', X: '💥', W: '❌', 0: '' };

  /**
   * The board's markup. opts.transpose draws it turned (columns as rows), for a
   * wide board on an upright phone; opts.cursor outlines a cell (the TV's controller cursor).
   * Each cell carries data-cell, its index on the server's board.
   */
  function html(v, opts) {
    opts = opts || {};
    const cols = opts.transpose ? v.h : v.w;
    const rows = opts.transpose ? v.w : v.h;
    let out = '<div class="mines-grid" style="--cols:' + cols + ';--rows:' + rows + '">';
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const x = opts.transpose ? r : c;
        const y = opts.transpose ? c : r;
        const i = y * v.w + x;
        const ch = v.board[i];
        const open = ch >= '0' && ch <= '8';
        out += '<button type="button" class="cell' + (open ? ' open n' + ch : ch === '#' ? '' : ' mark m' + ch) + (opts.cursor === i ? ' cursor' : '') +
          '" data-cell="' + i + '">' + (open ? (ch === '0' ? '' : ch) : FACE[ch]) + '</button>';
      }
    }
    return out + '</div>';
  }


  // ---- the TV ----
  const host = (function () {

    const ready = Promise.resolve();

    let root = null;
    let field = null;
    let stats = null;
    let view = null;
    let boardKey = '';
    let statsKey = '';
    const cursor = { x: 0, y: 0 }; // a controller player's cursor

    function render() {
      const v = view;
      if (!v) return;
      const local = v.player && v.player.local && v.phase === 'play';
      const at = cursor.y * v.w + cursor.x;
      const key = v.board + '|' + (local ? at : '');
      if (key !== boardKey) {
        boardKey = key;
        field.innerHTML = html(v, { cursor: local ? at : null });
      }
      const left = v.mines - v.flags;
      const s = '<span>💣 <strong>' + left + '</strong> left</span><span>⏱ <strong>' + Ark.clock(v.elapsed) + '</strong></span>' +
        (v.phase === 'play' && !v.started ? '<span class="muted">Open any cell to start: the first one is always safe</span>' : '') +
        (v.phase === 'over' ? '<span class="' + (v.won ? 'won' : 'lost') + '">' + (v.won ? '🎉 Cleared!' : '💥 Boom') + '</span>' : '');
      if (s !== statsKey) {
        statsKey = s;
        stats.innerHTML = s;
      }
    }

    function moveCursor(dx, dy) {
      cursor.x = (cursor.x + dx + view.w) % view.w;
      cursor.y = (cursor.y + dy + view.h) % view.h;
      render();
    }


    return {
      sounds: function (prev, v) {
        if (v.phase === 'over' && prev.phase !== 'over') return [v.won ? 'correct' : 'boom'];
        if (v.flags !== prev.flags) return ['flag'];
        if (v.board !== prev.board) return ['lock'];
        return [];
      },
      padHint: 'D-pad / arrows move · A / Enter open · X / Q flag',
      pad: function (btn, v) {
        if (v.phase !== 'play') return null;
        if (btn === 'UP') moveCursor(0, -1);
        else if (btn === 'DOWN') moveCursor(0, 1);
        else if (btn === 'LEFT') moveCursor(-1, 0);
        else if (btn === 'RIGHT') moveCursor(1, 0);
        else if (btn === 'A') return { type: 'open', cell: cursor.y * v.w + cursor.x };
        else if (btn === 'X' || btn === 'B') return { type: 'flag', cell: cursor.y * v.w + cursor.x };
        return null;
      },
      overHtml: function (v) {
        return v.won ? 'Cleared ' + v.w + '×' + v.h + ' with ' + v.mines + ' mines' : 'Only a cleared field sets a time';
      },
      mount: function (el) {
        root = document.createElement('div');
        root.className = 'mines-host';
        root.innerHTML = '<div class="mines-stats"></div><div class="mines-field"></div>';
        el.appendChild(root);
        field = root.querySelector('.mines-field');
        stats = root.querySelector('.mines-stats');
        ready.then(render);
      },
      update: function (v) {
        if (!view || view.w !== v.w) {
          cursor.x = Math.floor(v.w / 2);
          cursor.y = Math.floor(v.h / 2);
        }
        view = v;
        render();
      },
      unmount: function () {
        root = field = stats = view = null;
        boardKey = statsKey = '';
      },
};
  })();

  // ---- the phone ----
  const player = (function () {

    const ready = Promise.resolve();
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
      if (!v || !root) return;
      const t = transpose(v);
      const key = v.board + t;
      if (key !== boardKey) {
        boardKey = key;
        field.innerHTML = html(v, { transpose: t });
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


    return {
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
};
  })();

  window.ArkSweeper = { host: host, player: player };
})();
