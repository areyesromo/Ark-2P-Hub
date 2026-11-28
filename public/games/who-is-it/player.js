(function () {
  Ark.loadCss('/games/who-is-it/style.css');
  const ready = Ark.loadScript('/games/who-is-it/faces.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let tab = 'ask';
  let picked = null; // the face tapped once to guess (tap again to confirm)

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    const t = e.target.closest('[data-tab]');
    if (t) { tab = t.getAttribute('data-tab'); picked = null; return render(); }
    if (v.phase !== 'play' || v.turn !== v.you) return;
    const q = e.target.closest('[data-q]');
    if (q && !q.disabled) { api.send({ type: 'ask', q: q.getAttribute('data-q') }); api.vibrate(15); return; }
    const f = e.target.closest('[data-face]');
    if (f) {
      const i = Number(f.getAttribute('data-face'));
      if (picked === i) { api.send({ type: 'guess', face: i }); api.vibrate(30); picked = null; return; }
      picked = i;
      api.vibrate(8);
      render();
    }
  }

  function message(v) {
    const me = v.you;
    const q = {};
    v.questions.forEach(function (x) { q[x.id] = x.text; });
    if (v.phase !== 'play') {
      const r = v.result;
      const won = r.winner === me;
      const line = r.how === 'right' ? (won ? 'You named it!' : 'They named your face') : won ? 'They guessed wrong!' : 'Wrong guess: it was ' + Ark.escapeHtml(v.faces[r.secrets[1 - me]].name);
      return '<span class="' + (won ? 'won' : 'lost') + '">' + (v.phase === 'over' ? (won ? 'You win the match! 🏆' : 'You lose the match') : line) + '</span>' + (v.phase === 'over' ? '<br><small>' + line + '</small>' : '');
    }
    const e = v.log[v.log.length - 1];
    let said = '';
    if (e && e.q) said = (e.by === me ? 'You asked ' : 'They asked ') + '“' + q[e.q] + '” <b class="' + (e.yes ? 'yes' : 'no') + '">' + (e.yes ? 'Yes' : 'No') + '</b><br>';
    if (v.turn !== me) return said + '<small>Their turn…</small>';
    if (tab === 'guess') return said + (picked === null ? '<strong>Tap the face you think is theirs</strong>' : 'Tap <b>' + Ark.escapeHtml(v.faces[picked].name) + '</b> again to guess (wrong loses!)');
    return said + '<strong>Your turn: ask a question</strong> <small>(or guess)</small>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.phase === 'play' && v.turn === me;
    const standing = {};
    v.left[me].forEach(function (i) { standing[i] = true; });
    let html = '<div class="wi-ptop">' + (v.secret[me] !== null ? '<div>' + ArkFaces.card(v.faces[v.secret[me]], 'secret') + '</div>' : '') +
      '<p>' + message(v) + '<br><small>You ' + v.scores[me] + ' – ' + v.scores[1 - me] + ' Them · they have ' + v.left[1 - me].length + ' faces left</small></p></div>';
    if (v.phase === 'play') {
      html += '<div class="wi-tabs"><button type="button" data-tab="ask" class="' + (tab === 'ask' ? 'on' : '') + '">❓ Ask</button><button type="button" data-tab="guess" class="' + (tab === 'guess' ? 'on' : '') + '">🎯 Guess</button></div>';
      if (tab === 'ask') {
        html += '<div class="wi-qs">' + v.questions.map(function (q) {
          const done = v.asked[me].includes(q.id);
          return '<button type="button" data-q="' + q.id + '"' + (done || !mine ? ' disabled' : '') + '>' + q.text + '</button>';
        }).join('') + '</div>';
      }
    }
    html += '<div class="wi-pgrid">' + v.faces.map(function (f, i) {
      const tap = mine && tab === 'guess' && standing[i];
      return ArkFaces.card(f, (standing[i] ? '' : 'down') + (picked === i ? ' picked' : ''), tap ? ' data-face="' + i + '"' : '');
    }).join('') + '</div>';
    if (v.phase === 'over') html += '<button class="primary rematch">Rematch</button>';
    root.innerHTML = html;
  }

  Ark.register('player', 'who-is-it', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'wi-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (prev && v.round !== prev.round) { tab = 'ask'; picked = null; }
      if (prev && v.phase === 'play' && v.turn === v.you && prev.turn !== v.you) api.vibrate(40);
      render();
      Ark.phoneClock(v.phase === 'play' && v.turn === v.you && v.timed ? v.timeLeftMs : 0);
    },
    unmount: function () { Ark.phoneClock(0); root = view = null; picked = null; tab = 'ask'; },
  });
})();
