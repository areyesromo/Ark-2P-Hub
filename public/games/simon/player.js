(function () {
  Ark.loadCss('/games/simon/style.css');

  let root = null;
  let pads = null;
  let msg = null;
  let api = null;

  function render(v) {
    pads.forEach(function (el, i) {
      el.classList.toggle('lit', v.lit === i);
      el.disabled = v.phase !== 'repeat';
    });
    let text = '';
    if (v.phase === 'ready' || v.phase === 'show') text = 'Watch the TV…';
    else if (v.phase === 'repeat') text = 'Your turn: ' + v.step + ' / ' + v.length;
    else if (v.phase === 'right') text = '✓ Right!';
    msg.innerHTML = text + ' <span class="muted">· ' + v.score + ' in a row' + (v.best === null || v.best === undefined ? '' : ', best ' + v.best) + '</span>';
  }

  Ark.register('player', 'simon', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'simon-phone';
      root.innerHTML = '<div class="msg"></div><div class="simon-pads">' +
        [0, 1, 2, 3].map(function (i) { return '<button class="pad p' + i + '" data-pad="' + i + '" aria-label="Pad ' + (i + 1) + '"></button>'; }).join('') + '</div>';
      el.appendChild(root);
      msg = root.querySelector('.msg');
      pads = Array.prototype.slice.call(root.querySelectorAll('.pad'));
      // On touch-down, not on click: a fast sequence needs every tap to count straight away.
      root.querySelector('.simon-pads').addEventListener('pointerdown', function (e) {
        const btn = e.target.closest('[data-pad]');
        if (!btn || btn.disabled) return;
        e.preventDefault();
        api.send({ type: 'press', pad: Number(btn.getAttribute('data-pad')) });
        api.vibrate(20);
        btn.classList.add('lit');
        setTimeout(function () { btn.classList.remove('lit'); }, 180);
      });
    },
    update: function (v) {
      if (root) root.setAttribute('data-look', v.look || 'classic');
      render(v);
    },
    unmount: function () {
      root = pads = msg = null;
    },
  });
})();
