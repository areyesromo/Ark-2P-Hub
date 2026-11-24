(function () {
  Ark.loadCss('/shared/timed-quiz.css');
  Ark.loadCss('/games/colours/style.css');
  const ready = Ark.loadScript('/shared/timed-quiz.js');
  // The choices are always red, blue, green, yellow: on a controller the buttons of those colours.
  const BUTTONS = ['B', 'X', 'A', 'Y'];
  const KEYS = { r: 0, b: 1, g: 2, y: 3, 1: 0, 2: 1, 3: 2, 4: 3 };

  let screen = null;
  let view = null;

  Ark.register('host', 'colours', {
    sounds: function (prev, v) {
      if (v.last && (!prev.last || v.last.n !== prev.last.n)) return [v.last.ok ? 'point' : 'wrong'];
      return [];
    },
    padHint: 'The face button of that colour: B red · X blue · A green · Y yellow · keyboard: R B G Y',
    pad: function (btn, v) {
      const i = BUTTONS.indexOf(btn);
      return v.phase === 'play' && i !== -1 ? { type: 'answer', choice: i } : null;
    },
    typing: function (key, v) {
      const i = KEYS[String(key).toLowerCase()];
      return v.phase === 'play' && i !== undefined ? { type: 'answer', choice: i } : null;
    },
    overHtml: function (v) {
      return v.right + ' right, ' + v.wrong + ' wrong · best streak ' + v.bestStreak;
    },
    mount: function (el) {
      const mounted = el;
      ready.then(function () {
        if (!mounted.isConnected) return;
        screen = window.ArkQuiz.host(mounted, {
          // The word in another colour's ink: that's the trap.
          prompt: function (v) { return '<span class="ct-word ink-' + v.question.ink + '">' + v.question.word.toUpperCase() + '</span>'; },
          choice: function (v, i) { return v.question.options[i]; },
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
