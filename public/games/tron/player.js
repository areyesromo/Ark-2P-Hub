(function () {
  Ark.loadCss('/games/tron/style.css');
  Ark.loadCss('/shared/steer-pad.css');
  const padReady = Ark.loadScript('/shared/steer-pad.js');

  let root = null;
  let pad = null; // ArkSteerPad
  let info = null;
  let api = null;
  let view = null;
  let lastKey = '';

  function turn(dir) {
    if (!view || (view.phase !== 'play' && view.phase !== 'countdown')) return;
    api.send({ type: 'turn', dir: dir });
    api.vibrate(15);
    pad.show(dir);
  }

  function render(v) {
    view = v;
    if (!pad) return;
    const you = v.you;
    const score = 'You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them · first to ' + v.winScore;
    let status = '';
    let cls = '';
    if (v.phase === 'countdown') status = 'Round ' + v.round + ' starts in ' + v.countdown + '…';
    else if (v.phase === 'play') status = 'Tap a side or swipe to turn';
    else if (v.phase === 'crash' && v.result) {
      if (v.result.draw) status = 'Both crashed. Draw!';
      else status = v.result.roundWinner === you ? 'They crashed! Round to you 🎉' : 'You crashed 💥';
    } else if (v.phase === 'over') {
      cls = v.winner === you ? 'won' : 'lost';
      status = v.winner === you ? 'You win! 🏆' : 'You lose';
    }
    const key = score + status + v.phase + v.dir;
    if (key === lastKey) return; // views arrive every tick; only touch the DOM on change
    lastKey = key;
    info.innerHTML = '<div class="score">' + score + '</div><div class="status ' + cls + '">' + status + '</div>';
    if (v.phase === 'play' || v.phase === 'countdown') pad.show(v.dir);
    pad.el.classList.toggle('hidden', v.phase === 'over');
    root.querySelector('.rematch').classList.toggle('hidden', v.phase !== 'over');
  }

  Ark.register('player', 'tron', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'tron-phone';
      root.innerHTML = '<div class="info"></div><button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
      const mounted = root;
      padReady.then(function () {
        if (root !== mounted) return; // unmounted while loading
        pad = window.ArkSteerPad.create(turn);
        root.insertBefore(pad.el, root.querySelector('.rematch'));
        if (view) render(view);
      });
    },
    update: render,
    unmount: function () {
      root = pad = info = view = null;
      lastKey = '';
    },
  });
})();
