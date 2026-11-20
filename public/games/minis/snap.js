// SNAP! (server/games/minis/snap.js) Cards turn over on the TV: snap when one matches the card
// before it. The first good snap wins; a snap on the wrong card loses.
(function () {
  // Same as cardAt in server/games/minis/snap.js.
  function cardAt(t, stepMs, count) { return Math.max(0, Math.min(count - 1, Math.floor(t / stepMs))); }
  const RED = { '♥': true, '♦': true };

  function cardHtml(c, cls) {
    return '<div class="mi-card ' + (RED[c.suit] ? 'red' : 'black') + ' ' + (cls || '') + '"><b>' + c.rank + '</b><span>' + c.suit + '</span></div>';
  }

  /** The pile: the card before (to one side) and the card now, turning over each step. */
  function pile(el, mctx) {
    el.insertAdjacentHTML('beforeend', '<div class="mi-pile"></div>');
    const box = el.querySelector('.mi-pile');
    let state = null;
    let shown = -1;
    let raf = requestAnimationFrame(function frame() {
      raf = requestAnimationFrame(frame);
      if (!state) return;
      const i = cardAt(mctx.t(), state.stepMs, state.cards.length);
      if (i === shown) return;
      shown = i;
      box.innerHTML = (i > 0 ? cardHtml(state.cards[i - 1], 'under') : '') + cardHtml(state.cards[i], 'top flip');
    });
    return {
      update: function (s) { state = s; },
      stop: function () { cancelAnimationFrame(raf); },
    };
  }

  let parts = [];
  let marks = null;
  let players = null;

  function drawMarks(s) {
    if (!marks) return;
    marks.innerHTML = [0, 1].map(function (slot) {
      return '<div class="mi-snapper p' + (slot + 1) + '">' + ArkMini.nameOf({ players: players }, slot) + ' ' + ArkMini.mark(s.res[slot]) + '</div>';
    }).join('');
  }

  ArkMini.register('snap', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-snap"><div class="mi-snappers"></div></div>';
        marks = el.querySelector('.mi-snappers');
        players = mctx.players;
        parts = [pile(el.firstChild, mctx)];
      },
      update: function (s) { parts.forEach(function (p) { p.update(s); }); drawMarks(s); },
      unmount: function () { parts.forEach(function (p) { p.stop(); }); parts = []; marks = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-snap"><div class="slot"></div></div>';
        const stage = el.firstChild;
        parts = [pile(stage, mctx)];
        stage.insertAdjacentHTML('beforeend', '<button class="primary mi-big-btn">SNAP!</button>');
        stage.querySelector('button').addEventListener('pointerdown', function () { mctx.send({ type: 'snap' }); mctx.vibrate(25); });
        parts.slot = mctx.slot;
        parts.el = stage.querySelector('.slot');
      },
      update: function (s) {
        parts.forEach(function (p) { p.update(s); });
        if (parts.el) parts.el.innerHTML = ArkMini.mark(s.res[parts.slot]);
      },
      unmount: function () { parts.forEach(function (p) { p.stop(); }); parts = []; },
    },
    pad: function (btn) { return btn === 'A' || btn === 'B' || btn === 'X' || btn === 'Y' ? { type: 'snap' } : null; },
    sounds: function (prev, s) { return s.snaps.some(function (x, i) { return x !== null && prev.snaps[i] === null; }) ? ['lock'] : []; },
  });
})();
