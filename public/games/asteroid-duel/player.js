// Asteroid Duel on the phone (server/games/asteroid-duel.js): the shared movement pad steers
// (point where to face; push further to thrust) and FIRE shoots, again and again while held.
(function () {
  Ark.loadCss('/games/asteroid-duel/style.css');
  Ark.loadCss('/shared/move-pad.css');
  const padReady = Ark.loadScript('/shared/move-pad.js');
  const SEND_EVERY_MS = 50;
  const AUTOFIRE_MS = 300; // holding FIRE keeps shooting as fast as the reload allows

  let root = null;
  let stick = null;
  let pad = null;
  let fireBtn = null;
  let info = null;
  let api = null;
  let lastKey = '';
  let prevLives = null;
  let pending = null;
  let lastSent = 0;
  let sendTimer = null;
  let autofire = null;

  function send() {
    sendTimer = null;
    if (!pending || !api) return;
    api.send({ type: 'move', x: pending.x, y: pending.y });
    lastSent = Date.now();
    pending = null;
  }

  function queueMove(x, y, now) {
    pending = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
    const wait = SEND_EVERY_MS - (Date.now() - lastSent);
    if (now || wait <= 0) {
      clearTimeout(sendTimer);
      send();
    } else if (!sendTimer) {
      sendTimer = setTimeout(send, wait);
    }
  }

  function fire() {
    if (!api) return;
    api.send({ type: 'fire' });
    api.vibrate(10);
  }
  function onFireDown(e) {
    e.preventDefault();
    if (fireBtn.setPointerCapture) fireBtn.setPointerCapture(e.pointerId);
    fireBtn.classList.add('held');
    fire();
    clearInterval(autofire);
    autofire = setInterval(fire, AUTOFIRE_MS);
  }
  function onFireUp() {
    if (fireBtn) fireBtn.classList.remove('held');
    clearInterval(autofire);
    autofire = null;
  }
  function onHide() { if (document.hidden) onFireUp(); }

  function hearts(n, max) {
    let s = '';
    for (let i = 0; i < max; i++) s += i < n ? '♥' : '♡';
    return s;
  }

  function render(v) {
    const you = v.you;
    if (prevLives !== null && v.lives[you] < prevLives && v.phase === 'play') api.vibrate([80, 40, 80]);
    prevLives = v.lives[you];
    const score = 'You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them · first to ' + v.winScore;
    const lives = 'You <span class="p' + (you + 1) + '-text">' + hearts(v.lives[you], v.maxLives) + '</span> · <span class="them">Them ' + hearts(v.lives[1 - you], v.maxLives) + '</span>';
    let status = '';
    let cls = '';
    const r = v.result;
    if (v.phase === 'countdown') status = 'Round ' + v.round + ' starts in ' + v.countdown + '…';
    else if (v.phase === 'play') status = v.alive ? 'Hold FIRE to shoot · push the stick further to thrust' : '💥 Hit! Back in a moment…';
    else if (v.phase === 'roundEnd' && r) status = r.draw ? 'Both out: a draw' : r.roundWinner === you ? 'Round to you! 🎉' : 'Round to them';
    else if (v.phase === 'over') {
      cls = v.winner === you ? 'won' : 'lost';
      status = v.winner === you ? 'You win! 🏆' : 'You lose';
    }
    fireBtn.classList.toggle('reloading', !v.ready);
    const key = score + lives + status + v.phase;
    if (key === lastKey) return;
    lastKey = key;
    info.innerHTML = '<div class="score">' + score + '</div><div class="lives">' + lives + '</div><div class="status ' + cls + '">' + status + '</div>';
    const over = v.phase === 'over';
    stick.classList.toggle('hidden', over);
    fireBtn.classList.toggle('hidden', over);
    root.querySelector('.rematch').classList.toggle('hidden', !over);
    if (over) onFireUp();
  }

  Ark.register('player', 'asteroid-duel', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'ad-phone';
      root.innerHTML = '<div class="info"></div><div class="ad-stick"></div><button class="ad-fire">FIRE</button><button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      stick = root.querySelector('.ad-stick');
      fireBtn = root.querySelector('.ad-fire');
      const mounted = root;
      padReady.then(function () {
        if (root !== mounted) return; // left the game while loading
        pad = window.ArkMovePad.create({ api: api, key: 'ark.asteroids.controls', verb: 'steer', onMove: queueMove });
        stick.appendChild(pad.el);
      });
      fireBtn.addEventListener('pointerdown', onFireDown);
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { fireBtn.addEventListener(ev, onFireUp); });
      document.addEventListener('visibilitychange', onHide);
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
    },
    update: render,
    unmount: function () {
      document.removeEventListener('visibilitychange', onHide);
      onFireUp();
      clearTimeout(sendTimer);
      if (pad) pad.destroy();
      root = stick = pad = fireBtn = info = pending = api = null;
      lastKey = '';
      prevLives = null;
    },
  });
})();
