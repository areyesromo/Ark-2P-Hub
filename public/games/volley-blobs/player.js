// Volley Blobs on the phone (server/games/volley-blobs.js): hold ◀ or ▶ to slide, tap JUMP.
// Each button works with its own finger, so you can slide and jump at once.
(function () {
  Ark.loadCss('/games/volley-blobs/style.css');

  let root = null;
  let info = null;
  let api = null;
  let lastKey = '';
  let held = { left: false, right: false };
  let sent = 0;

  function sendMove() {
    const x = (held.right ? 1 : 0) - (held.left ? 1 : 0);
    if (x === sent) return;
    sent = x;
    api.send({ type: 'move', x: x });
  }

  function holdButton(btn, side) {
    const set = function (on) {
      return function (e) {
        e.preventDefault();
        if (on && btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
        held[side] = on;
        btn.classList.toggle('on', on);
        sendMove();
      };
    };
    btn.addEventListener('pointerdown', set(true));
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { btn.addEventListener(ev, set(false)); });
  }

  function render(v) {
    const you = v.you;
    const score = 'You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them · first to ' + v.winScore;
    let status = '';
    let cls = '';
    if (v.phase === 'countdown') status = 'Starting in ' + v.countdown + '…' + (v.serving ? ' You serve.' : '');
    else if (v.phase === 'point') status = (v.fault === 'touches' ? 'Too many touches! ' : '') + (v.lastScorer === you ? 'You scored! 🎉' : 'They scored');
    else if (v.phase === 'play') status = 'Bounce it over the net!';
    else if (v.phase === 'over') {
      cls = v.winner === you ? 'won' : 'lost';
      status = v.winner === you ? 'You win! 🏆' : 'You lose';
    }
    const key = score + status + v.phase;
    if (key === lastKey) return; // views come ~30 times a second; only touch the page on a change
    lastKey = key;
    info.innerHTML = '<div class="score">' + score + '</div><div class="status ' + cls + '">' + status + '</div>';
    root.querySelector('.vb-pad').classList.toggle('hidden', v.phase === 'over');
    root.querySelector('.rematch').classList.toggle('hidden', v.phase !== 'over');
  }

  Ark.register('player', 'volley-blobs', {
    mount: function (el, a) {
      api = a;
      held = { left: false, right: false };
      sent = 0;
      root = document.createElement('div');
      root.className = 'vb-phone';
      root.innerHTML =
        '<div class="info"></div>' +
        '<div class="vb-pad"><button class="move left">◀</button><button class="move right">▶</button>' +
        '<button class="primary jump">⬆ JUMP</button></div>' +
        '<button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      holdButton(root.querySelector('.left'), 'left');
      holdButton(root.querySelector('.right'), 'right');
      root.querySelector('.jump').addEventListener('pointerdown', function (e) {
        e.preventDefault();
        api.send({ type: 'jump' });
        api.vibrate(10);
      });
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
    },
    update: render,
    unmount: function () {
      root = info = null;
      lastKey = '';
    },
  });
})();
