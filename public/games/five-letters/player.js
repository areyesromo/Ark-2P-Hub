(function () {
  Ark.loadCss('/games/five-letters/style.css');
  const ready = Ark.loadScript('/games/five-letters/tiles.js');
  const ROWS = ['qwertyuiop', 'asdfghjkl', '⏎zxcvbnm⌫'];

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let typed = '';
  let sentWord = null; // sent, waiting for the server's colours
  let shake = false;
  let lastRejected = 0;
  let seen = 0; // my rows already shown (new ones flip in)
  let seenRound = 0;
  let gotAt = 0;
  let tick = null;

  function canType() {
    return view && view.phase === 'play' && !view.done[view.you] && sentWord === null;
  }

  function press(key) {
    if (!view) return;
    if (!canType()) return;
    if (key === '⌫') typed = typed.slice(0, -1);
    else if (key === '⏎') {
      if (typed.length < view.letters) { shake = true; render(); return api.vibrate([20, 30, 20]); }
      api.send({ type: 'guess', word: typed });
      sentWord = typed;
      api.vibrate(15);
    } else if (typed.length < view.letters) typed += key;
    shake = false;
    render();
  }

  function onClick(e) {
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    const k = e.target.closest('[data-key]');
    if (k) press(k.getAttribute('data-key'));
  }

  function onKey(e) {
    if (!root || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
    else if (e.key === 'Backspace') press('⌫');
    else if (e.key === 'Enter') press('⏎');
    else return;
    e.preventDefault();
  }

  function keyboard(v) {
    const states = ArkFL.keyStates(v.boards[v.you]);
    return '<div class="fl-keys">' + ROWS.map(function (row) {
      return '<div class="fl-krow">' + row.split('').map(function (k) {
        const wide = k === '⏎' || k === '⌫';
        return '<button class="fl-key' + (wide ? ' wide' : '') + (states[k] ? ' ' + states[k] : '') + '" data-key="' + k + '"' +
          (k === '⏎' ? ' aria-label="Enter"' : k === '⌫' ? ' aria-label="Delete"' : '') + '>' + (k === '⏎' ? 'Enter' : k) + '</button>';
      }).join('') + '</div>';
    }).join('') + '</div>';
  }

  function clockText(v) {
    const left = Math.max(0, v.timeLeftMs - (Date.now() - gotAt));
    return Math.floor(left / 60000) + ':' + String(Math.floor(left / 1000) % 60).padStart(2, '0');
  }

  function status(v) {
    const me = v.you;
    if (v.phase === 'over') return v.winner === me ? '<span class="ark-result won">You win! 🏆</span>' : '<span class="ark-result lost">You lose</span>';
    if (v.phase === 'roundEnd') {
      const r = v.result;
      return (r.winner === null ? 'Nobody got it' : r.winner === me ? '<span class="won">You take the round!</span>' : '<span class="lost">They take the round</span>') +
        ' · <b class="fl-answer">' + ArkFL.esc(r.word) + '</b>';
    }
    if (v.solved[me]) return '<span class="won">Got it in ' + v.boards[me].length + '!</span> Waiting for them…';
    if (v.done[me]) return 'Out of guesses. Waiting for them…';
    if (shake && v.rejected && typed === v.rejected.word) return '<span class="lost">Not a word we know</span>';
    return 'Guess ' + (v.boards[me].length + 1) + ' of ' + v.maxGuesses + (v.timed ? ' · <span class="fl-pclock">' + clockText(v) + '</span>' : '');
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    if (v.round !== seenRound) { seen = 0; seenRound = v.round; typed = ''; sentWord = null; }
    const mine = v.boards[me].slice();
    if (sentWord !== null) mine.push({ word: sentWord, marks: 'ppppp' }); // (sent: shown at once, coloured when the server answers)
    const theirs = v.boards[1 - me];
    root.innerHTML =
      '<div class="fl-top"><span>You ' + v.scores[me] + ' – ' + v.scores[1 - me] + ' Them</span>' +
      '<div class="fl-them"><small>Them</small>' + ArkFL.board(theirs, { rows: v.maxGuesses, letters: v.letters, small: true }) + '</div></div>' +
      '<p class="fl-status">' + status(v) + '</p>' +
      ArkFL.board(mine, { rows: v.maxGuesses, letters: v.letters, seen: seen, typing: canType() ? typed : null, shake: shake }) +
      (v.phase === 'over' ? '<button class="primary rematch">Rematch</button>' : keyboard(v));
    seen = v.boards[me].length;
  }

  Ark.register('player', 'five-letters', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'fl-phone';
      root.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
      el.appendChild(root);
      tick = setInterval(function () {
        const c = root && root.querySelector('.fl-pclock');
        if (c && view) c.textContent = clockText(view);
      }, 250);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      gotAt = Date.now();
      if (sentWord !== null && (v.boards[v.you].length > (prev ? prev.boards[v.you].length : 0) || v.round !== (prev && prev.round))) {
        sentWord = null;
        typed = '';
      }
      // Not a word: the row shakes and stays typed.
      if (v.rejected && v.rejected.n !== lastRejected) {
        lastRejected = v.rejected.n;
        if (sentWord !== null) { typed = sentWord; sentWord = null; shake = true; api.vibrate([30, 40, 30]); }
      }
      if (prev && v.phase !== 'play' && prev.phase === 'play' && v.result) api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200);
      render();
    },
    unmount: function () {
      clearInterval(tick);
      document.removeEventListener('keydown', onKey);
      root = view = null;
      typed = '';
      sentWord = null;
      seen = seenRound = 0;
    },
  });
})();
