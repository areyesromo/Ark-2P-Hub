(function () {
  Ark.loadCss('/games/code-breaker/style.css');
  const ready = Ark.loadScript('/games/code-breaker/vault.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let typed = '';
  let buzzed = '';

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

  function typing() {
    const v = view;
    if (!v) return false;
    return (v.phase === 'set' && !v.ready[v.you]) || (v.phase === 'guess' && v.turn === v.you);
  }

  function press(k) {
    if (!typing()) return;
    if (k === '⌫') typed = typed.slice(0, -1);
    else if (k === 'ok') {
      if (typed.length !== view.length) return api.vibrate([20, 30, 20]);
      api.send(view.phase === 'set' ? { type: 'code', code: typed } : { type: 'guess', guess: typed });
      api.vibrate(20);
      typed = '';
    } else if (typed.length < view.length && !typed.includes(k)) typed += k;
    render();
  }

  function onClick(e) {
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    const k = e.target.closest('[data-k]');
    if (k && !k.disabled) press(k.getAttribute('data-k'));
  }

  function onKey(e) {
    if (!root || e.metaKey || e.ctrlKey) return;
    if (/^\d$/.test(e.key)) press(e.key);
    else if (e.key === 'Backspace') press('⌫');
    else if (e.key === 'Enter') press('ok');
    else return;
    e.preventDefault();
  }

  function keypad(v) {
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', 'ok'];
    return '<div class="cb-keypad">' + keys.map(function (k) {
      const used = /\d/.test(k) && typed.includes(k);
      const label = k === 'ok' ? (v.phase === 'set' ? 'Lock 🔒' : 'Guess') : k;
      return '<button data-k="' + k + '" class="' + (k === 'ok' ? 'ok' : k === '⌫' ? 'del' : '') + '"' + (used || (k === 'ok' && typed.length !== v.length) ? ' disabled' : '') + '>' + label + '</button>';
    }).join('') + '</div>';
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'over') return v.winner === me ? '<span class="won big ark-result">You win! 🏆</span>' : '<span class="lost big ark-result">You lose</span>';
    if (v.phase === 'roundEnd') {
      const r = v.result;
      if (r.winner === null) return r.both ? 'Both cracked it: level!' : 'Nobody cracked it';
      return r.winner === me ? '<span class="won">You cracked it first!</span>' : '<span class="lost">They cracked yours first</span>';
    }
    if (v.phase === 'set') return v.ready[me] ? 'Code locked. Waiting for them…' : '<strong>Set your secret code</strong> (four different digits)';
    return v.turn === me ? '<strong>Your guess</strong>' : 'They\'re guessing your code…';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    let html = '<div class="cb-top"><span>You ' + v.scores[me] + ' – ' + v.scores[1 - me] + ' Them</span>' +
      (v.code ? '<span class="cb-mine">Your code ' + ArkCode.wheels(v.code, v.length, { small: true }) + '</span>' : '') + '</div>' +
      '<p class="cb-msg">' + message(v) + (v.timed && v.timeLeftMs && typing() ? ' <small>' + clock() + '</small>' : '') + '</p>';
    if (v.phase === 'guess' || v.phase === 'roundEnd' || v.phase === 'over') {
      html += '<div class="cb-two"><div><small>Your guesses</small>' + ArkCode.rows(v.guesses[me], v.length) + '</div>' +
        '<div><small>Theirs at yours</small>' + ArkCode.rows(v.guesses[1 - me], v.length) + '</div></div>';
      if (v.codes) html += '<p class="cb-reveal">Their code was ' + ArkCode.wheels(v.codes[1 - me], v.length, { small: true }) + '</p>';
    }
    if (typing()) html += '<div class="cb-entry">' + ArkCode.wheels(typed, v.length, { caret: typed.length }) + '</div>' + keypad(v);
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'code-breaker', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'cb-phone';
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
      if (prev && (prev.round !== v.round || prev.phase !== v.phase)) typed = '';
      if (prev && v.phase === 'guess' && v.turn === v.you && prev.turn !== v.you) api.vibrate(40);
      if (v.result && buzzed !== v.round + v.phase && v.result.winner !== null) { buzzed = v.round + v.phase; api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200); }
      render();
    },
    unmount: function () { clearInterval(tick); document.removeEventListener('keydown', onKey); root = view = null; typed = ''; buzzed = ''; },
  });
})();
