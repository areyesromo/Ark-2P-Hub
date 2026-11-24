(function () {
  Ark.loadCss('/games/hangman-1p/style.css');
  const ready = Ark.loadScript('/games/hangman-1p/board.js');

  let root = null;
  let view = null;
  let key = '';
  const cursor = { r: 0, c: 0 }; // a controller's place on the on-screen keyboard

  function render() {
    const v = view;
    if (!v || !root || !window.ArkHangman) return;
    const local = v.player && v.player.local && v.phase === 'play';
    const k = JSON.stringify([v.pattern, v.hits, v.misses, v.wrong, v.phase, v.score, local && cursor]);
    if (k === key) return;
    key = k;
    const last = v.last;
    root.querySelector('.hm-top').innerHTML = '<span>Word <strong>' + v.wordNo + '</strong></span><span>Score <strong>' + Ark.formatScore(v.score, 'pts') + '</strong></span>' +
      '<span class="lives">' + '❤️'.repeat(v.maxWrong - v.wrong) + '<span class="gone">' + '🖤'.repeat(v.wrong) + '</span></span>';
    root.querySelector('.hm-main').innerHTML = window.ArkHangman.gallows(v.wrong, v.maxWrong) + '<div class="hm-side">' + window.ArkHangman.word(v) +
      '<div class="hm-msg">' + (v.phase === 'between' && last ? '✓ +' + last.points + ' points' : v.phase === 'over' && last && !last.ok ? 'The word was <strong>' + last.word.toUpperCase() + '</strong>' : '') + '</div></div>';
    root.querySelector('.hm-keys').innerHTML = window.ArkHangman.keyboard(v, local ? cursor : null);
  }

  function moveCursor(dr, dc) {
    const rows = window.ArkHangman.ROWS;
    cursor.r = (cursor.r + dr + rows.length) % rows.length;
    cursor.c = Math.min(cursor.c, rows[cursor.r].length - 1);
    cursor.c = (cursor.c + dc + rows[cursor.r].length) % rows[cursor.r].length;
    render();
  }

  Ark.register('host', 'hangman-1p', {
    sounds: function (prev, v) {
      if (v.last && (!prev.last || v.last.n !== prev.last.n)) return [v.last.ok ? 'correct' : 'crash'];
      if (v.wrong > prev.wrong) return ['wrong'];
      if (v.hits.length > prev.hits.length) return ['lock'];
      return [];
    },
    padHint: 'D-pad pick a letter · A guess it · keyboard: just type',
    pad: function (btn, v) {
      if (v.phase !== 'play') return null;
      if (btn === 'UP') moveCursor(-1, 0);
      else if (btn === 'DOWN') moveCursor(1, 0);
      else if (btn === 'LEFT') moveCursor(0, -1);
      else if (btn === 'RIGHT') moveCursor(0, 1);
      else if (btn === 'A') return { type: 'guess', letter: window.ArkHangman.ROWS[cursor.r][cursor.c].toLowerCase() };
      return null;
    },
    typing: function (k, v) {
      if (v.phase !== 'play' || !/^[a-zA-Z]$/.test(k)) return null;
      return { type: 'guess', letter: k.toLowerCase() };
    },
    overHtml: function (v) {
      return v.solved + ' word' + (v.solved === 1 ? '' : 's') + (v.perfects ? ' · ' + v.perfects + ' without a slip' : '');
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'hm-host';
      root.innerHTML = '<div class="hm-top"></div><div class="hm-main"></div><div class="hm-keys"></div>';
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
      cursor.r = cursor.c = 0;
    },
  });
})();
