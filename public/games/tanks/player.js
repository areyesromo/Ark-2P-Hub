(function () {
  Ark.loadCss('/games/tanks/style.css');
  const STICK_PX = 60; // drag this far from where you touched for full speed
  const SEND_EVERY_MS = 50;
  const AUTOFIRE_MS = 360; // holding FIRE keeps shooting as fast as the reload allows

  let root = null;
  let stick = null;
  let base = null;
  let knob = null;
  let fireBtn = null;
  let info = null;
  let api = null;
  let view = null;
  let lastKey = '';
  let prevHp = null;
  let origin = null; // where the joystick touch started
  let pending = null;
  let lastSent = 0;
  let sendTimer = null;
  let autofire = null;

  function send() {
    sendTimer = null;
    if (!pending) return;
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

  // Floating joystick: the base appears where you touch; drag away from it to drive.
  function onDown(e) {
    e.preventDefault();
    if (stick.setPointerCapture) stick.setPointerCapture(e.pointerId);
    const r = stick.getBoundingClientRect();
    origin = { x: e.clientX, y: e.clientY };
    base.style.left = knob.style.left = e.clientX - r.left + 'px';
    base.style.top = knob.style.top = e.clientY - r.top + 'px';
  }

  function onMove(e) {
    if (!origin) return;
    const r = stick.getBoundingClientRect();
    let dx = e.clientX - origin.x;
    let dy = e.clientY - origin.y;
    const d = Math.hypot(dx, dy);
    if (d > STICK_PX) {
      dx *= STICK_PX / d;
      dy *= STICK_PX / d;
    }
    knob.style.left = origin.x - r.left + dx + 'px';
    knob.style.top = origin.y - r.top + dy + 'px';
    queueMove(dx / STICK_PX, dy / STICK_PX);
  }

  function onUp() {
    if (!origin) return;
    origin = null;
    base.style.left = knob.style.left = '50%';
    base.style.top = knob.style.top = '50%';
    queueMove(0, 0, true); // stop right away
  }

  function fire() {
    api.send({ type: 'fire' });
    api.vibrate(12);
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
    fireBtn.classList.remove('held');
    clearInterval(autofire);
    autofire = null;
  }

  function hearts(hp, max) {
    let s = '';
    for (let i = 0; i < max; i++) s += i < hp ? '♥' : '♡';
    return s;
  }

  function render(v) {
    view = v;
    const you = v.you;
    if (prevHp !== null && v.hp[you] < prevHp && v.phase !== 'countdown') api.vibrate([80, 40, 80]);
    prevHp = v.hp[you];
    const score = 'You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them · first to ' + v.winScore;
    const hp = 'You <span class="p' + (you + 1) + '-text">' + hearts(v.hp[you], v.maxHp) + '</span> · <span class="them">Them ' + hearts(v.hp[1 - you], v.maxHp) + '</span>';
    let status = '';
    let cls = '';
    const r = v.result;
    if (v.phase === 'countdown') status = 'Round ' + v.round + ' starts in ' + v.countdown + '…';
    else if (v.phase === 'play') status = 'Drag to drive · hold FIRE to shoot · ⏱ ' + Math.floor(v.timeLeft / 60) + ':' + String(v.timeLeft % 60).padStart(2, '0');
    else if (v.phase === 'roundEnd' && r) {
      if (r.draw) status = 'Draw!';
      else if (r.reason === 'time') status = r.roundWinner === you ? 'Time! You had more armour 🎉' : 'Time! They had more armour';
      else status = r.roundWinner === you ? 'Destroyed them! Round to you 🎉' : 'You were destroyed 💥';
    } else if (v.phase === 'over') {
      cls = v.winner === you ? 'won' : 'lost';
      status = v.winner === you ? 'You win! 🏆' : 'You lose';
    }
    fireBtn.classList.toggle('reloading', !v.ready);
    const key = score + hp + status + v.phase;
    if (key === lastKey) return; // views arrive ~30x a second; only touch the DOM on change
    lastKey = key;
    info.innerHTML =
      '<div class="score">' + score + '</div>' +
      '<div class="hp">' + hp + '</div>' +
      '<div class="status ' + cls + '">' + status + '</div>';
    const over = v.phase === 'over';
    stick.classList.toggle('hidden', over);
    fireBtn.classList.toggle('hidden', over);
    root.querySelector('.rematch').classList.toggle('hidden', !over);
    if (over) onFireUp();
  }

  Ark.register('player', 'tanks', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'tk-phone';
      root.innerHTML =
        '<div class="info"></div>' +
        '<div class="tk-stick"><div class="base"></div><div class="knob"></div><div class="hint">Touch and drag to drive</div></div>' +
        '<button class="tk-fire">FIRE</button>' +
        '<button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      stick = root.querySelector('.tk-stick');
      base = root.querySelector('.base');
      knob = root.querySelector('.knob');
      fireBtn = root.querySelector('.tk-fire');
      stick.addEventListener('pointerdown', onDown);
      stick.addEventListener('pointermove', onMove);
      stick.addEventListener('pointerup', onUp);
      stick.addEventListener('pointercancel', onUp);
      fireBtn.addEventListener('pointerdown', onFireDown);
      fireBtn.addEventListener('pointerup', onFireUp);
      fireBtn.addEventListener('pointercancel', onFireUp);
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
    },
    update: render,
    unmount: function () {
      clearInterval(autofire);
      clearTimeout(sendTimer);
      root = stick = base = knob = fireBtn = info = view = origin = pending = null;
      autofire = null;
      lastKey = '';
      prevHp = null;
    },
  });
})();
