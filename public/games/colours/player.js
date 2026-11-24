(function () {
  Ark.loadCss('/shared/timed-quiz.css');
  Ark.loadCss('/games/colours/style.css');
  const ready = Ark.loadScript('/shared/timed-quiz.js');

  let screen = null;
  let view = null;

  Ark.register('player', 'colours', {
    mount: function (el, api) {
      const box = document.createElement('div');
      box.className = 'ct-phone';
      el.appendChild(box);
      ready.then(function () {
        if (!box.isConnected) return;
        screen = window.ArkQuiz.player(box, api, {
          prompt: function (v) { return '<span class="ct-word ink-' + v.question.ink + '">' + v.question.word.toUpperCase() + '</span>'; },
          // The buttons say the colour's name in plain white: you have to read them.
          choice: function (v, i) { return v.question.options[i]; },
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
