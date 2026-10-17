(function () {
  Ark.loadCss('/games/marble-maze/style.css');
  Ark.loadCss('/shared/move-pad.css');
  const padReady = Ark.loadScript('/shared/move-pad.js');
  const SEND_EVERY_MS = 50;
  const AXIS = {
    x: { big: '↔', text: 'You tilt the board <strong>left and right</strong>' },
    y: { big: '↕', text: 'You tilt the board <strong>forwards and back</strong>' },
    both: { big: '✥', text: 'You both tilt the board <strong>every way</strong>' },
  };

  let root = null;
  let els = null;
  let api = null;
  let pad = null; // ArkMovePad: joystick, D-pad or tilt
  let textKey = '';
  let pending = null;
  let lastSent = 0;
  let sendTimer = null;

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

  function stars(n) {
    return n ? new Array(n + 1).join('⭐') : '—';
  }

  function render(v) {
    let status = '';
    if (v.phase === 'intro') status = 'Maze ' + (v.levelIndex + 1) + ': ' + Ark.escapeHtml(v.level.name) + ' · ' + v.countdown + '…';
    else if (v.phase === 'play') status = 'Roll it to the green goal!';
    else if (v.phase === 'fall') status = '🕳️ Down the hole!';
    else if (v.phase === 'clear' && v.result) status = v.result.cleared ? '🎉 Made it! ' + stars(v.result.stars) : '⏱ Out of time';
    else if (v.phase === 'over') status = '<span class="big">' + v.stars + ' of ' + v.maxStars + ' ⭐</span>';
    const key = JSON.stringify([v.axis, status, v.phase, v.stars]);
    if (key === textKey) return;
    textKey = key;
    const a = AXIS[v.axis] || AXIS.both;
    els.axis.innerHTML = '<span class="glyph">' + a.big + '</span><span>' + a.text + '</span>';
    els.pad.className = 'mm-pad axis-' + (v.axis || 'both'); // dims the D-pad arrows you don't use
    els.status.innerHTML = status;
    const over = v.phase === 'over';
    els.pad.classList.toggle('hidden', over);
    els.rematch.classList.toggle('hidden', !over);
  }

  Ark.register('player', 'marble-maze', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'mm-phone';
      root.innerHTML = '<div class="mm-axis"></div><div class="status"></div><div class="mm-pad"></div><button class="primary rematch hidden">Play again</button>';
      el.appendChild(root);
      els = {
        axis: root.querySelector('.mm-axis'),
        status: root.querySelector('.status'),
        pad: root.querySelector('.mm-pad'),
        rematch: root.querySelector('.rematch'),
      };
      els.rematch.addEventListener('click', function () { api.send({ type: 'rematch' }); });
      const mounted = root;
      padReady.then(function () {
        if (root !== mounted) return;
        pad = window.ArkMovePad.create({ api: api, key: 'ark.marble.controls', verb: 'tilt the board', onMove: queueMove });
        els.pad.appendChild(pad.el);
      });
    },
    update: render,
    unmount: function () {
      clearTimeout(sendTimer);
      if (pad) pad.destroy();
      root = els = pad = pending = null;
      textKey = '';
    },
  });
})();
