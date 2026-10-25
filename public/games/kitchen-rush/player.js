// Kitchen Rush on the phone (server/games/kitchen-rush.js): the move pad (joystick, D-pad or
// tilt, see shared/move-pad.js), ACTION (pick up, put down, serve) and CHOP (hold it at a
// chopping board), what you're carrying, the orders and the clock.
(function () {
  Ark.loadCss('/games/kitchen-rush/style.css');
  Ark.loadCss('/shared/move-pad.css');
  const padReady = Ark.loadScript('/shared/move-pad.js');
  const SEND_EVERY_MS = 50;
  const ICON = { bun: '🍞', meat: '🥩', lettuce: '🥬', tomato: '🍅', plate: '🍽️' };
  const STATE = { raw: 'raw', chopped: 'chopped', cooked: 'cooked', burnt: 'burnt!' };
  const DISH = { plain: '🍔', lettuce: '🍔🥬', works: '🍔🥬🍅', salad: '🥗' };

  let root = null;
  let stick = null;
  let pad = null;
  let info = null;
  let chopBtn = null;
  let api = null;
  let lastKey = '';
  let pending = null;
  let lastSent = 0;
  let sendTimer = null;
  let chopping = new Set(); // pointer ids holding CHOP

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

  function setChop(on) {
    if (!api) return;
    api.send({ type: 'chop', on: on });
    if (chopBtn) chopBtn.classList.toggle('on', on);
  }

  function heldText(h) {
    if (!h) return 'Hands free';
    if (h.kind === 'plate') return '🍽️ Plate' + (h.contents.length ? ': ' + h.contents.map(function (c) { return ICON[c]; }).join(' ') : ' (empty)');
    return ICON[h.kind] + ' ' + h.kind + ' (' + STATE[h.state] + ')';
  }

  function clock(ms) {
    const s = Math.ceil(ms / 1000);
    return Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  }

  function render(v) {
    const me = v.chefs[v.you];
    let status;
    if (v.phase === 'countdown') status = '<span class="big">' + (v.countdown || '') + '</span><br>' + Ark.escapeHtml(v.kitchen) + ': get cooking!';
    else if (v.phase === 'over') status = '<span class="big">' + (v.stars ? '⭐'.repeat(v.stars) : 'Shift over') + '</span><br>' + v.coins + ' 💰 · ' + v.served + ' served';
    else status = '<span class="held">' + heldText(me.held) + '</span>';
    const orders = v.phase === 'play' ? '<div class="kr-mini">' + v.orders.map(function (o) {
      return '<span class="' + (o.left < 0.25 ? 'late' : '') + '">' + DISH[o.recipe] + '</span>';
    }).join('') + '</div>' : '';
    const html = '<div class="kr-line">💰 ' + v.coins + ' · ⏱ ' + clock(v.timeLeftMs) + '</div><div class="kr-status">' + status + '</div>' + orders;
    if (html === lastKey) return;
    lastKey = html;
    info.innerHTML = html;
    const over = v.phase === 'over';
    root.querySelector('.kr-controls').classList.toggle('hidden', over);
    root.querySelector('.rematch').classList.toggle('hidden', !over);
    if (over && chopping.size) {
      chopping.clear();
      setChop(false);
    }
  }

  Ark.register('player', 'kitchen-rush', {
    mount: function (el, a) {
      api = a;
      chopping = new Set();
      root = document.createElement('div');
      root.className = 'kr-phone';
      root.innerHTML = '<div class="info"></div>' +
        '<div class="kr-controls"><div class="kr-stick"></div><div class="kr-buttons">' +
        '<button class="kr-chop">CHOP<small>hold</small></button><button class="primary kr-act">ACTION</button></div></div>' +
        '<button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      stick = root.querySelector('.kr-stick');
      chopBtn = root.querySelector('.kr-chop');
      const mounted = root;
      padReady.then(function () {
        if (root !== mounted) return; // left the game while loading
        pad = window.ArkMovePad.create({ api: api, key: 'ark.kitchen.controls', verb: 'walk', onMove: queueMove });
        stick.appendChild(pad.el);
      });
      root.querySelector('.kr-act').addEventListener('pointerdown', function (e) {
        e.preventDefault();
        send(); // face the way you're pushing first
        api.send({ type: 'act' });
        api.vibrate(15);
      });
      chopBtn.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        try { chopBtn.setPointerCapture(e.pointerId); } catch (err) { /* no capture: the release still lands here */ }
        chopping.add(e.pointerId);
        if (chopping.size === 1) setChop(true);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) {
        chopBtn.addEventListener(ev, function (e) {
          if (!chopping.delete(e.pointerId)) return;
          if (!chopping.size) setChop(false);
        });
      });
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
      setChop(false); // after a reload or reconnect: not chopping
    },
    update: render,
    unmount: function () {
      clearTimeout(sendTimer);
      if (pad) pad.destroy();
      if (chopping.size) setChop(false);
      root = stick = pad = info = chopBtn = pending = null;
      api = null;
      lastKey = '';
    },
  });
})();
