// Five Letters on the TV: both boards side by side, or in the 1 player mode (view.solo) your
// board with the word as you type it and a keyboard a controller can type on.
(function () {
  Ark.loadCss('/games/five-letters/style.css');
  const ready = Ark.loadScript('/games/five-letters/tiles.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  let seen = [0, 0]; // rows already shown on each board (new ones flip in)
  let seenRound = 0;
  let seenOpen = false; // the letters went up at the round's end
  let gotAt = 0; // when the view came (the clock counts down from it between views)
  let tick = null;

  const cursor = { r: 0, c: 0 }; // 1 player: a controller's place on the on-screen keyboard
  let soloSeen = 0;
  let soloShake = 0;

  /** 1 player: the title, your board (the row being typed shows as you go), why a guess wasn't taken, the keyboard. */
  function renderSolo(v) {
    const local = v.player && v.player.local && v.phase === 'play';
    if (v.board.length < soloSeen) soloSeen = 0; // (a new word)
    const shaking = Boolean(v.message && v.message.n !== soloShake);
    if (shaking) soloShake = v.message.n;
    const msg = v.phase === 'over' ? (v.solved ? '' : 'The word was ' + v.answer.toUpperCase()) : v.message ? v.message.text : '';
    root.innerHTML = '<div class="fl-solo">' +
      '<div class="fl-title">' + (v.daily ? '📅 Today\'s word <span class="muted">' + esc(v.day) + '</span>' : '🎲 Practice') + '</div>' +
      ArkFL.board(v.board, { rows: v.maxGuesses, letters: v.letters, seen: soloSeen, typing: v.phase === 'play' ? v.entry : null, shake: shaking }) +
      '<div class="fl-msg">' + esc(msg) + '</div>' +
      (v.phase === 'play' ? ArkFL.keyboard(ArkFL.keyStates(v.board), local ? cursor : null) : '') +
      '</div>';
    soloSeen = v.board.length;
  }

  function moveCursor(dr, dc) {
    const rows = ArkFL.ROWS;
    cursor.r = (cursor.r + dr + rows.length) % rows.length;
    cursor.c = Math.min(cursor.c, rows[cursor.r].length - 1);
    cursor.c = (cursor.c + dc + rows[cursor.r].length) % rows[cursor.r].length;
    render();
  }

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function side(v, slot) {
    const guesses = v.boards[slot];
    let state = '';
    if (v.solved[slot]) state = '<span class="fl-badge solved">Got it in ' + guesses.length + '!</span>';
    else if (v.done[slot]) state = '<span class="fl-badge out">Out of guesses</span>';
    else if (v.phase === 'play') state = '<span class="fl-badge">Guess ' + (guesses.length + 1) + ' of ' + v.maxGuesses + '</span>';
    if (v.result && v.result.winner === slot) state = '<span class="fl-badge win">Takes the round</span>';
    const open = v.phase !== 'play';
    const html = '<section class="fl-side p' + (slot + 1) + (v.result && v.result.winner === slot ? ' won' : '') + '">' +
      '<header>' + nameOf(v, slot) + '</header>' +
      ArkFL.board(guesses, { rows: v.maxGuesses, letters: v.letters, seen: open && !seenOpen ? 0 : seen[slot] }) +
      '<footer>' + state + '</footer></section>';
    return html;
  }

  function middle(v) {
    let html = '<div class="fl-mid">';
    if (v.phase === 'play') {
      html += '<div class="fl-q">?????</div><p>Same word for you both.<br>You see their colours, not their letters.</p>';
      if (v.timed) html += '<div class="fl-clock">' + clockText(v) + '</div>';
    } else {
      html += '<p class="fl-label">The word was</p>' + ArkFL.word(v.result.word);
      if (v.phase === 'over') {
        html += '<div class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins the match</div><p class="fl-sub">Rematch or back to the lobby from your phones.</p>';
      } else {
        html += '<div class="fl-verdict">' + (v.result.winner === null ? 'Nobody got it' : nameOf(v, v.result.winner) + ' takes the round') + '</div>';
      }
    }
    return html + '</div>';
  }

  function clockText(v) {
    const left = Math.max(0, v.timeLeftMs - (Date.now() - gotAt));
    return '⏱ ' + Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0');
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    if (v.solo) return renderSolo(v);
    if (v.round !== seenRound) { seen = [0, 0]; seenRound = v.round; seenOpen = false; }
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="fl-stage">' + side(v, 0) + middle(v) + side(v, 1) + '</div>';
    seen = [v.boards[0].length, v.boards[1].length];
    if (v.phase !== 'play') seenOpen = true;
  }

  Ark.register('host', 'five-letters', {
    sounds: function (prev, v) {
      const out = [];
      if (v.solo) {
        if (!prev.board) return out;
        if (v.board.length > prev.board.length) return [v.solved ? 'correct' : 'reveal'];
        if (v.message && (!prev.message || v.message.n !== prev.message.n)) return ['wrong'];
        if (v.entry.length > prev.entry.length) return ['lock'];
        return out;
      }
      if (!prev.boards) return out;
      if (v.round !== prev.round) return ['start'];
      [0, 1].forEach(function (s) {
        if (v.boards[s].length > prev.boards[s].length) out.push(v.solved[s] ? 'correct' : 'chalk');
      });
      if (v.phase !== 'play' && prev.phase === 'play') out.push('reveal');
      return out;
    },
    // 1 player, on the TV with a controller or its keyboard: pick a key and type, or just type.
    padHint: '1 player: D-pad pick a key · A type it · B delete · Start / X enter · keyboard: just type',
    pad: function (btn, v) {
      if (!v.solo || v.phase !== 'play') return null;
      if (btn === 'UP') moveCursor(-1, 0);
      else if (btn === 'DOWN') moveCursor(1, 0);
      else if (btn === 'LEFT') moveCursor(0, -1);
      else if (btn === 'RIGHT') moveCursor(0, 1);
      else if (btn === 'A') return ArkFL.input(ArkFL.ROWS[cursor.r][cursor.c]);
      else if (btn === 'B') return { type: 'back' };
      else if (btn === 'START' || btn === 'X') return { type: 'enter' };
      return null;
    },
    typing: function (k, v) {
      if (!v || !v.solo) return null;
      if (/^[a-zA-Z]$/.test(k)) return { type: 'letter', letter: k.toLowerCase() };
      if (k === 'Backspace') return { type: 'back' };
      if (k === 'Enter') return { type: 'enter' };
      return null;
    },
    // 1 player: the line under the score on the hub's end screen.
    overHtml: function (v) {
      if (!v.solo) return '';
      if (v.already) return 'You\'ve played today\'s word: a new one comes at midnight (UTC). Change settings for practice.';
      return 'The word was ' + v.answer.toUpperCase() + (v.solved ? '' : ' · a word not found doesn\'t count');
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'fl-host';
      el.appendChild(root);
      tick = setInterval(function () {
        const c = root && root.querySelector('.fl-clock');
        if (c && view) {
          c.textContent = clockText(view);
          c.classList.toggle('low', view.timeLeftMs - (Date.now() - gotAt) < 20000);
        }
      }, 250);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      view = v;
      gotAt = Date.now();
      render();
    },
    unmount: function () {
      clearInterval(tick);
      root = view = null;
      seen = [0, 0];
      seenRound = 0;
      soloSeen = soloShake = 0;
      cursor.r = cursor.c = 0;
    },
  });
})();
