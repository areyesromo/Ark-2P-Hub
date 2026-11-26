// Higher or Lower (server/games/minis/higher-lower.js): a card shows, you each call the next one in
// secret, then it turns over. The TV shows the card, who has called (not what), and the streaks;
// phones have HIGHER and LOWER; controllers press ▲ / ▼.
(function () {
  const FACE = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  const face = function (r) { return FACE[r] || String(r); };
  // A suit for each card, from its place in the game (just for looks).
  const SUIT = ['♠', '♥', '♦', '♣'];

  function card(r, k, cls) {
    const s = SUIT[k % 4];
    const red = s === '♥' || s === '♦';
    return '<div class="mi-hl-card' + (red ? ' red' : '') + (cls ? ' ' + cls : '') + '"><b>' + face(r) + '</b><i>' + s + '</i></div>';
  }

  function callText(c) {
    return c === 'higher' ? '▲ Higher' : c === 'lower' ? '▼ Lower' : 'No call';
  }

  let host = null;
  let phone = null;

  function side(s, slot, players) {
    const show = s.stage === 'show' && s.last;
    let status;
    if (show) {
      const r = s.last.right[slot];
      status = '<span class="mi-hl-call ' + (r === null ? 'same' : r ? 'right' : 'wrong') + '">' + callText(s.last.picks[slot]) + (r === null ? ' · same!' : r ? ' ✓ +' + s.last.gained[slot] : ' ✗') + '</span>';
    } else status = s.picked[slot] ? '<span class="mi-hl-call locked">🔒 Called</span>' : '<span class="mi-hl-call">Thinking…</span>';
    return '<div class="mi-side mi-hl-side p' + (slot + 1) + '"><div class="who">' + ArkMini.nameOf({ players: players }, slot) + '</div>' +
      '<div class="mi-hl-pts">' + s.points[slot] + '</div><div class="mi-hl-streak">' + (s.streak[slot] ? '🔥 ' + s.streak[slot] + ' in a row' : '&nbsp;') + '</div>' + status + '</div>';
  }

  ArkMini.register('higher-lower', {
    host: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-hl-tv"></div>';
        host = { el: el.firstChild, players: mctx.players };
      },
      update: function (s) {
        if (!host) return;
        const show = s.stage === 'show' && s.last;
        const middle = show
          ? '<div class="mi-hl-pair">' + card(s.last.from, s.call - 2, 'old') + '<span class="mi-hl-arrow">' + (s.last.to > s.last.from ? '▲' : s.last.to < s.last.from ? '▼' : '=') + '</span>' + card(s.last.to, s.call - 1, 'turn') + '</div>'
          : '<div class="mi-hl-pair">' + card(s.card, s.call - 1, '') + '<div class="mi-hl-next">?</div></div>';
        host.el.innerHTML = side(s, 0, host.players) +
          '<div class="mi-hl-mid"><div class="mi-hl-count">Card ' + Math.min(s.call, s.calls) + ' of ' + s.calls + '</div>' + middle + '</div>' +
          side(s, 1, host.players);
      },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        el.innerHTML = '<div class="mi-phone-stage mi-hl-phone"><div class="mi-hl-head"></div><div class="mi-hl-show"></div>' +
          '<div class="mi-hl-btns"><button type="button" data-c="higher">▲<small>HIGHER</small></button><button type="button" data-c="lower">▼<small>LOWER</small></button></div></div>';
        phone = { el: el, slot: mctx.slot, s: null };
        el.querySelectorAll('[data-c]').forEach(function (b) {
          b.addEventListener('pointerdown', function (e) {
            e.preventDefault();
            if (!phone.s || phone.s.stage !== 'pick' || phone.s.mine) return;
            mctx.send({ type: 'pick', call: b.getAttribute('data-c') });
            mctx.vibrate(15);
          });
        });
      },
      update: function (s) {
        if (!phone) return;
        phone.s = s;
        const me = phone.slot;
        phone.el.querySelector('.mi-hl-head').innerHTML = '<span>You <b>' + s.points[me] + '</b>' + (s.streak[me] ? ' 🔥' + s.streak[me] : '') + '</span><span>Them <b>' + s.points[1 - me] + '</b></span>';
        const show = s.stage === 'show' && s.last;
        phone.el.querySelector('.mi-hl-show').innerHTML = show
          ? '<div class="mi-hl-pair">' + card(s.last.from, s.call - 2, 'old') + card(s.last.to, s.call - 1, 'turn') + '</div><p>' + (s.last.right[me] === null ? 'The same: no score' : s.last.right[me] ? '✓ Right! +' + s.last.gained[me] : '✗ ' + (s.last.picks[me] ? 'Wrong' : 'No call')) + '</p>'
          : '<div class="mi-hl-pair">' + card(s.card, s.call - 1, '') + '</div><p>' + (s.mine ? 'Called: ' + callText(s.mine) : 'Next card higher or lower?') + '</p>';
        phone.el.querySelectorAll('[data-c]').forEach(function (b) {
          b.disabled = s.stage !== 'pick' || !!s.mine;
          b.classList.toggle('on', s.mine === b.getAttribute('data-c'));
        });
      },
      unmount: function () { phone = null; },
    },
    pad: function (btn, s) {
      if (s.stage !== 'pick' || s.mine) return null;
      if (btn === 'UP' || btn === 'Y') return { type: 'pick', call: 'higher' };
      if (btn === 'DOWN' || btn === 'A') return { type: 'pick', call: 'lower' };
      return null;
    },
    sounds: function (prev, s) {
      if (s.stage === 'show' && prev.stage === 'pick') return ['reveal'];
      if (s.picked.filter(Boolean).length > prev.picked.filter(Boolean).length) return ['lock'];
      return [];
    },
  });
})();
