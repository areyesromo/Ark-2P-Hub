(function () {
  Ark.loadCss('/shared/timed-quiz.css');
  const ready = Ark.loadScript('/shared/timed-quiz.js');

  let screen = null;
  let view = null;

  Ark.register('player', 'maths', {
    mount: function (el, api) {
      const box = document.createElement('div');
      box.style.cssText = 'flex:1;min-height:0;display:flex';
      el.appendChild(box);
      ready.then(function () {
        if (!box.isConnected) return;
        screen = window.ArkQuiz.player(box, api, {
          prompt: function (v) { return Ark.escapeHtml(v.question.text) + ' = ?'; },
          choice: function (v, i) { return Ark.escapeHtml(v.question.options[i]); },
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
