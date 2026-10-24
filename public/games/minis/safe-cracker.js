// Safe Cracker (server/games/minis/safe-cracker.js): turn the dial, feel for the click, TRY.
// Phones turn the dial by dragging round it; it buzzes (Android) and the lock light flickers on
// your number. Controllers: ← → turn one number, LB / RB five, A tries; their dial is on the TV.
(function () {
  const STEP_DEG = 9; // 40 numbers round the dial

  function dialHtml() {
    return '<div class="mi-sc-dial"><div class="face"><span class="mark"></span><b class="num"></b></div></div>' +
      '<div class="mi-sc-locks"><span></span><span></span><span></span></div>';
  }
  /** Shows one safe in an element built with dialHtml(). */
  function showSafe(el, safe, size) {
    // The face turns the way the finger goes (clockwise counts up); the number stays upright.
    el.querySelector('.face').style.transform = 'rotate(' + (safe.dial * 360) / size + 'deg)';
    el.querySelector('.num').style.transform = 'rotate(' + (-safe.dial * 360) / size + 'deg)';
    el.querySelector('.num').textContent = safe.dial;
    el.querySelector('.mi-sc-dial').classList.toggle('click', safe.click);
    el.querySelector('.mi-sc-dial').classList.toggle('locked', safe.locked);
    el.querySelectorAll('.mi-sc-locks span').forEach(function (s, i) { s.classList.toggle('open', i < safe.opened); });
  }

  let host = null;
  let phone = null;

  ArkMini.register('safe-cracker', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-split">' + [0, 1].map(function (s) {
          return '<div class="mi-side p' + (s + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, s) + '</div>' + dialHtml() + '</div>';
        }).join('') + '</div>';
        host = { sides: el.querySelectorAll('.mi-side') };
      },
      update: function (s) {
        if (host) host.sides.forEach(function (side, i) { showSafe(side, s.safes[i], s.dialSize); });
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-sc-phone"><div class="msg"></div>' + dialHtml() +
          '<button class="primary mi-big-btn try">🔓 TRY</button></div>';
        phone = { el: el, slot: mctx.slot, click: false };
        el.querySelector('.try').addEventListener('pointerdown', function () { mctx.send({ type: 'try' }); });
        // Drag round the dial: every 9° of turn is one number (sent in small batches).
        const dial = el.querySelector('.mi-sc-dial');
        let last = null;
        let carry = 0;
        function angle(e) {
          const r = dial.getBoundingClientRect();
          return (Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)) * 180) / Math.PI;
        }
        dial.addEventListener('pointerdown', function (e) { dial.setPointerCapture(e.pointerId); last = angle(e); carry = 0; });
        dial.addEventListener('pointermove', function (e) {
          if (last === null) return;
          const a = angle(e);
          let d = a - last;
          if (d > 180) d -= 360;
          if (d < -180) d += 360;
          last = a;
          carry += d;
          const steps = Math.trunc(carry / STEP_DEG);
          if (!steps) return;
          carry -= steps * STEP_DEG;
          mctx.send({ type: 'turn', by: Math.max(-10, Math.min(10, steps)) });
        });
        ['pointerup', 'pointercancel'].forEach(function (ev) { dial.addEventListener(ev, function () { last = null; }); });
        phone.vibrate = mctx.vibrate;
      },
      update: function (s) {
        if (!phone) return;
        showSafe(phone.el, s, s.dialSize);
        // The click you feel: a buzz each time the dial lands on your number.
        if (s.click && !phone.click) phone.vibrate(40);
        phone.click = s.click;
        const them = s.safes[1 - phone.slot].opened;
        phone.el.querySelector('.msg').innerHTML = (s.locked ? '<span class="mi-bad">Jammed!</span> · ' : '') + '🔓 ' + s.opened + ' / 3 · them ' + them;
      },
      unmount: function () { phone = null; },
    },
    pad: function (btn) {
      if (btn === 'A') return { type: 'try' };
      const by = { LEFT: -1, RIGHT: 1, LB: -5, RB: 5 }[btn];
      return by ? { type: 'turn', by: by } : null;
    },
    sounds: function (prev, s) {
      const out = [];
      if (s.safes.some(function (x, i) { return x.click && !prev.safes[i].click; })) out.push('lock');
      if (s.safes.some(function (x, i) { return x.opened > prev.safes[i].opened; })) out.push('correct');
      if (s.safes.some(function (x, i) { return x.locked && !prev.safes[i].locked; })) out.push('wrong');
      return out;
    },
  });
})();
