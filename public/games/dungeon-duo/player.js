// Dungeon Duo on the phone (server/games/dungeon-duo.js): the move pad (joystick, D-pad or tilt,
// see shared/move-pad.js), ATTACK, and SPECIAL (hold it for the Fighter's shield; tap it for the
// Healer's healing circle, which then needs time to come back). Your hearts, your partner's, and
// what to do when one of you is down.
(function () {
  Ark.loadCss('/games/dungeon-duo/style.css');
  Ark.loadCss('/shared/move-pad.css');
  const padReady = Ark.loadScript('/shared/move-pad.js');
  const SEND_EVERY_MS = 50;

  let root = null;
  let api = null;
  let pad = null;
  let info = null;
  let specialBtn = null;
  let lastKey = '';
  let pending = null;
  let lastSent = 0;
  let sendTimer = null;
  let holding = new Set(); // pointer ids holding SPECIAL
  let role = null;

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

  function setSpecial(on) {
    if (!api) return;
    api.send({ type: 'special', on: on });
    if (specialBtn) specialBtn.classList.toggle('on', on && role === 'fighter');
  }

  function hearts(h) {
    let s = '';
    for (let i = 0; i < h.max; i++) s += i < h.hp ? '❤️' : '🖤';
    return s;
  }

  function render(v) {
    const me = v.heroes[v.you];
    const them = v.heroes[1 - v.you];
    if (role !== me.role) {
      role = me.role;
      root.querySelector('.dd-attack').textContent = role === 'fighter' ? '⚔️ ATTACK' : '✨ BOLT';
      specialBtn.innerHTML = role === 'fighter' ? '🛡️ SHIELD<small>hold</small>' : '💚 HEAL<small>tap</small>';
    }
    let status;
    if (v.phase === 'countdown') status = '<span class="big">' + (v.countdown || '') + '</span><br>You\'re the ' + (role === 'fighter' ? '🛡️ Fighter' : '✨ Healer');
    else if (v.phase === 'retry') status = '<span class="lost">You both went down: back to the start of the floor</span>';
    else if (v.phase === 'floorClear') status = '<span class="won">Floor cleared! ⬇️</span>';
    else if (v.phase === 'over') status = '<span class="big">' + (v.won ? '⭐'.repeat(v.stars) : '💀') + '</span><br>' + (v.won ? 'Quest complete!' : 'Out of continues');
    else if (me.downed) status = '<span class="lost">You\'re down!</span> Your partner can revive you by standing beside you';
    else if (them.downed) status = '<span class="lost">Your partner is down!</span> Stand beside them to revive them';
    else status = Ark.escapeHtml(v.floorName) + ' · 🗝️ ' + v.keys;
    const healIn = role === 'healer' && me.healIn > 0 ? Math.ceil(me.healIn / 1000) : 0;
    const html = '<div class="dd-hearts"><span>You ' + hearts(me) + '</span><span class="them">Them ' + hearts(them) + '</span></div><div class="dd-status">' + status + '</div>';
    const key = html + healIn;
    if (key !== lastKey) {
      lastKey = key;
      info.innerHTML = html;
      specialBtn.classList.toggle('cooling', healIn > 0);
      specialBtn.setAttribute('data-wait', healIn ? healIn + ' s' : '');
    }
    const over = v.phase === 'over';
    root.querySelector('.dd-controls').classList.toggle('hidden', over);
    root.querySelector('.rematch').classList.toggle('hidden', !over);
    if (over && holding.size) {
      holding.clear();
      setSpecial(false);
    }
  }

  Ark.register('player', 'dungeon-duo', {
    mount: function (el, a) {
      api = a;
      holding = new Set();
      role = null;
      root = document.createElement('div');
      root.className = 'dd-phone';
      root.innerHTML = '<div class="info"></div><div class="dd-controls"><div class="dd-stick"></div><div class="dd-buttons">' +
        '<button class="dd-special">SPECIAL</button><button class="primary dd-attack">ATTACK</button></div></div>' +
        '<button class="primary rematch hidden">Rematch</button>';
      el.appendChild(root);
      info = root.querySelector('.info');
      specialBtn = root.querySelector('.dd-special');
      const mounted = root;
      padReady.then(function () {
        if (root !== mounted) return;
        pad = window.ArkMovePad.create({ api: api, key: 'ark.dungeon.controls', verb: 'walk', onMove: queueMove });
        root.querySelector('.dd-stick').appendChild(pad.el);
      });
      root.querySelector('.dd-attack').addEventListener('pointerdown', function (e) {
        e.preventDefault();
        send(); // face the way you're pushing first
        api.send({ type: 'attack' });
        api.vibrate(15);
      });
      // SPECIAL: held for the Fighter's shield; for the Healer, the press is what counts.
      specialBtn.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        try { specialBtn.setPointerCapture(e.pointerId); } catch (err) { /* the release still lands here */ }
        holding.add(e.pointerId);
        if (holding.size === 1) setSpecial(true);
        api.vibrate(15);
      });
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) {
        specialBtn.addEventListener(ev, function (e) {
          if (!holding.delete(e.pointerId)) return;
          if (!holding.size) setSpecial(false);
        });
      });
      root.querySelector('.rematch').addEventListener('click', function () { api.send({ type: 'rematch' }); });
      setSpecial(false); // after a reload or reconnect: not holding anything
    },
    update: render,
    unmount: function () {
      clearTimeout(sendTimer);
      if (pad) pad.destroy();
      if (holding.size) setSpecial(false);
      root = pad = info = specialBtn = pending = null;
      api = null;
      lastKey = '';
    },
  });
})();
