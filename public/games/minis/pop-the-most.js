// Pop the Most (server/games/minis/pop-the-most.js): steer a crosshair and pop the balloons in your
// colour (and the gold ones). Phones steer with the shared move pad and have a POP button;
// controllers use the stick or D-pad and A.
(function () {
  Ark.loadCss('/shared/move-pad.css');
  const padReady = Ark.loadScript('/shared/move-pad.js');
  const SEND_MS = 80;
  const lastPad = ['', ''];
  const SCORE = { own: '+1', gold: '+3', spike: '−2', theirs: '0' };

  const kindOf = function (who, by) { return who === by ? 'own' : who === 'gold' ? 'gold' : who === 'spike' ? 'spike' : 'theirs'; };
  const cls = function (who) { return who === 0 ? 'p1' : who === 1 ? 'p2' : who; };

  const at = function (el, x, y) { el.style.left = x * 100 + '%'; el.style.top = y * 100 + '%'; };
  function span(cls, html) {
    const el = document.createElement('span');
    el.className = cls;
    el.innerHTML = html;
    return el;
  }

  /** Balloons, pop scores and crosshairs, each kept by id so they glide and the scores float up. */
  function field(box, s, players) {
    ArkMini.keyed(box.balloons, s.balloons, function (b) { return b.id; }, function (b) {
      return span('balloon ' + cls(b.who), b.who === 'spike' ? '✸' : '');
    }, function (el, b) { at(el, b.x, b.y); });
    ArkMini.keyed(box.pops, s.pops, function (p) { return p.id; }, function (p) {
      const kind = kindOf(p.who, p.by);
      const el = span('pop ' + kind, SCORE[kind]);
      at(el, p.x, p.y);
      return el;
    });
    ArkMini.keyed(box.cursors, s.cursors, function (c, i) { return i; }, function (c, i) {
      return span('cross p' + (i + 1), '<b>' + ArkMini.nameOf({ players: players }, i) + '</b>');
    }, function (el, c) { at(el, c.x, c.y); });
  }

  let host = null;
  let phone = null;

  ArkMini.register('pop-the-most', {
    host: {
      mount: function (el, mctx) {
        lastPad[0] = lastPad[1] = '';
        el.innerHTML = '<div class="mi-coins"><div class="score p1"></div>' +
          '<div class="mi-field2 mi-pop-field"><div class="layer"></div><div class="layer"></div><div class="layer"></div></div>' +
          '<div class="score p2"></div></div>';
        const layers = el.querySelectorAll('.mi-pop-field .layer');
        host = { el: el, players: mctx.players, box: { balloons: layers[0], pops: layers[1], cursors: layers[2] } };
      },
      update: function (s) {
        if (!host) return;
        field(host.box, s, host.players);
        host.el.querySelector('.score.p1').textContent = '🎈 ' + s.points[0];
        host.el.querySelector('.score.p2').textContent = '🎈 ' + s.points[1];
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-coins-phone"><div class="mine"></div><div class="padbox"></div>' +
          '<button class="primary mi-big-btn mi-pop-btn">POP!</button></div>';
        phone = { el: el, slot: mctx.slot, pad: null, timer: null, last: 0, pending: null };
        const p = phone;
        el.querySelector('.mi-pop-btn').addEventListener('pointerdown', function () { mctx.send({ type: 'pop' }); mctx.vibrate(8); });
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
            api: mctx, key: 'ark.pop.controls', verb: 'aim',
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
        phone.el.querySelector('.mine').textContent = '🎈 ' + s.points[phone.slot] + ' · them ' + s.points[1 - phone.slot];
      },
      unmount: function () {
        if (phone) { clearTimeout(phone.timer); if (phone.pad) phone.pad.destroy(); }
        phone = null;
      },
    },
    pad: function (btn) { return btn === 'A' ? { type: 'pop' } : null; },
    // Controllers aim with the stick or D-pad: sent when the direction changes.
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
      const fresh = s.pops.filter(function (p) { return !prev.pops.some(function (o) { return o.id === p.id; }); });
      if (fresh.some(function (p) { return p.who === 'spike'; })) return ['boom'];
      return fresh.length ? ['point'] : [];
    },
  });
})();
