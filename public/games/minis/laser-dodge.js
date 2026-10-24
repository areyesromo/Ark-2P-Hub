// Laser Dodge (server/games/minis/laser-dodge.js): jump the low beams, duck the high ones.
// The TV shows a lane each with the same beams; phones have JUMP and a hold-to-DUCK button.
// Controllers: A / Up jumps, hold B / Down to duck.
(function () {
  const lastDuck = [null, null];

  function side(s, slot, players) {
    const p = s.players[slot];
    const pose = p.air ? ' air' : p.duck ? ' duck' : '';
    return '<div class="mi-side p' + (slot + 1) + ' mi-ld-lane' + (p.hit ? ' hit' : '') + '">' +
      '<div class="who">' + ArkMini.nameOf({ players: players }, slot) + '</div>' +
      '<div class="lives">' + (p.lives ? '❤️'.repeat(p.lives) : '💀') + '<span class="lost">' + '🖤'.repeat(s.lives - p.lives) + '</span></div>' +
      s.beams.map(function (b) {
        return '<span class="beam ' + b.kind + (b.inMs <= 0 ? ' live' : '') + '"></span>';
      }).join('') +
      '<span class="body' + pose + '">🧍</span>' +
      '<span class="floor"></span>' +
      '</div>';
  }

  let host = null;
  let phone = null;

  ArkMini.register('laser-dodge', {
    host: {
      mount: function (el, mctx) {
        lastDuck[0] = lastDuck[1] = null;
        el.innerHTML = '<div class="mi-split"></div>';
        host = { el: el.firstChild, players: mctx.players };
      },
      update: function (s) {
        if (host) host.el.innerHTML = side(s, 0, host.players) + side(s, 1, host.players);
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-ld-phone"><div class="msg"></div>' +
          '<button class="primary mi-big-btn jump">⬆ JUMP</button>' +
          '<button class="mi-big-btn duck">⬇ DUCK <small>(hold)</small></button></div>';
        phone = { el: el, slot: mctx.slot };
        el.querySelector('.jump').addEventListener('pointerdown', function () { mctx.send({ type: 'jump' }); mctx.vibrate(10); });
        const duck = el.querySelector('.duck');
        let down = false;
        function set(on) {
          if (on === down) return;
          down = on;
          duck.classList.toggle('held', on);
          mctx.send({ type: 'duck', on: on });
        }
        duck.addEventListener('pointerdown', function (e) { duck.setPointerCapture(e.pointerId); set(true); });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { duck.addEventListener(ev, function () { set(false); }); });
      },
      update: function (s) {
        if (!phone) return;
        const me = s.players[phone.slot];
        const next = s.beams.filter(function (b) { return b.inMs > 0; })[0];
        phone.el.querySelector('.msg').innerHTML = (me.lives ? '❤️'.repeat(me.lives) : '💀') +
          (next ? '<br><span class="mi-ld-next ' + next.kind + '">' + (next.kind === 'low' ? '⬆ JUMP!' : '⬇ DUCK!') + '</span>' : '');
      },
      unmount: function () { phone = null; },
    },
    pad: function (btn) { return btn === 'A' || btn === 'UP' ? { type: 'jump' } : null; },
    // Duck while B or Down is held: sent when that changes.
    padPoll: function (pad, s, slot) {
      const on = pad.held.indexOf('B') !== -1 || pad.held.indexOf('DOWN') !== -1;
      if (on === lastDuck[slot]) return null;
      lastDuck[slot] = on;
      return { type: 'duck', on: on };
    },
    sounds: function (prev, s) {
      const out = [];
      if (s.players.some(function (p, i) { return p.lives < prev.players[i].lives; })) out.push('crash');
      if (s.beams.some(function (b) { return b.inMs <= 0 && !prev.beams.some(function (o) { return o.id === b.id && o.inMs <= 0; }); })) out.push('shoot');
      return out;
    },
  });
})();
