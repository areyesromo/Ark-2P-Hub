// Trivia Quest on the phone (server/games/trivia-quest.js): the four answers (Quiz Battle's
// buttons), your 💡 50/50 (once a quest: it takes two wrong answers off this phone only), the
// hearts and the monster's health, and Rematch at the end.
(function () {
  Ark.loadCss('/games/quiz/style.css');
  Ark.loadCss('/games/trivia-quest/style.css');
  const esc = Ark.escapeHtml;

  let root = null;
  let api = null;
  let lastKey = '';
  let buzzed = 0; // question number we last vibrated a result for

  function onClick(e) {
    const btn = e.target.closest('[data-choice]');
    if (btn && !btn.disabled) {
      api.send({ type: 'answer', choice: Number(btn.getAttribute('data-choice')) });
      api.vibrate(20);
      return;
    }
    if (e.target.closest('.tq-fifty-btn')) api.send({ type: 'fifty' });
    if (e.target.closest('.rematch')) api.send({ type: 'rematch' });
  }

  function message(v) {
    const you = v.you;
    if (v.phase === 'question') {
      if (v.yourPick !== null) return 'Locked in. ' + (v.theyAnswered ? 'Revealing…' : 'Waiting for your partner…');
      return v.theyAnswered ? '<strong>Your partner has answered.</strong> Agree on it?' : 'Talk it over, then pick. Faster hits harder.';
    }
    if (v.phase === 'reveal') {
      const strike = v.teamStrike ? ' <strong>⚡ Team strike!</strong>' : '';
      if (v.yourPick === null) return '<span class="lost">⌛ Too slow: 💔</span>' + strike;
      if (v.yourPick === v.correct) return '<span class="won">✅ Hit for ' + v.hits[you] + '!</span>' + strike;
      return '<span class="lost">❌ It was ' + v.labels[v.correct] + ': 💔</span>';
    }
    return '';
  }

  function status(v) {
    const hearts = '❤️'.repeat(v.hearts) + '🖤'.repeat(v.maxHearts - v.hearts);
    return '<div class="tq-status"><span>' + hearts + '</span><span>' + v.monster.emoji + ' ' + v.monster.hp + ' / ' + v.monster.maxHp + '</span><span>⭐ ' + v.stars + '</span></div>';
  }

  function render(v) {
    if (v.phase === 'intro' || v.phase === 'defeated') {
      const text = v.phase === 'intro'
        ? '<strong>' + esc(v.monster.name) + '</strong> blocks the way! Watch the TV.'
        : '<strong>' + esc(v.monster.name) + '</strong> is beaten! ' + '⭐'.repeat(v.beaten[v.beaten.length - 1]);
      return status(v) + '<div class="qz-wait"><div class="big">' + v.monster.emoji + '</div><p>' + text + '</p></div>';
    }
    if (v.phase === 'over') {
      return status(v) + '<div class="qz-wait"><div class="outcome ' + (v.won ? 'won' : 'lost') + '">' + (v.won ? 'Quest complete! 🏆' : 'Out of hearts 💀') + '</div>' +
        '<p>You earned <strong>' + v.stars + ' / ' + v.maxStars + ' ⭐</strong> together.</p><button class="primary rematch">Rematch</button></div>';
    }
    const answered = v.yourPick !== null;
    const revealing = v.phase === 'reveal';
    const fifty = v.phase === 'question' && !answered && v.fiftyLeft
      ? '<button class="ghost tq-fifty-btn">💡 50/50 <small>(once a quest)</small></button>' : '';
    return status(v) +
      '<div class="qz-q">' + esc(v.question.text) + '</div>' +
      '<p class="msg">' + message(v) + '</p>' + fifty +
      '<div class="qz-answers">' + v.question.options.map(function (opt, i) {
        const gone = v.removed.indexOf(i) !== -1;
        let cls = 'c' + i;
        if (v.yourPick === i) cls += ' picked';
        else if (answered || revealing || gone) cls += ' dim';
        if (gone) cls += ' tq-gone';
        if (revealing) cls += i === v.correct ? ' correct' : v.yourPick === i ? ' wrong' : '';
        const them = revealing && v.theirPick === i ? '<span class="them">Partner</span>' : '';
        return '<button data-choice="' + i + '" class="' + cls + '"' + (answered || revealing || gone ? ' disabled' : '') + '>' +
          '<span class="badge">' + v.labels[i] + '</span><span class="text">' + esc(opt) + '</span>' + them + '</button>';
      }).join('') + '</div>';
  }

  Ark.register('player', 'trivia-quest', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'qz-phone tq-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
    },
    update: function (v) {
      if (v.phase === 'reveal' && buzzed !== v.number) {
        buzzed = v.number;
        api.vibrate(v.yourPick === v.correct ? 40 : [80, 40, 80]);
      }
      // The clock ticks every second; only rebuild when something visible changed.
      const key = JSON.stringify([v.phase, v.number, v.monsterIndex, v.yourPick, v.theyAnswered, v.removed, v.fiftyLeft, v.hearts, v.beaten]);
      if (key === lastKey) return;
      lastKey = key;
      root.innerHTML = render(v);
    },
    unmount: function () {
      root = null;
      lastKey = '';
      buzzed = 0;
    },
  });
})();
