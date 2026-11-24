(function () {
  Ark.loadCss('/games/numbers/style.css');

  let root = null;
  let api = null;
  let view = null;
  let entry = '';
  let round = 0;
  let results = 0;

  function render() {
    const v = view;
    if (!root || !v) return;
    if (v.round !== round) {
      round = v.round;
      entry = '';
    }
    const typing = v.phase === 'answer' || v.phase === 'show';
    let top = '';
    if (v.phase === 'ready') top = 'Get ready…';
    // The number shows here too, so there's no need to look up at the TV (and no TV at all in phone-only mode).
    else if (v.phase === 'show') top = v.number ? '👀 ' + v.number : '👀 Remember it';
    else if (v.phase === 'answer') top = 'Type the number';
    else if (v.result) top = v.result.ok ? '✓ Right!' : '✗ It was ' + v.result.number;
    root.querySelector('.info').innerHTML = '<strong>' + v.length + '</strong> digits · best ' + v.score + ' · ' + '❤️'.repeat(Math.max(0, v.lives));
    root.querySelector('.msg').textContent = top;
    root.querySelector('.msg').classList.toggle('big', v.phase === 'show');
    root.querySelector('.entry').textContent = typing ? entry || '…' : '';
    root.querySelector('.nm-keys').classList.toggle('off', !typing);
  }

  Ark.register('player', 'numbers', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'nm-phone';
      let keys = '';
      ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'].forEach(function (k) { keys += '<button data-k="' + k + '"' + (k === '✓' ? ' class="primary"' : '') + '>' + k + '</button>'; });
      root.innerHTML = '<div class="info"></div><div class="msg"></div><div class="entry"></div><div class="nm-keys">' + keys + '</div>';
      el.appendChild(root);
      root.querySelector('.nm-keys').addEventListener('pointerdown', function (e) {
        const b = e.target.closest('[data-k]');
        if (!b || !view || (view.phase !== 'answer' && view.phase !== 'show')) return;
        e.preventDefault();
        const k = b.getAttribute('data-k');
        if (k === '⌫') entry = entry.slice(0, -1);
        else if (k === '✓') {
          if (!entry) return;
          api.send({ type: 'answer', digits: entry });
          entry = '';
        } else if (entry.length < 40) entry += k;
        api.vibrate(5);
        render();
      });
    },
    update: function (v) {
      if (v.result && v.result.n !== results) {
        results = v.result.n;
        api.vibrate(v.result.ok ? 20 : [60, 40, 60]);
      }
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
      entry = '';
      round = results = 0;
    },
  });
})();
