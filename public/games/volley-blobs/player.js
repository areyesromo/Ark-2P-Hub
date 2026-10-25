// Volley Blobs on the phone (server/games/volley-blobs.js): hold ◀ or ▶ to slide, tap JUMP.
// Each button works with its own finger, so you can slide and jump at once. A button is held
// while any finger is on it; everything lets go if the phone locks or switches app.
(function () {
  Ark.loadCss('/games/volley-blobs/style.css');

  let root = null;
  let info = null;
  let api = null;
  let lastKey = '';
  let held = { left: new Set(), right: new Set() }; // pointer ids on each button
  let sent = 0;

  function sendMove() {
    if (!api) return;
    const x = (held.right.size ? 1 : 0) - (held.left.size ? 1 : 0);
    if (x === sent) return;
    sent = x;
    api.send({ type: 'move', x: x });
  }

  function holdButton(btn, side) {
    const set = function (on) {
      return function (e) {
        e.preventDefault();
        if (on && btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
        if (on) held[side].add(e.pointerId);
        else held[side].delete(e.pointerId);
        btn.classList.toggle('on', held[side].size > 0);
        sendMove();
      };
    };
    btn.addEventListener('pointerdown', set(true));
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { btn.addEventListener(ev, set(false)); });
  }

  /** Lets go of both directions (the page hid, the game ended). */
  function releaseAll() {
    held.left.clear();
    held.right.clear();
    if (root) root.querySelectorAll('.move').forEach(function (b) { b.classList.remove('on'); });
    sendMove();
  }
  function onHide() { if (document.hidden) releaseAll(); }

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
    if (v.phase === 'over') releaseAll();
    root.querySelector('.vb-pad').classList.toggle('hidden', v.phase === 'over');
    root.querySelector('.rematch').classList.toggle('hidden', v.phase !== 'over');
  }

  Ark.register('player', 'volley-blobs', {
    mount: function (el, a) {
      api = a;
      held = { left: new Set(), right: new Set() };
      sent = 0;
      document.addEventListener('visibilitychange', onHide);
      window.addEventListener('blur', releaseAll);
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
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('blur', releaseAll);
      api = null; // leaving: nothing more to send
      releaseAll();
      root = info = null;
      lastKey = '';
    },
  });
})();
