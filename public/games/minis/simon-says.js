// Simon Says (server/games/minis/simon-says.js): press the colour only when Simon says so.
// Phones tap a colour; controllers press its button (A green, B red, X blue, Y yellow).
(function () {
  const COLORS = ['green', 'red', 'blue', 'yellow'];
  const BTN = { green: 'A', red: 'B', blue: 'X', yellow: 'Y' };
  const ANSWER = { right: '<b class="mi-ok">✔ +1</b>', wrong: '<b class="mi-bad">✖ wrong colour</b>', trap: '<b class="mi-bad">🙊 Simon didn\'t say!</b>' };

  function card(s) {
    const o = s.order;
    if (!o) return '<div class="mi-simon-card"><span class="says">Get ready…</span></div>';
    return '<div class="mi-simon-card ' + o.color + (o.done ? ' done' : '') + '">' +
      '<span class="says">' + (o.simon ? 'Simon says' : '&nbsp;') + '</span>' +
      '<span class="word">' + o.color.toUpperCase() + '!</span></div>';
  }

  let host = null;
  let phone = null;

  ArkMini.register('simon-says', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-simon">' +
          [0, 1].map(function (p) { return '<div class="mi-side p' + (p + 1) + '"><div class="who">' + ArkMini.nameOf({ players: mctx.players }, p) + '</div><div class="pts"></div><div class="ans"></div></div>'; }).join('') +
          '<div class="mid"></div></div>';
        host = { el: el };
      },
      update: function (s) {
        if (!host) return;
        host.el.querySelector('.mid').innerHTML = card(s);
        host.el.querySelectorAll('.mi-side').forEach(function (side, p) {
          side.querySelector('.pts').textContent = s.points[p];
          side.querySelector('.ans').innerHTML = s.answers[p] ? ANSWER[s.answers[p]] : '';
        });
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-simon-phone"><div class="top"></div><div class="msg"></div><div class="pads">' +
          COLORS.map(function (c) { return '<button class="pad ' + c + '" data-c="' + c + '">' + BTN[c] + '</button>'; }).join('') + '</div></div>';
        phone = { el: el, slot: mctx.slot };
        el.addEventListener('pointerdown', function (e) {
          const b = e.target.closest('[data-c]');
          if (!b) return;
          mctx.send({ type: 'press', color: b.getAttribute('data-c') });
          mctx.vibrate(12);
        });
      },
      update: function (s) {
        if (!phone) return;
        const p = phone.slot;
        phone.el.querySelector('.top').innerHTML = card(s);
        phone.el.querySelector('.msg').innerHTML = (s.answers[p] ? ANSWER[s.answers[p]] + ' · ' : '') + s.points[p] + ' · them ' + s.points[1 - p];
      },
      unmount: function () { phone = null; },
    },
    pad: function (btn) {
      const c = { A: 'green', B: 'red', X: 'blue', Y: 'yellow' }[btn];
      return c ? { type: 'press', color: c } : null;
    },
    sounds: function (prev, s) {
      const out = [];
      if (s.order && !s.order.done && (!prev.order || prev.order.id !== s.order.id)) out.push('tick');
      s.answers.forEach(function (a, i) {
        if (a && !prev.answers[i]) out.push(a === 'right' ? 'correct' : 'wrong');
      });
      return out;
    },
  });
})();
