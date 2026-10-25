// Rally Tennis on the phone (server/games/rally-tennis.js): a big SWING button, and ◀ ▶ to hold
// for aiming (left and right as on the TV). Watch the TV and swing as the ball reaches you.
(function () {
  Ark.loadCss('/games/rally-tennis/style.css');

  let root = null;
  let info = null;
  let api = null;
  let lastKey = '';
  let held = { left: new Set(), right: new Set() }; // pointer ids on each aim button
  let sent = null;

  function sendAim() {
    if (!api) return;
    const dir = (held.right.size ? 1 : 0) - (held.left.size ? 1 : 0);
    if (dir === sent) return;
    sent = dir;
    api.send({ type: 'aim', dir: dir });
  }

  function holdButton(btn, side) {
    const set = function (on) {
      return function (e) {
        e.preventDefault();
        if (on && btn.setPointerCapture) btn.setPointerCapture(e.pointerId);
        if (on) held[side].add(e.pointerId);
        else held[side].delete(e.pointerId);
        btn.classList.toggle('on', held[side].size > 0);
        sendAim();
      };
    };
    btn.addEventListener('pointerdown', set(true));
    ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { btn.addEventListener(ev, set(false)); });
  }

  function releaseAll() {
    held.left.clear();
    held.right.clear();
    if (root) root.querySelectorAll('.aim').forEach(function (b) { b.classList.remove('on'); });
    sendAim();
  }
  function onHide() { if (document.hidden) releaseAll(); }

  function render(v) {
    const you = v.you;
    const score = 'Games: you ' + v.games[you] + ' – ' + v.games[1 - you] + ' them · first to ' + v.winGames;
    let status = '';
    let cls = '';
    if (v.phase === 'countdown') status = 'Starting in ' + v.countdown + '…';
    else if (v.yourServe) { status = 'Your serve: SWING!'; cls = 'go'; }
    else if (v.phase === 'serve') status = 'They\'re serving';
    else if (v.yourShot) { status = 'Coming to you: swing as it reaches you'; cls = 'go'; }
    else if (v.phase === 'rally') status = 'Their shot…';
    else if (v.phase === 'point' && v.last) status = v.last.winner === you ? 'Your point! 🎉' : 'Their point';
    else if (v.phase === 'over') {
      cls = v.winner === you ? 'won' : 'lost';
      status = v.winner === you ? 'You win! 🏆' : 'You lose';
    }
    const key = score + v.calls.join(':') + v.score + status + v.phase;
    if (key === lastKey) return;
    lastKey = key;
    // This game, you first: '15 – 30', or Deuce / Advantage (named).
    const game = v.calls[0] === '40' && v.calls[1] === '40' ? 'Deuce' : v.calls.indexOf('Ad') !== -1 ? Ark.escapeHtml(v.score) : 'You ' + v.calls[you] + ' – ' + v.calls[1 - you] + ' Them';
    info.innerHTML = '<div class="score">' + score + '</div><div class="game">' + game + '</div><div class="status ' + cls + '">' + status + '</div>';
    if (v.phase === 'over') releaseAll();
    root.querySelector('.rt-pad').classList.toggle('hidden', v.phase === 'over');
    root.querySelector('.rematch').classList.toggle('hidden', v.phase !== 'over');
  }

  Ark.register('player', 'rally-tennis', {
    mount: function (el, a) {
      api = a;
      held = { left: new Set(), right: new Set() };
      sent = null;
      sendAim(); // after a reload or reconnect: aiming straight
      document.addEventListener('visibilitychange', onHide);
      root = document.createElement('div');
      root.className = 'rt-phone';
      root.innerHTML =
        '<div class="info"></div>' +
        '<div class="rt-pad"><button class="aim left">◀</button><button class="aim right">▶</button>' +
        '<button class="primary swing">🎾 SWING</button></div>' +
        '<button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      holdButton(root.querySelector('.left'), 'left');
      holdButton(root.querySelector('.right'), 'right');
      root.querySelector('.swing').addEventListener('pointerdown', function (e) {
        e.preventDefault();
        api.send({ type: 'swing' });
        api.vibrate(15);
      });
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
    },
    update: render,
    unmount: function () {
      document.removeEventListener('visibilitychange', onHide);
      api = null;
      releaseAll();
      root = info = null;
      lastKey = '';
    },
  });
})();
