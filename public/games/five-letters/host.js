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
    if (v.round !== seenRound) { seen = [0, 0]; seenRound = v.round; seenOpen = false; }
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="fl-stage">' + side(v, 0) + middle(v) + side(v, 1) + '</div>';
    seen = [v.boards[0].length, v.boards[1].length];
    if (v.phase !== 'play') seenOpen = true;
  }

  Ark.register('host', 'five-letters', {
    sounds: function (prev, v) {
      const out = [];
      if (v.round !== prev.round) return ['start'];
      [0, 1].forEach(function (s) {
        if (v.boards[s].length > prev.boards[s].length) out.push(v.solved[s] ? 'correct' : 'chalk');
      });
      if (v.phase !== 'play' && prev.phase === 'play') out.push('reveal');
      return out;
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
    },
  });
})();
