// Coin Grab (server/games/minis/coin-grab.js): run around grabbing coins.
// Phones steer with the shared move pad (joystick / D-pad / tilt);
// controllers with the stick or D-pad.
(function () {
  Ark.loadCss('/shared/move-pad.css');
  const padReady = Ark.loadScript('/shared/move-pad.js');
  const SEND_MS = 80;
  const lastPad = ['', ''];

  function field(s, players) {
    return s.items.map(function (it) {
      const fade = it.age > s.life - 1000 ? ' fading' : '';
      return '<span class="item' + fade + '" style="left:' + it.x * 100 + '%;top:' + it.y * 100 + '%">' + (it.bomb ? '💣' : '🪙') + '</span>';
    }).join('') + s.players.map(function (p, i) {
      return '<span class="runner p' + (i + 1) + (p.stunned ? ' stunned' : '') + '" style="left:' + p.x * 100 + '%;top:' + p.y * 100 + '%">' +
        (p.stunned ? '💫' : '') + '<b>' + ArkMini.nameOf({ players: players }, i) + '</b></span>';
    }).join('');
  }

  let host = null;
  let phone = null;

  ArkMini.register('coin-grab', {
    host: {
      mount: function (el, mctx) {
        lastPad[0] = lastPad[1] = '';
        el.innerHTML = '<div class="mi-coins"><div class="score p1"></div><div class="mi-field2"></div><div class="score p2"></div></div>';
        host = { el: el, players: mctx.players };
      },
      update: function (s) {
        if (!host) return;
        host.el.querySelector('.mi-field2').innerHTML = field(s, host.players);
        host.el.querySelector('.score.p1').innerHTML = '🪙 ' + s.coins[0];
        host.el.querySelector('.score.p2').innerHTML = '🪙 ' + s.coins[1];
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-coins-phone"><div class="mine"></div><div class="padbox"></div></div>';
        phone = { el: el, slot: mctx.slot, pad: null, timer: null, last: 0, pending: null };
        const p = phone;
        function send() {
          p.timer = null;
          if (!p.pending || phone !== p) return;
          p.last = Date.now();
          mctx.send({ type: 'move', x: p.pending.x, y: p.pending.y });
          p.pending = null;
        }
        padReady.then(function () {
          if (phone !== p) return;
          p.pad = window.ArkMovePad.create({
            api: mctx, key: 'ark.coins.controls', verb: 'run',
            onMove: function (x, y, now) {
              p.pending = { x: Math.round(x * 100) / 100, y: Math.round(y * 100) / 100 };
              const wait = SEND_MS - (Date.now() - p.last);
              if (now || wait <= 0) { clearTimeout(p.timer); send(); } else if (!p.timer) p.timer = setTimeout(send, wait);
            },
          });
          el.querySelector('.padbox').appendChild(p.pad.el);
        });
      },
      update: function (s) {
        if (!phone) return;
        const me = s.players[phone.slot];
        phone.el.querySelector('.mine').innerHTML = '🪙 ' + s.coins[phone.slot] + ' · them ' + s.coins[1 - phone.slot] + (me.stunned ? ' <b class="mi-bad">💫 Stunned!</b>' : '');
      },
      unmount: function () {
        if (phone) { clearTimeout(phone.timer); if (phone.pad) phone.pad.destroy(); }
        phone = null;
      },
    },
    // Controllers: send the stick / D-pad direction when it changes.
    padPoll: function (pad, s, slot) {
      let x = Math.abs(pad.stick.x) > 0.2 ? pad.stick.x : 0;
      let y = Math.abs(pad.stick.y) > 0.2 ? pad.stick.y : 0;
      if (pad.held.indexOf('LEFT') !== -1) x = -1;
      if (pad.held.indexOf('RIGHT') !== -1) x = 1;
      if (pad.held.indexOf('UP') !== -1) y = -1;
      if (pad.held.indexOf('DOWN') !== -1) y = 1;
      x = Math.round(x * 10) / 10;
      y = Math.round(y * 10) / 10;
      const key = x + ',' + y;
      if (key === lastPad[slot]) return null;
      lastPad[slot] = key;
      return { type: 'move', x: x, y: y };
    },
    sounds: function (prev, s) {
      const out = [];
      if (s.coins[0] + s.coins[1] > prev.coins[0] + prev.coins[1]) out.push('point');
      if (s.players.some(function (p, i) { return p.stunned && !prev.players[i].stunned; })) out.push('boom');
      return out;
    },
  });
})();
