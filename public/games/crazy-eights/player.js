// Crazy Eights on the phone (server/games/crazy-eights.js): your hand (the cards you can play
// lit up: tap one to play it), Draw (or take what you're owed), Pass after drawing, and the suit
// picker after an 8.
(function () {
  Ark.loadCss('/games/crazy-eights/style.css');
  let C = window.ArkCards || null;
  Ark.loadScript('/games/crazy-eights/cards.js').then(function () {
    C = window.ArkCards;
    lastKey = '';
    if (view && root) update(view);
  });

  let root = null;
  let api = null;
  let view = null;
  let lastKey = '';
  let buzzed = null; // the turn number we last buzzed for

  function onClick(e) {
    const card = e.target.closest('[data-card]');
    if (card && card.classList.contains('playable')) {
      api.send({ type: 'play', card: card.getAttribute('data-card') });
      api.vibrate(15);
      return;
    }
    const suit = e.target.closest('[data-suit]');
    if (suit) return api.send({ type: 'suit', suit: suit.getAttribute('data-suit') });
    if (e.target.closest('.ce-draw')) return api.send({ type: 'draw' });
    if (e.target.closest('.ce-pass')) return api.send({ type: 'pass' });
    if (e.target.closest('.rematch')) api.send({ type: 'rematch' });
  }

  function render(v) {
    const me = v.you;
    const mine = v.turn === me && (v.phase === 'play' || v.phase === 'suit');
    const score = '<div class="score">You ' + v.scores[me] + ' – ' + v.scores[1 - me] + ' Them' + (v.target ? ' · first to ' + v.target : '') + '</div>';
    if (v.phase === 'over') {
      const won = v.winner === me;
      return score + '<div class="ce-wait"><div class="outcome ' + (won ? 'won' : 'lost') + '">' + (won ? 'You win! 🏆' : 'You lose') + '</div>' +
        '<button class="primary rematch">Rematch</button></div>';
    }
    if (v.phase === 'handEnd') {
      const r = v.result;
      return score + '<div class="ce-wait"><div class="outcome ' + (r.winner === me ? 'won">You\'re out! +' : 'lost">They\'re out: +') + r.points + '</div><p>Next hand coming up…</p></div>';
    }
    if (v.phase === 'suit' && mine) {
      return score + '<p class="msg">Call the suit:</p><div class="ce-suits">' + ['S', 'H', 'D', 'C'].map(function (s) {
        return '<button data-suit="' + s + '" class="' + (s === 'H' || s === 'D' ? 'red' : 'black') + '">' + C.SYMBOL[s] + '<small>' + C.NAME[s] + '</small></button>';
      }).join('') + '</div>';
    }
    let msg;
    if (!mine) msg = v.phase === 'suit' ? 'They\'re calling the suit…' : 'Their turn…';
    else if (v.pending) msg = v.pendingKind === '2' && v.playable.length ? '<strong>+' + v.pending + '!</strong> Answer with a 2, or take them.' : '<strong>Take ' + v.pending + ' cards.</strong>';
    else if (v.drew) msg = v.playable.length ? 'Play the card you drew, or pass.' : 'No luck: pass.';
    else msg = v.playable.length ? '<strong>Your turn:</strong> play a lit card, or draw.' : '<strong>Your turn:</strong> nothing fits, draw one.';
    const follow = C.rank(v.top) !== '8' ? C.SYMBOL[C.suit(v.top)] + ' or ' + C.rank(v.top) : v.suit ? C.NAME[v.suit] : 'the suit being called';
    const buttons = mine && v.phase === 'play'
      ? '<div class="ce-buttons">' + (v.drew ? '<button class="ghost ce-pass">Pass</button>' : '<button class="primary ce-draw">' + (v.pending ? 'Take ' + v.pending : 'Draw') + '</button>') + '</div>'
      : '';
    return score +
      '<div class="ce-status"><div class="ce-mini">' + C.face(v.top, 'mini') + '</div><div><p class="msg">' + msg + '</p><p class="follow">Match ' + follow + ' · they hold ' + v.counts[1 - me] + '</p></div></div>' +
      '<div class="ce-hand">' + v.cards.map(function (c) {
        const ok = mine && v.playable.indexOf(c) !== -1;
        return C.face(c, (ok ? 'playable' : mine ? 'dim' : '') + (v.drew === c ? ' new' : ''), ' data-card="' + c + '" role="button"');
      }).join('') + '</div>' + buttons;
  }

  function update(v) {
    view = v;
    if (!C) return;
    // A buzz when it becomes your turn (once: drawing is still the same turn).
    if (v.turn === v.you && v.phase === 'play' && buzzed !== v.turns) {
      buzzed = v.turns;
      api.vibrate(30);
    }
    const key = JSON.stringify([v.phase, v.hand, v.top, v.suit, v.turn, v.counts, v.pending, v.drew, v.playable, v.scores]);
    if (key === lastKey) return;
    lastKey = key;
    root.innerHTML = render(v);
  }

  Ark.register('player', 'crazy-eights', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'ce-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
    },
    update: update,
    unmount: function () {
      root = view = null;
      lastKey = '';
      buzzed = null;
    },
  });
})();
