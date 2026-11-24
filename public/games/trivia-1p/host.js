(function () {
  Ark.loadCss('/shared/timed-quiz.css');
  const ready = Ark.loadScript('/shared/timed-quiz.js');
  // A controller's face buttons (or the keys 1 to 4) pick the answers in order.
  const BUTTONS = ['A', 'B', 'X', 'Y'];

  let screen = null;
  let view = null;

  function prompt(v) {
    return '<span class="tq1-cat">' + Ark.escapeHtml(v.question.category) + ' · ' + v.question.n + ' of ' + v.question.of + '</span>' + Ark.escapeHtml(v.question.text);
  }

  function score(v) {
    const r = v.reveal;
    const gain = r ? (r.ok ? ' <span class="good">+' + r.points + '</span>' : r.chose === null ? ' <span class="muted">time\'s up</span>' : '') : '';
    return '<strong>' + v.score + '</strong> pts' + gain + (v.streak > 2 ? ' · 🔥 ' + v.streak : '');
  }

  Ark.register('host', 'trivia-1p', {
    sounds: function (prev, v) {
      if (v.reveal && !prev.reveal) return [v.reveal.ok ? 'point' : 'wrong'];
      return [];
    },
    padHint: 'A, B, X, Y pick the answer under that letter · keyboard: 1 to 4',
    pad: function (btn, v) {
      const i = BUTTONS.indexOf(btn);
      return v.phase === 'ask' && i !== -1 ? { type: 'answer', choice: i } : null;
    },
    typing: function (key, v) {
      return v.phase === 'ask' && /^[1-4]$/.test(key) ? { type: 'answer', choice: Number(key) - 1 } : null;
    },
    overHtml: function (v) {
      return v.right + ' of ' + v.of + ' right' + (v.fastest !== null ? ' · quickest ' + (v.fastest / 1000).toFixed(1) + ' s' : '') + ' · best streak ' + v.bestStreak;
    },
    mount: function (el) {
      const mounted = el;
      ready.then(function () {
        if (!mounted.isConnected) return;
        screen = window.ArkQuiz.host(mounted, {
          cls: 'tq1-long',
          prompt: prompt,
          score: score,
          choice: function (v, i) { return Ark.escapeHtml(v.question.options[i]); },
          badges: BUTTONS,
        });
        if (view) screen.update(view);
      });
    },
    update: function (v) {
      view = v;
      if (screen) screen.update(v);
    },
    unmount: function () {
      screen = view = null;
    },
  });
})();
