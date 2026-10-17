(function () {
  Ark.loadCss('/games/mind-meld/style.css');
  const dialReady = Ark.loadScript('/games/mind-meld/dial.js');
  const esc = Ark.escapeHtml;
  const STICK_SPEED = 1.3; // dial units per frame at full stick

  let root = null;
  let view = null;
  let viewAt = 0;
  let textKey = '';
  let raf = null;
  const padAim = {}; // controller guessers: slot -> dial value

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function stars(n) {
    return n ? new Array(n + 1).join('⭐') : '—';
  }

  function clock() {
    if (!view || !view.timeLeftMs) return '';
    return Math.ceil(Math.max(0, view.timeLeftMs - (performance.now() - viewAt)) / 1000) + ' s';
  }

  function frame() {
    raf = requestAnimationFrame(frame);
    const el = root && root.querySelector('.md-timer');
    if (el) el.textContent = clock();
  }

  function draw(v) {
    if (!window.ArkDial) return;
    root.className = 'md-host phase-' + v.phase;
    if (v.phase === 'needPhone') {
      root.innerHTML = '<div class="md-msg"><div class="title">📱 Mind Meld needs a phone</div><p>The clue-giver types their clue on a phone. Join with at least one phone and try again.</p></div>';
      return;
    }
    if (v.phase === 'over') {
      root.innerHTML = '<div class="md-msg"><div class="title">' + v.stars + ' of ' + v.maxStars + ' ⭐</div><table>' +
        v.history.map(function (h) {
          return '<tr><td>' + esc(h.card[0]) + ' ↔ ' + esc(h.card[1]) + '</td><td>“' + esc(h.clue || '—') + '”</td><td>' + stars(h.stars) + '</td></tr>';
        }).join('') + '</table><p class="muted">Play again from a phone or with A (or ⚙ change the settings).</p></div>';
      return;
    }
    const revealed = v.phase === 'reveal';
    let line;
    if (v.phase === 'clue') line = nameOf(v, v.giver) + ' is thinking of a clue…';
    else line = '“' + esc(v.clue || '') + '”';
    let sub;
    if (v.phase === 'clue') sub = nameOf(v, v.guesser) + ', get ready to turn the dial. ' + nameOf(v, v.giver) + ': no extra hints!';
    else if (v.phase === 'guess') sub = nameOf(v, v.guesser) + ' turns the dial and locks in';
    else sub = v.result.noClue ? 'No clue in time' : (v.result.stars ? stars(v.result.stars) + ' · off by ' + v.result.diff : 'Missed by ' + v.result.diff);
    root.innerHTML =
      '<div class="md-top"><span>🧠 Round ' + v.round + ' / ' + v.rounds + '</span><span class="md-timer"></span><span class="stars">' + v.stars + ' ⭐</span></div>' +
      '<div class="md-clue' + (v.phase === 'clue' ? ' waiting' : '') + '">' + line + '</div>' +
      '<div class="md-sub">' + sub + '</div>' +
      '<div class="md-scale"><span class="end left">' + esc(v.card[0]) + '</span>' +
      ArkDial.svg({ aim: v.aim, target: revealed ? v.target : null, bands: v.bands }) +
      '<span class="end right">' + esc(v.card[1]) + '</span></div>';
  }

  function render(v) {
    view = v;
    viewAt = performance.now();
    const key = JSON.stringify([v.phase, v.round, v.clue, v.aim, v.target, v.stars]);
    if (key === textKey) return;
    textKey = key;
    draw(v);
  }

  Ark.register('host', 'mind-meld', {
    padHint: 'Guesser: left stick or ←→ turns the dial, A locks in',
    // Controller guesser: the stick turns the dial; we send where it points.
    padPoll: function (pad, v, slot) {
      if ((v.phase !== 'clue' && v.phase !== 'guess') || slot !== v.guesser) {
        delete padAim[slot]; // a new round starts from the server's dial
        return null;
      }
      if (padAim[slot] === undefined) padAim[slot] = v.aim;
      let dx = Math.abs(pad.stick.x) > 0.2 ? pad.stick.x : 0;
      if (pad.held.indexOf('LEFT') !== -1) dx = -0.6;
      if (pad.held.indexOf('RIGHT') !== -1) dx = 0.6;
      padAim[slot] = Math.max(0, Math.min(100, padAim[slot] + dx * STICK_SPEED));
      return { type: 'aim', value: Math.round(padAim[slot]) };
    },
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      return v.phase === 'guess' && slot === v.guesser && (btn === 'A' || btn === 'START') ? { type: 'lock' } : null;
    },
    sounds: function (prev, v) {
      if (v.phase === 'guess' && prev.phase === 'clue') return ['reveal'];
      if (v.phase === 'reveal' && prev.phase !== 'reveal') return [v.result && v.result.stars ? (v.result.stars === 3 ? 'correct' : 'point') : 'wrong'];
      return [];
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'md-host';
      el.appendChild(root);
      const mounted = root;
      dialReady.then(function () {
        if (root !== mounted || !view) return;
        textKey = '';
        render(view);
      });
      raf = requestAnimationFrame(frame);
    },
    update: render,
    unmount: function () {
      cancelAnimationFrame(raf);
      root = view = null;
      textKey = '';
      Object.keys(padAim).forEach(function (k) { delete padAim[k]; });
    },
  });
})();
