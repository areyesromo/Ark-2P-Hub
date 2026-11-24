(function () {
  Ark.loadCss('/shared/timed-quiz.css');
  const ready = Ark.loadScript('/shared/timed-quiz.js');
  // A controller's face buttons (or the keys 1 to 4) pick the choices in order.
  const BUTTONS = ['A', 'B', 'X', 'Y'];

  let screen = null;
  let view = null;

  Ark.register('host', 'maths', {
    sounds: function (prev, v) {
      if (v.last && (!prev.last || v.last.n !== prev.last.n)) return [v.last.ok ? 'point' : 'wrong'];
      return [];
    },
    padHint: 'A, B, X, Y pick the answer under that letter · keyboard: 1 to 4',
    pad: function (btn, v) {
      const i = BUTTONS.indexOf(btn);
      return v.phase === 'play' && i !== -1 ? { type: 'answer', choice: i } : null;
    },
    typing: function (key, v) {
      return v.phase === 'play' && /^[1-4]$/.test(key) ? { type: 'answer', choice: Number(key) - 1 } : null;
    },
    overHtml: function (v) {
      return v.right + ' right, ' + v.wrong + ' wrong · best streak ' + v.bestStreak;
    },
    mount: function (el) {
      const mounted = el;
      ready.then(function () {
        if (!mounted.isConnected) return;
        screen = window.ArkQuiz.host(mounted, {
          prompt: function (v) { return Ark.escapeHtml(v.question.text) + ' <span class="muted">=</span> ?'; },
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
