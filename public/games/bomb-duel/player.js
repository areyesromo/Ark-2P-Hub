(function () {
  Ark.loadCss('/games/bomb-duel/style.css');
  const ROWS = [
    { key: 'wins', title: 'Round wins needed', fmt: function (n) { return 'First to ' + n; } },
    { key: 'crates', title: 'Crates', fmt: function (n) { return n < 50 ? 'Few' : n < 75 ? 'Normal' : 'Packed'; } },
  ];
  const DEAD = 0.18; // the middle of the D-pad (this fraction of its size from the centre) means "stop"

  let root = null;
  let els = null;
  let api = null;
  let view = null;
  let dir = null; // the direction being held
  let padPointer = null;
  let textKey = '';

  function setDir(d) {
    if (d === dir) return;
    dir = d;
    api.send({ type: 'move', dir: d });
    if (d) api.vibrate(6);
    els.dpad.querySelectorAll('.arrow').forEach(function (a) { a.classList.toggle('on', a.classList.contains(d)); });
  }

  /** Where on the D-pad the thumb is: the direction of the longer axis from its centre. */
  function dirAt(e) {
    const r = els.dpad.getBoundingClientRect();
    const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
    const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < DEAD) return null;
    return Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : dy > 0 ? 'down' : 'up';
  }

  function onPadDown(e) {
    e.preventDefault();
    if (els.dpad.setPointerCapture) els.dpad.setPointerCapture(e.pointerId);
    padPointer = e.pointerId;
    setDir(dirAt(e));
  }

  function onPadMove(e) {
    if (e.pointerId === padPointer) setDir(dirAt(e));
  }

  function onPadUp(e) {
    if (e.pointerId !== padPointer) return;
    padPointer = null;
    setDir(null);
  }

  function onBomb(e) {
    e.preventDefault();
    if (!view || view.phase !== 'play') return;
    api.send({ type: 'bomb' });
    api.vibrate(20);
    els.bomb.classList.add('hit');
    setTimeout(function () { if (els) els.bomb.classList.remove('hit'); }, 120);
  }

  function status(v) {
    const me = v.you;
    if (v.phase === 'setup') return '<span class="big">💣 Bomb Duel</span><br>Pick the settings (either of you can), then start.';
    if (v.phase === 'countdown') return 'Round ' + v.round + ' · get ready… <strong>' + v.countdown + '</strong>';
    if (v.phase === 'over') {
      return '<span class="big ' + (v.winner === me ? 'won' : 'lost') + '">' + (v.winner === me ? 'You win! 🏆' : 'You lose') + '</span><br>' +
        'You ' + v.scores[me] + ' – ' + v.scores[1 - me] + ' them';
    }
    if (v.phase === 'roundEnd' && v.result) {
      const r = v.result;
      return r.draw ? 'Both blown up: a draw!' : r.winner === me ? '<span class="won">Round to you! 🎉</span>' : '<span class="lost">Round to them.</span>';
    }
    const p = v.players[me];
    if (!p.alive) return '<span class="lost">💥 Blown up!</span>';
    return v.suddenDeath ? '<span class="lost">⚠ Sudden death: the walls are closing in!</span>' : 'Trap them in a blast · ⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's';
  }

  function render(v) {
    const was = view;
    view = v;
    if (v.phase !== 'play' && v.phase !== 'countdown' && dir) setDir(null);
    const me = v.you;
    const p = v.players && v.players[me];
    if (p && was && was.players && was.players[me].alive && !p.alive) api.vibrate([60, 40, 120]);
    const key = JSON.stringify([v.phase, v.round, v.countdown, v.scores, v.settings, v.result, v.suddenDeath, p && [p.alive, p.bombs, p.range, p.speed], v.phase === 'play' && Math.ceil(v.timeLeftMs / 1000)]);
    if (key === textKey) return;
    textKey = key;
    const setup = v.phase === 'setup';
    els.score.textContent = setup ? '' : 'You ' + v.scores[me] + ' – ' + v.scores[1 - me] + ' Them · first to ' + v.winScore + ' · round ' + v.round;
    els.status.innerHTML = status(v);
    els.power.innerHTML = p ? '💣×' + p.bombs + ' &nbsp; 🔥×' + p.range + ' &nbsp; 👟+' + p.speed : '';
    els.setup.innerHTML = setup ? Ark.setup.html(v, ROWS) : '';
    els.go.classList.toggle('hidden', !setup);
    els.controls.classList.toggle('hidden', setup || v.phase === 'over');
    els.rematch.classList.toggle('hidden', v.phase !== 'over');
    els.change.classList.toggle('hidden', v.phase !== 'over');
  }

  Ark.register('player', 'bomb-duel', {
    // Setup and the end screen are menus: pinch zoom stays on.
    zoomable: function (v) { return v.phase === 'setup' || v.phase === 'over'; },
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'bd-phone';
      root.innerHTML =
        '<div class="score"></div>' +
        '<div class="status"></div>' +
        '<div class="power"></div>' +
        '<div class="bd-setup-box"></div>' +
        '<button class="primary go hidden">Start</button>' +
        '<div class="bd-controls">' +
        '<div class="bd-dpad"><span class="arrow up">▲</span><span class="arrow down">▼</span><span class="arrow left">◀</span><span class="arrow right">▶</span></div>' +
        '<button class="bd-bomb">💣<span>BOMB</span></button>' +
        '</div>' +
        '<button class="primary rematch hidden">Rematch</button>' +
        '<button class="ghost change hidden">Change settings</button>';
      el.appendChild(root);
      els = {
        score: root.querySelector('.score'),
        status: root.querySelector('.status'),
        power: root.querySelector('.power'),
        setup: root.querySelector('.bd-setup-box'),
        go: root.querySelector('.go'),
        controls: root.querySelector('.bd-controls'),
        dpad: root.querySelector('.bd-dpad'),
        bomb: root.querySelector('.bd-bomb'),
        rematch: root.querySelector('.rematch'),
        change: root.querySelector('.change'),
      };
      els.dpad.addEventListener('pointerdown', onPadDown);
      els.dpad.addEventListener('pointermove', onPadMove);
      els.dpad.addEventListener('pointerup', onPadUp);
      els.dpad.addEventListener('pointercancel', onPadUp);
      els.bomb.addEventListener('pointerdown', onBomb);
      Ark.setup.bind(els.setup, api);
      els.go.addEventListener('click', function () { api.send({ type: 'go' }); });
      els.rematch.addEventListener('click', function () { api.send({ type: 'rematch' }); });
      els.change.addEventListener('click', function () { api.send({ type: 'setup' }); });
    },
    update: render,
    unmount: function () {
      root = els = view = null;
      dir = padPointer = null;
      textKey = '';
    },
  });
})();
