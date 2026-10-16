(function () {
  Ark.loadCss('/games/quiz/style.css');
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
    if (e.target.closest('.rematch')) api.send({ type: 'rematch' });
  }

  function message(v) {
    const you = v.you;
    if (v.phase === 'question') {
      if (v.yourPick !== null) return 'Locked in. ' + (v.opponentAnswered ? 'Revealing…' : 'Waiting for your opponent…');
      return v.opponentAnswered ? '<strong>They\'ve answered!</strong> Quick!' : 'Pick an answer. Faster scores more.';
    }
    if (v.phase === 'reveal') {
      if (v.yourPick === null) return '<span class="lost">⌛ Too slow</span>';
      if (v.yourPick === v.correct) return '<span class="won">✅ Correct! +' + v.gained[you] + '</span>';
      return '<span class="lost">❌ Wrong. It was ' + v.labels[v.correct] + '</span>';
    }
    return '';
  }

  function render(v) {
    const you = v.you;
    const score = 'You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them' +
      (v.phase === 'question' || v.phase === 'reveal' ? ' · Q' + v.number + '/' + v.total : '');

    if (v.phase === 'countdown') {
      return '<div class="score">' + score + '</div><div class="qz-wait"><div class="big">' + (v.countdown || '') +
        '</div><p>Get ready! Read the question on the TV and tap your answer here.</p></div>';
    }
    if (v.phase === 'over') {
      let cls = 'won';
      let text = 'You win! 🏆';
      if (v.draw) { cls = ''; text = 'Draw! 🤝'; }
      else if (v.winner !== you) { cls = 'lost'; text = 'You lose'; }
      return '<div class="score">' + score + '</div><div class="qz-wait"><div class="outcome ' + cls + '">' + text + '</div>' +
        '<button class="primary rematch">Rematch</button></div>';
    }

    const answered = v.yourPick !== null;
    const revealing = v.phase === 'reveal';
    return (
      '<div class="score">' + score + '</div>' +
      '<div class="qz-q">' + esc(v.question.text) + '</div>' +
      '<p class="msg">' + message(v) + '</p>' +
      '<div class="qz-answers">' +
      v.question.options.map(function (opt, i) {
        let cls = 'c' + i;
        if (v.yourPick === i) cls += ' picked';
        else if (answered || revealing) cls += ' dim';
        if (revealing) cls += i === v.correct ? ' correct' : v.yourPick === i ? ' wrong' : '';
        const them = revealing && v.opponentPick === i ? '<span class="them">Them</span>' : '';
        return (
          '<button data-choice="' + i + '" class="' + cls + '"' + (answered || revealing ? ' disabled' : '') + '>' +
          '<span class="badge">' + v.labels[i] + '</span><span class="text">' + esc(opt) + '</span>' + them + '</button>'
        );
      }).join('') +
      '</div>'
    );
  }

  Ark.register('player', 'quiz', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'qz-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
    },
    update: function (v) {
      if (v.phase === 'reveal' && buzzed !== v.number) {
        buzzed = v.number;
        api.vibrate(v.yourPick === v.correct ? 40 : [80, 40, 80]);
      }
      if (v.phase === 'countdown') buzzed = 0;
      // The clock ticks every second; only rebuild the buttons when something visible changed.
      const key = JSON.stringify([v.phase, v.number, v.countdown, v.yourPick, v.opponentAnswered, v.scores]);
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
