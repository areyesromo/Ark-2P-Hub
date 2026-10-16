(function () {
  Ark.loadCss('/games/quiz/style.css');
  const esc = Ark.escapeHtml;

  let root = null;
  let bar = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let lastKey = '';

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function side(v, slot) {
    const gained = v.phase === 'reveal' && v.gained[slot] ? '<span class="gain">+' + v.gained[slot] + '</span>' : '';
    let status = '';
    if (v.phase === 'question') status = v.answered[slot] ? '🔒 Locked in' : 'Thinking…';
    else if (v.phase === 'reveal') {
      const p = v.picks[slot];
      status = p === null ? '⌛ No answer' : p === v.correct ? '✅ Correct' : '❌ ' + v.labels[p];
    }
    return (
      '<div class="qz-side p' + (slot + 1) + '-text' + (slot === 1 ? ' right' : '') + (v.phase === 'question' && v.answered[slot] ? ' locked' : '') + '">' +
      '<span class="name">' + esc(v.players[slot].name) + '</span>' +
      '<span class="points">' + v.scores[slot] + gained + '</span>' +
      '<span class="status">' + status + '</span>' +
      '</div>'
    );
  }

  function tile(v, i) {
    let cls = 'qz-tile c' + i;
    let marks = '';
    if (v.phase === 'reveal') {
      cls += i === v.correct ? ' correct' : ' wrong';
      [0, 1].forEach(function (slot) {
        if (v.picks[slot] === i) marks += '<span class="mark p' + (slot + 1) + '">' + esc(v.players[slot].name) + '</span>';
      });
    }
    return (
      '<div class="' + cls + '">' +
      '<span class="badge">' + v.labels[i] + '</span>' +
      '<span class="text">' + esc(v.question.options[i]) + '</span>' +
      (marks ? '<span class="marks">' + marks + '</span>' : '') +
      '</div>'
    );
  }

  function body(v) {
    if (v.phase === 'countdown') {
      return '<div class="qz-center"><div class="big">' + (v.countdown || '') + '</div>' +
        '<div class="sub">' + v.total + ' questions · answer fast for bonus points · answers stay secret until the reveal</div></div>';
    }
    if (v.phase === 'over') {
      const sub = v.draw
        ? 'It\'s a draw! <strong>' + v.scores[0] + ' : ' + v.scores[1] + '</strong>'
        : nameOf(v, v.winner) + ' wins <strong>' + v.scores[v.winner] + ' : ' + v.scores[1 - v.winner] + '</strong>';
      return '<div class="qz-center"><div class="big">' + (v.draw ? '🤝' : '🏆') + '</div><div class="sub">' + sub +
        '<br>Rematch or head back to the lobby from your phones or controllers.</div></div>';
    }
    return (
      '<div class="qz-card">' +
      '<div class="meta">Question ' + v.number + ' / ' + v.total + ' · ' + esc(v.question.cat) + '</div>' +
      '<div class="q">' + esc(v.question.text) + '</div>' +
      '</div>' +
      '<div class="qz-bar"><div class="fill"></div></div>' +
      '<div class="qz-grid">' + [0, 1, 2, 3].map(function (i) { return tile(v, i); }).join('') + '</div>'
    );
  }

  // The server pushes a view every second; ease the timer bar smoothly in between.
  function tick() {
    raf = requestAnimationFrame(tick);
    if (!bar || !view) return;
    let frac = 0;
    if (view.phase === 'question') {
      const left = Math.max(0, view.timeLeftMs - (performance.now() - viewAt));
      frac = left / view.questionMs;
    }
    bar.style.width = (frac * 100).toFixed(2) + '%';
    bar.classList.toggle('low', view.phase === 'question' && frac < 0.25);
  }

  // Controller players: face buttons answer directly; the D-pad works as a
  // diamond with the same layout (↓ A, → B, ← X, ↑ Y).
  const PAD_ANSWERS = { A: 0, B: 1, X: 2, Y: 3, DOWN: 0, RIGHT: 1, LEFT: 2, UP: 3 };

  Ark.register('host', 'quiz', {
    // Sound: a click as each answer locks in; right or wrong at the reveal.
    sounds: function (prev, v) {
      const out = [];
      if (v.answered.filter(Boolean).length > prev.answered.filter(Boolean).length) out.push('lock');
      if (v.phase === 'reveal' && prev.phase !== 'reveal') out.push(v.picks.indexOf(v.correct) !== -1 ? 'correct' : 'wrong');
      return out;
    },
    padHint: 'A B X Y (or D-pad ↓ → ← ↑) to answer · A: rematch at the end',
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase === 'question' && !v.answered[slot] && btn in PAD_ANSWERS) return { type: 'answer', choice: PAD_ANSWERS[btn] };
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'qz-host';
      el.appendChild(root);
      raf = requestAnimationFrame(tick);
    },
    update: function (v) {
      view = v;
      viewAt = performance.now();
      const key = JSON.stringify([v.phase, v.number, v.countdown, v.answered, v.picks, v.scores]);
      if (key === lastKey) return; // per-second clock updates only move the bar
      lastKey = key;
      root.innerHTML =
        '<div class="qz-top">' + side(v, 0) + '<span class="vs">VS</span>' + side(v, 1) + '</div>' + body(v);
      bar = root.querySelector('.qz-bar .fill');
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = bar = view = null;
      lastKey = '';
    },
  });
})();
