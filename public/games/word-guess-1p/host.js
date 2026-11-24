(function () {
  Ark.loadCss('/games/word-guess-1p/style.css');
  const ready = Ark.loadScript('/games/word-guess-1p/board.js');

  let root = null;
  let view = null;
  let key = '';
  let shakeN = 0;
  let shown = 0; // guesses already on screen: only a new one turns over
  const cursor = { r: 0, c: 0 }; // a controller's place on the on-screen keyboard

  function render() {
    const v = view;
    if (!v || !window.ArkSoloWords || !root) return;
    const local = v.player && v.player.local && v.phase === 'play';
    const k = JSON.stringify([v.guesses, v.entry, v.keys, v.phase, v.message, local && cursor]);
    if (k === key) return;
    key = k;
    root.querySelector('.wg-title').innerHTML = v.daily ? '📅 Today\'s word <span class="muted">' + Ark.escapeHtml(v.day) + '</span>' : '🎲 Practice';
    if (v.guesses.length < shown) shown = 0; // a new run
    root.querySelector('.wg-main').innerHTML = window.ArkSoloWords.board(v, v.guesses.length > shown ? v.guesses.length - 1 : -1);
    shown = v.guesses.length;
    root.querySelector('.wg-kb').innerHTML = window.ArkSoloWords.keyboard(v, local ? cursor : null);
    const msg = root.querySelector('.wg-msg');
    msg.textContent = v.phase === 'over' ? (v.solved ? '' : 'The word was ' + v.answer.toUpperCase()) : v.message ? v.message.text : '';
    // A guess that wasn't taken shakes the row.
    if (v.message && v.message.n !== shakeN) {
      shakeN = v.message.n;
      const row = root.querySelector('.wg-row.current');
      if (row) row.classList.add('shake');
    }
  }

  function moveCursor(dr, dc) {
    const rows = window.ArkSoloWords.ROWS;
    cursor.r = (cursor.r + dr + rows.length) % rows.length;
    cursor.c = Math.min(cursor.c, rows[cursor.r].length - 1);
    cursor.c = (cursor.c + dc + rows[cursor.r].length) % rows[cursor.r].length;
    render();
  }

  Ark.register('host', 'word-guess-1p', {
    sounds: function (prev, v) {
      if (v.guesses.length > prev.guesses.length) return [v.solved ? 'correct' : 'reveal'];
      if (v.message && (!prev.message || v.message.n !== prev.message.n)) return ['wrong'];
      if (v.entry.length > prev.entry.length) return ['lock'];
      return [];
    },
    padHint: 'D-pad pick a key · A type it · B delete · Start / X enter · keyboard: just type',
    pad: function (btn, v) {
      if (v.phase !== 'play') return null;
      if (btn === 'UP') moveCursor(-1, 0);
      else if (btn === 'DOWN') moveCursor(1, 0);
      else if (btn === 'LEFT') moveCursor(0, -1);
      else if (btn === 'RIGHT') moveCursor(0, 1);
      else if (btn === 'A') return window.ArkSoloWords.input(window.ArkSoloWords.ROWS[cursor.r][cursor.c]);
      else if (btn === 'B') return { type: 'back' };
      else if (btn === 'START' || btn === 'X') return { type: 'enter' };
      return null;
    },
    typing: function (k) {
      if (/^[a-zA-Z]$/.test(k)) return { type: 'letter', letter: k.toLowerCase() };
      if (k === 'Backspace') return { type: 'back' };
      if (k === 'Enter') return { type: 'enter' };
      return null;
    },
    overHtml: function (v) {
      if (v.already) return 'You\'ve played today\'s word: a new one comes at midnight (UTC). Change settings for practice.';
      return v.solved ? 'The word was ' + v.answer.toUpperCase() : 'The word was ' + v.answer.toUpperCase() + ' · a word not found doesn\'t count';
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'wg-host';
      root.innerHTML = '<div class="wg-title"></div><div class="wg-main"></div><div class="wg-msg"></div><div class="wg-kb"></div>';
      el.appendChild(root);
      ready.then(render);
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      key = '';
      shown = 0;
      cursor.r = cursor.c = 0;
    },
  });
})();
