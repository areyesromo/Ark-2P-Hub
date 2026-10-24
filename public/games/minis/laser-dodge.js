// Laser Dodge (server/games/minis/laser-dodge.js): jump the low beams, duck the high ones.
// The TV shows a lane each with the same beams; phones have JUMP and a hold-to-DUCK button.
// Controllers: A / Up jumps, hold B / Down to duck.
(function () {
  const lastDuck = [null, null];

  /** A lane, once per minigame; update() then changes classes and keeps the beams by id. */
  function lane(slot, players) {
    return '<div class="mi-side p' + (slot + 1) + ' mi-ld-lane">' +
      '<div class="who">' + ArkMini.nameOf({ players: players }, slot) + '</div>' +
      '<div class="lives"></div><div class="beams"></div><span class="body">🧍</span><span class="floor"></span></div>';
  }
  function livesHtml(p, all) {
    return (p.lives ? '❤️'.repeat(p.lives) : '💀') + '<span class="lost">' + '🖤'.repeat(all - p.lives) + '</span>';
  }

  let host = null;
  let phone = null;

  ArkMini.register('laser-dodge', {
    host: {
      mount: function (el, mctx) {
        lastDuck[0] = lastDuck[1] = null;
        el.innerHTML = '<div class="mi-split">' + lane(0, mctx.players) + lane(1, mctx.players) + '</div>';
        host = { lanes: el.querySelectorAll('.mi-ld-lane') };
      },
      update: function (s) {
        if (!host) return;
        host.lanes.forEach(function (laneEl, slot) {
          const p = s.players[slot];
          laneEl.classList.toggle('hit', p.hit);
          const lives = livesHtml(p, s.lives);
          const livesEl = laneEl.querySelector('.lives');
          if (livesEl.innerHTML !== lives) livesEl.innerHTML = lives;
          const body = laneEl.querySelector('.body');
          body.classList.toggle('air', p.air);
          body.classList.toggle('duck', p.duck && !p.air);
          ArkMini.keyed(laneEl.querySelector('.beams'), s.beams, function (b) { return b.id; }, function (b) {
            const el = document.createElement('span');
            el.className = 'beam ' + b.kind;
            return el;
          }, function (el, b) { el.classList.toggle('live', b.inMs <= 0); });
        });
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
        // Ducking while any finger is on DUCK (two fingers, then one lifted, still ducks).
        const fingers = new Set();
        let down = false;
        function set(on) {
          if (on === down) return;
          down = on;
          duck.classList.toggle('held', on);
          mctx.send({ type: 'duck', on: on });
        }
        // A reload or a new mount mid-game starts standing, whatever the server last heard.
        mctx.send({ type: 'duck', on: false });
        duck.addEventListener('pointerdown', function (e) { duck.setPointerCapture(e.pointerId); fingers.add(e.pointerId); set(true); });
        ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) {
          duck.addEventListener(ev, function (e) { fingers.delete(e.pointerId); set(fingers.size > 0); });
        });
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
