// Bridge Builder (server/games/minis/bridge-builder.js): a bridge on a post, crates on either side.
// The same scene on the TV and the phones: the bridge leans as crates go on; when it's full the cart
// rolls over and it tips to the heavier side. Phones tap a spot (the ones that would tip it are
// marked); controllers pick a spot with ◀ ▶ and place with A.
(function () {
  const cursors = [3, 4];
  const MAX_TILT = 9; // degrees at the limit
  const TIPPED = 24;

  function tilt(s) {
    if (s.phase === 'roundEnd' && s.result && s.result.loser !== null) return s.result.loser === 0 ? -TIPPED : TIPPED;
    return Math.max(-1, Math.min(1, s.lean / s.limit)) * MAX_TILT;
  }

  function crate(w, extra) {
    return '<span class="mi-crate w' + w + (extra ? ' ' + extra : '') + '"><b>' + w + '</b></span>';
  }

  /** The scene: cliffs, the post, the bridge with its spots and crates, the cart. */
  function scene(s, opts) {
    opts = opts || {};
    let spots = '';
    s.spots.forEach(function (pos, i) {
      const w = s.placed[i];
      const isNew = s.last && s.last.spot === i;
      const tips = opts.marks && !w && Math.abs(s.lean + s.crates[s.n] * pos) > s.limit;
      spots += '<span class="mi-spot' + (pos < 0 ? ' l' : ' r') + (opts.cursor === i ? ' cur p' + (opts.cursorSlot + 1) : '') + (tips ? ' tips' : '') + '"' +
        (opts.buttons && !w ? ' data-spot="' + i + '"' : '') + '>' + (w ? crate(w, isNew ? 'drop' : '') : tips ? '<i>✖</i>' : '') + '</span>';
      if (i === 3) spots += '<span class="mi-hub"></span>';
    });
    const cart = s.phase === 'cart' ? '<span class="mi-cart" style="animation-duration:' + s.cartMs + 'ms">🛒</span>' : '';
    return '<div class="mi-bridge-scene' + (s.phase === 'roundEnd' ? ' over' : '') + '">' +
      '<span class="mi-cliff l"></span><span class="mi-cliff r"></span><span class="mi-water"></span>' +
      '<span class="mi-post"></span>' +
      '<div class="mi-beam" style="--tilt:' + tilt(s) + 'deg"><span class="mi-plank"></span><div class="mi-spots">' + spots + '</div>' + cart + '</div>' +
      '</div>';
  }

  function queue(s) {
    if (s.phase !== 'place') return '';
    const next = s.crates[s.n + 1];
    return '<div class="mi-queue"><span>Now</span>' + crate(s.crates[s.n], 'now') + (next ? '<span>then</span>' + crate(next, 'next') : '') + '</div>';
  }

  /** The lean as a meter: the needle between the two limits. */
  function meter(s) {
    const pct = 50 + Math.max(-1, Math.min(1, s.lean / s.limit)) * 50;
    return '<div class="mi-lean"><span class="end l">P1 side</span><div class="bar"><i style="left:' + pct + '%"></i></div><span class="end r">P2 side</span></div>';
  }

  function wins(s, slot) {
    return '<span class="mi-dots">' + [0, 1].map(function (i) { return '<i class="' + (i < s.wins[slot] ? 'on' : '') + '"></i>'; }).join('') + '</span>';
  }

  function status(s, players, you) {
    const name = function (slot) { return you === undefined ? ArkMini.nameOf({ players: players }, slot) : slot === you ? 'You' : 'They'; };
    if (s.phase === 'cart') return 'The cart rolls over…';
    if (s.phase === 'roundEnd' && s.result) {
      if (s.result.loser === null) return 'Dead level! Nobody takes it';
      if (s.result.how === 'tip') return name(s.result.loser) + ' tipped it!';
      return 'It tips to ' + (you === undefined ? ArkMini.nameOf({ players: players }, s.result.loser) + "'s" : s.result.loser === you ? 'your' : 'their') + ' side';
    }
    return '<span>' + (you === undefined ? name(s.turn) + "'s turn" : s.turn === you ? '<b>Your turn:</b> place the crate' : 'Their turn…') + '</span>' +
      '<span class="mi-turnbar"><i style="animation-duration:' + s.turnLeftMs + 'ms"></i></span>';
  }

  let host = null;
  let phone = null;

  function drawHost() {
    if (!host || !host.s) return;
    const s = host.s;
    const p = host.players[s.turn];
    const local = s.phase === 'place' && p && p.local && !p.bot;
    host.el.innerHTML = '<div class="mi-bridge">' +
      '<div class="mi-bridge-top"><span class="p1">' + ArkMini.nameOf({ players: host.players }, 0) + wins(s, 0) + '</span>' +
      '<span class="mi-bridge-say">' + status(s, host.players) + '</span>' +
      '<span class="p2">' + wins(s, 1) + ArkMini.nameOf({ players: host.players }, 1) + '</span></div>' +
      queue(s) + scene(s, { cursor: local ? cursors[s.turn] : null, cursorSlot: s.turn }) + meter(s) + '</div>';
  }

  ArkMini.register('bridge-builder', {
    host: {
      mount: function (el, mctx) { host = { el: el, players: mctx.players, s: null }; },
      update: function (s) { if (host) { host.s = s; drawHost(); } },
      unmount: function () { host = null; },
    },
    phone: {
      mount: function (el, mctx) {
        phone = { el: el, slot: mctx.slot, players: mctx.players };
        el.addEventListener('click', function (e) {
          const b = e.target.closest('[data-spot]');
          if (!b || !phone || !phone.s || phone.s.turn !== phone.slot || phone.s.phase !== 'place') return;
          mctx.send({ type: 'place', spot: Number(b.getAttribute('data-spot')) });
          mctx.vibrate(15);
          b.classList.add('chosen');
        });
      },
      update: function (s) {
        if (!phone) return;
        phone.s = s;
        const mine = s.phase === 'place' && s.turn === phone.slot;
        phone.el.innerHTML = '<div class="mi-phone-stage mi-bridge phone">' +
          '<div class="mi-bridge-top"><span>You ' + wins(s, phone.slot) + '</span><span>Them ' + wins(s, 1 - phone.slot) + '</span></div>' +
          '<p class="mi-bridge-say">' + status(s, phone.players, phone.slot) + '</p>' + queue(s) +
          scene(s, { buttons: mine, marks: mine }) + meter(s) +
          '<p class="muted">Your side is the ' + (phone.slot === 0 ? 'left' : 'right') + '. Lean it their way, but don\'t tip it!</p></div>';
      },
      unmount: function () { phone = null; },
    },
    pad: function (btn, s, slot) {
      if (s.phase !== 'place' || s.turn !== slot) return null;
      if (btn === 'A') return s.placed[cursors[slot]] ? null : { type: 'place', spot: cursors[slot] };
      if (btn === 'LEFT' || btn === 'RIGHT') {
        let c = cursors[slot];
        do { c += btn === 'LEFT' ? -1 : 1; } while (c >= 0 && c < s.spots.length && s.placed[c]);
        if (c >= 0 && c < s.spots.length) cursors[slot] = c;
        drawHost();
      }
      return null;
    },
    sounds: function (prev, s) {
      if (s.phase === 'roundEnd' && prev.phase !== 'roundEnd') return [s.result && s.result.how === 'tip' ? 'crash' : s.result && s.result.loser === null ? 'close' : 'splash'];
      if (s.phase === 'cart' && prev.phase !== 'cart') return ['whoosh'];
      return s.n > prev.n ? ['drop'] : [];
    },
  });
})();
