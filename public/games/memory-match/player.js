(function () {
  Ark.loadCss('/games/memory-match/style.css');
  const cardsReady = Ark.loadScript('/games/memory-match/cards.js');

  let root = null;
  let els = null;
  let api = null;
  let view = null;
  let loaded = false;
  let key = '';

  function status(v) {
    const me = v.you;
    if (v.phase === 'setup') return '<span class="big">🃏 Memory Match</span><br>Pick the settings (either of you can), then start.';
    if (v.phase === 'countdown') return 'Get ready… ' + v.countdown + '<br>' + (v.turn === me ? 'You go first!' : 'They go first.');
    if (v.phase === 'over') {
      if (v.draw) return '<span class="big">Draw! 🤝</span>';
      return '<span class="big ' + (v.winner === me ? 'won' : 'lost') + '">' + (v.winner === me ? 'You win! 🏆' : 'You lose') + '</span>';
    }
    if (v.phase === 'match') return v.turn === me ? '<span class="won">A pair! Go again 🎉</span>' : 'They found a pair…';
    if (v.phase === 'peek') return v.turn === me ? '<span class="lost">No match.</span> Remember them!' : 'No match: remember them!';
    return v.turn === me ? '<span class="big you">Your turn</span><br>Tap two cards · ⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's' : 'Their turn: watch closely';
  }

  function render(v) {
    view = v;
    if (!loaded) return;
    ArkMemory.setThemes(v.themeNames);
    const k = JSON.stringify([v.phase, v.cards, v.turn, v.scores, v.settings, v.countdown]);
    if (k === key) return;
    key = k;
    const me = v.you;
    const setup = v.phase === 'setup';
    els.score.textContent = setup ? '' : 'Pairs: you ' + v.scores[me] + ' · them ' + v.scores[1 - me] + ' · ' + (v.pairs - v.scores[0] - v.scores[1]) + ' left';
    els.status.innerHTML = status(v);
    els.setup.innerHTML = setup ? Ark.setup.html(v, ArkMemory.ROWS) : '';
    els.go.classList.toggle('hidden', !setup);
    els.board.innerHTML = v.cards && v.phase !== 'countdown' ? ArkMemory.gridHtml(v) : '';
    els.board.classList.toggle('mine', v.phase === 'turn' && v.turn === me);
    els.rematch.classList.toggle('hidden', v.phase !== 'over');
    els.change.classList.toggle('hidden', v.phase !== 'over');
  }

  Ark.register('player', 'memory-match', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'mm-phone';
      root.innerHTML =
        '<div class="score"></div>' +
        '<div class="status"></div>' +
        '<div class="mm-setup-box"></div>' +
        '<button class="primary go hidden">Start</button>' +
        '<div class="mm-board"></div>' +
        '<button class="primary rematch hidden">Rematch</button>' +
        '<button class="ghost change hidden">Change settings</button>';
      el.appendChild(root);
      els = {
        score: root.querySelector('.score'),
        status: root.querySelector('.status'),
        setup: root.querySelector('.mm-setup-box'),
        go: root.querySelector('.go'),
        board: root.querySelector('.mm-board'),
        rematch: root.querySelector('.rematch'),
        change: root.querySelector('.change'),
      };
      els.board.addEventListener('click', function (e) {
        const card = e.target.closest('.card');
        if (!card || !view || view.phase !== 'turn' || view.turn !== view.you || card.classList.contains('up')) return;
        api.send({ type: 'flip', index: Number(card.getAttribute('data-i')) });
        api.vibrate(10);
      });
      Ark.setup.bind(els.setup, api);
      els.go.addEventListener('click', function () { api.send({ type: 'go' }); });
      els.rematch.addEventListener('click', function () { api.send({ type: 'rematch' }); });
      els.change.addEventListener('click', function () { api.send({ type: 'setup' }); });
      cardsReady.then(function () {
        loaded = true;
        if (view) render(view);
      });
    },
    update: render,
    unmount: function () {
      root = els = view = null;
      key = '';
    },
  });
})();
