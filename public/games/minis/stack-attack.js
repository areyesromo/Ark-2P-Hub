// Stack Attack (server/games/minis/stack-attack.js): slide the tray, catch the crates, keep the
// stack straight. Phones use the shared move pad (joystick / D-pad / tilt), sideways only;
// controllers the stick or D-pad. The crates fall by CSS (updates only come on changes), landing
// on top of the stack as drawn.
(function () {
  Ark.loadCss('/shared/move-pad.css');
  const padReady = Ark.loadScript('/shared/move-pad.js');
  const SEND_MS = 80;
  const SHOWN = 6; // crates drawn in the stack; a taller one shows its count
  const lastPad = ['', ''];

  function fieldHtml() {
    return '<div class="mi-sa-field"><div class="falling"></div><div class="tray"><div class="stack"></div><i></i></div></div>' +
      '<div class="mi-sa-lean"><i></i></div>';
  }

  /**
   * One player's half: the trays, the falling crates (the same for both), their stack. The first
   * draw after mounting only notes the latest topple (a reconnect doesn't replay an old one).
   */
  function drawField(box, s, slot) {
    const field = box.querySelector('.mi-sa-field');
    const st = s.stacks[slot];
    const shown = Math.min(SHOWN, st.height);
    field.style.setProperty('--shown', shown);
    field.style.setProperty('--crate', s.crateHalf * 200 + '%');
    ArkMini.keyed(field.querySelector('.falling'), s.crates, function (c) { return c.id; }, function (c) {
      const el = document.createElement('span');
      el.className = 'crate';
      el.style.left = c.x * 100 + '%';
      // Already part way down when first seen: start the fall that far in.
      el.style.animationDuration = c.fall + 'ms';
      el.style.animationDelay = -(c.fall - c.left) + 'ms';
      return el;
    });
    const tray = field.querySelector('.tray');
    tray.style.left = s.trays[slot].x * 100 + '%';
    tray.style.width = s.trayHalf * 200 + '%';
    const stack = tray.querySelector('.stack');
    if (stack.childElementCount !== shown) {
      stack.innerHTML = '';
      for (let i = 0; i < shown; i++) stack.appendChild(document.createElement('b'));
    }
    stack.style.width = (s.crateHalf / s.trayHalf) * 100 + '%';
    stack.style.transform = 'translateX(-50%) rotate(' + st.lean * 18 + 'deg)';
    stack.dataset.more = st.height > SHOWN ? '×' + st.height : '';
    const lean = box.querySelector('.mi-sa-lean');
    lean.style.setProperty('--lean', st.lean);
    lean.classList.toggle('danger', Math.abs(st.lean) > 0.6);
    const ev = s.events[slot];
    if (!field.dataset.seen) {
      field.dataset.seen = '1';
      field.dataset.topple = ev ? ev.n : '';
    }
    if (ev && ev.kind === 'topple' && field.dataset.topple !== String(ev.n)) {
      field.dataset.topple = ev.n;
      field.classList.remove('toppled');
      void field.offsetWidth; // restart the flash
      field.classList.add('toppled');
    }
  }

  let host = null;
  let phone = null;

  ArkMini.register('stack-attack', {
    host: {
      mount: function (el, mctx) {
        lastPad[0] = lastPad[1] = '';
        el.innerHTML = '<div class="mi-split">' + [0, 1].map(function (s) {
          return '<div class="mi-side mi-sa p' + (s + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, s) + '</div><b class="mi-sa-h"></b>' + fieldHtml() + '</div>';
        }).join('') + '</div>';
        host = { sides: el.querySelectorAll('.mi-side') };
      },
      update: function (s) {
        if (!host) return;
        host.sides.forEach(function (side, i) {
          drawField(side, s, i);
          side.querySelector('.mi-sa-h').textContent = '📦 ' + s.stacks[i].height;
        });
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-sa-phone"><div class="msg"></div><div class="mi-sa">' + fieldHtml() + '</div><div class="padbox"></div></div>';
        phone = { el: el, slot: mctx.slot, pad: null, timer: null, last: 0, pending: null, was: undefined };
        const p = phone;
        function send() {
          p.timer = null;
          if (p.pending === null || phone !== p) return;
          p.last = Date.now();
          mctx.send({ type: 'move', x: p.pending });
          p.pending = null;
        }
        padReady.then(function () {
          if (phone !== p) return;
          p.pad = window.ArkMovePad.create({
            api: mctx, key: 'ark.stack.controls', verb: 'slide',
            onMove: function (x, y, now) {
              p.pending = Math.round(x * 100) / 100;
              const wait = SEND_MS - (Date.now() - p.last);
              if (now || wait <= 0) { clearTimeout(p.timer); send(); } else if (!p.timer) p.timer = setTimeout(send, wait);
            },
          });
          el.querySelector('.padbox').appendChild(p.pad.el);
        });
        p.vibrate = mctx.vibrate;
      },
      update: function (s) {
        if (!phone) return;
        const p = phone;
        const ev = s.events[p.slot];
        // The first update after (re)joining only notes the latest event.
        if (ev && p.was !== undefined && (!p.was || p.was.n !== ev.n)) p.vibrate(ev.kind === 'topple' ? 400 : 20);
        p.was = ev;
        drawField(p.el.querySelector('.mi-sa'), s, p.slot);
        p.el.querySelector('.msg').textContent = '📦 ' + s.stacks[p.slot].height + ' · them ' + s.stacks[1 - p.slot].height;
      },
      unmount: function () {
        if (phone) { clearTimeout(phone.timer); if (phone.pad) phone.pad.destroy(); }
        phone = null;
      },
    },
    // Controllers: the stick or D-pad left / right, sent when it changes.
    padPoll: function (pad, s, slot) {
      let x = Math.abs(pad.stick.x) > 0.2 ? pad.stick.x : 0;
      if (pad.held.indexOf('LEFT') !== -1) x = -1;
      if (pad.held.indexOf('RIGHT') !== -1) x = 1;
      x = Math.round(x * 10) / 10;
      if (String(x) === lastPad[slot]) return null;
      lastPad[slot] = String(x);
      return { type: 'move', x: x };
    },
    sounds: function (prev, s) {
      const out = [];
      s.events.forEach(function (ev, i) {
        if (!ev || (prev.events[i] && prev.events[i].n === ev.n)) return;
        out.push(ev.kind === 'topple' ? 'crash' : 'lock');
      });
      return out;
    },
  });
})();
