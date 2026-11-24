(function () {
  Ark.loadCss('/games/hangman/style.css');
  const ready = Ark.loadScript('/games/hangman/gallows.js');

  const ROWS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  const MIN = 4;
  const MAX = 10;

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let typed = '';
  let buzzed = '';
  let shook = 0;

  // The clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);
  const clock = () => '<b class="ark-clock">' + secsLeft() + 's</b>';
  function ticking() {
    tick = setInterval(function () {
      if (root) root.querySelectorAll('.ark-clock').forEach(function (c) { c.textContent = secsLeft() + 's'; });
    }, 250);
  }

  const setting = () => view && view.phase === 'set' && !view.ready[view.you];
  const guessing = () => view && view.phase === 'guess' && !view.done[view.you];

  function press(k) {
    const v = view;
    if (setting()) {
      if (k === '⌫') typed = typed.slice(0, -1);
      else if (k === 'ok') {
        if (typed.length < MIN) return api.vibrate([20, 30, 20]);
        api.send({ type: 'word', word: typed });
        api.vibrate(20);
      } else if (/^[a-z]$/.test(k) && typed.length < MAX) typed += k;
      return render();
    }
    if (guessing() && /^[a-z]$/.test(k) && !v.tried[v.you].includes(k)) {
      api.send({ type: 'letter', letter: k });
      api.vibrate(15);
    }
  }

  function onClick(e) {
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    const k = e.target.closest('[data-k]');
    if (k && !k.disabled) press(k.getAttribute('data-k'));
  }

  function onKey(e) {
    if (!root || e.metaKey || e.ctrlKey || e.altKey) return;
    if (/^[a-zA-Z]$/.test(e.key)) press(e.key.toLowerCase());
    else if (e.key === 'Backspace') press('⌫');
    else if (e.key === 'Enter') press('ok');
    else return;
    e.preventDefault();
  }

  /** The keyboard: while guessing, the letters you've tried go green (in it) or dark (not). */
  function keyboard(v) {
    const me = v.you;
    const mask = v.masks[me] || [];
    const tried = v.phase === 'guess' ? v.tried[me] : [];
    let html = '<div class="hg-keys">';
    ROWS.forEach(function (row, i) {
      html += '<div class="hg-row">';
      if (i === 2 && setting()) html += '<button data-k="⌫" class="wide">⌫</button>';
      for (const c of row) {
        const done = tried.includes(c);
        html += '<button data-k="' + c + '" class="' + (done ? (mask.includes(c) ? 'hit' : 'miss') : '') + '"' + (done ? ' disabled' : '') + '>' + c + '</button>';
      }
      if (i === 2 && setting()) html += '<button data-k="ok" class="wide ok"' + (typed.length < MIN ? ' disabled' : '') + '>Set ✓</button>';
      html += '</div>';
    });
    return html + '</div>';
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'over') return v.winner === me ? '<span class="won big ark-result">You win! 🏆</span>' : '<span class="lost big ark-result">You lose</span>';
    if (v.phase === 'roundEnd') {
      const r = v.result;
      if (r.winner === null) return 'Level round';
      return r.winner === me ? '<span class="won">You got it!</span>' : '<span class="lost">They got yours first</span>';
    }
    if (v.phase === 'set') return v.ready[me] ? 'Word set. Waiting for them…' : '<strong>Pick a secret word</strong> for them (4 to 10 letters)';
    if (v.done[me] === 'solved') return '<span class="won">Solved!</span>';
    if (v.done[me] === 'hanged') return '<span class="lost">Out of letters</span>. Will they get yours?';
    return '<strong>Guess their word</strong> · ' + (v.lives - v.misses[me]) + ' wrong left';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const theirs = v.masks[1 - me];
    let html = '<div class="hg-top"><span>You ' + v.scores[me] + ' – ' + v.scores[1 - me] + ' Them</span>' +
      (v.myWord && !v.hubPicks ? '<span>Your word <b class="hg-mine">' + v.myWord + '</b></span>' : '') + '</div>' +
      '<p class="hg-msg">' + message(v) + (v.timed && v.timeLeftMs && (setting() || guessing()) ? ' <small>' + clock() + '</small>' : '') + '</p>';
    if (setting()) {
      html += '<div class="hg-entry' + (v.rejected && v.rejected.n > shook ? ' shake' : '') + '">' +
        (typed ? typed.split('').map(function (c) { return '<span class="hg-tile found">' + c + '</span>'; }).join('') : '<span class="hg-hint">type a word</span>') + '</div>' +
        (v.rejected ? '<p class="hg-rejected">“' + Ark.escapeHtml(v.rejected.word) + '” isn\'t in the dictionary</p>' : '') + keyboard(v);
      if (v.rejected) shook = v.rejected.n;
    } else if (v.phase !== 'set') {
      const word = v.words ? v.words[1 - me] : null;
      html += '<div class="hg-mine-board">' + ArkHang.gallows(v.misses[me], v.lives, v.done[me]) + ArkHang.tiles(v.masks[me], word) + '</div>';
      if (theirs) html += '<div class="hg-them">Them on yours ' + ArkHang.tiles(theirs, v.words ? v.words[me] : null) + ' <small>' + (v.lives - v.misses[1 - me]) + ' wrong left</small></div>';
      if (guessing()) html += keyboard(v);
    }
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'hangman', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'hg-phone';
      root.addEventListener('click', onClick);
      document.addEventListener('keydown', onKey);
      el.appendChild(root);
      ticking();
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      gotAt = Date.now();
      if (prev && (prev.round !== v.round || prev.phase !== v.phase)) { typed = ''; shook = 0; }
      if (prev && v.phase === 'guess' && prev.misses && v.misses[v.you] > prev.misses[v.you]) api.vibrate(80);
      if (v.rejected && prev && (!prev.rejected || prev.rejected.n !== v.rejected.n)) api.vibrate([30, 40, 30]);
      if (v.result && buzzed !== v.round + v.phase && v.result.winner !== null) { buzzed = v.round + v.phase; api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200); }
      render();
    },
    unmount: function () { clearInterval(tick); document.removeEventListener('keydown', onKey); root = view = null; typed = ''; buzzed = ''; shook = 0; },
  });
})();
