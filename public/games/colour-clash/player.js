(function () {
  Ark.loadCss('/games/colour-clash/style.css');
  const ready = Ark.loadScript('/games/colour-clash/cards.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let picking = null; // a wild waiting for its colour
  let calling = false; // CLASH! pressed for the next card
  let buzzed = '';

  function send(input) {
    if (view && view.cards.length === 2 && input.type === 'play') input.call = calling;
    api.send(input);
    api.vibrate(15);
    calling = false;
  }

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    if (e.target.closest('.cc-catch')) { api.send({ type: 'catch' }); api.vibrate([40, 30, 40]); return; }
    if (e.target.closest('.cc-call')) {
      if (v.uncalled === v.you) { api.send({ type: 'call' }); api.vibrate(30); return; }
      calling = !calling;
      return render();
    }
    const col = e.target.closest('[data-colour]');
    if (col && picking) {
      send({ type: 'play', card: picking, colour: col.getAttribute('data-colour') });
      picking = null;
      return render();
    }
    if (e.target.closest('.cc-cancel')) { picking = null; return render(); }
    const mine = v.turn === v.you;
    if (col && v.phase === 'colour' && mine) { send({ type: 'colour', colour: col.getAttribute('data-colour') }); return; }
    if (!mine) return;
    if (e.target.closest('.cc-draw') && v.phase === 'play') { send({ type: 'draw' }); return; }
    if (e.target.closest('.cc-keep') && v.phase === 'drawn') { send({ type: 'keep' }); return; }
    const c = e.target.closest('[data-card]');
    if (c) {
      const card = c.getAttribute('data-card');
      if (!v.playable.includes(card)) return api.vibrate([20, 30, 20]);
      if (ArkCC.isWild(card)) { picking = card; return render(); }
      c.classList.add('going');
      send({ type: 'play', card: card });
    }
  }

  function picker(title) {
    return '<div class="cc-pick"><p>' + title + '</p><div class="cc-colours">' + ['R', 'G', 'B', 'Y'].map(function (k) {
      return '<button class="cc-colour c' + k + '" data-colour="' + k + '">' + ArkCC.SHAPE[k] + '<small>' + ArkCC.NAME[k] + '</small></button>';
    }).join('') + '</div>' + (picking ? '<button class="cc-cancel">Back</button>' : '') + '</div>';
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'over') return v.winner === me ? '<span class="won big ark-result">You win! 🏆</span>' : '<span class="lost big ark-result">You lose</span>';
    if (v.phase === 'handEnd') {
      const r = v.result;
      return (r.winner === me ? '<span class="won">You win the hand! +' : '<span class="lost">They win the hand: +') + r.points + '</span>' + (r.blocked ? ' <small>(nobody could play: fewer points)</small>' : '');
    }
    if (v.turn !== me) return 'Their turn…';
    if (v.phase === 'colour') return '<strong>Pick the colour</strong>';
    if (v.phase === 'drawn') return 'It fits! Play it or keep it';
    return v.playable.length ? '<strong>Your turn!</strong> Play a card' : '<strong>Nothing fits:</strong> draw one';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.turn === me && (v.phase === 'play' || v.phase === 'drawn');
    const order = { R: 0, G: 1, B: 2, Y: 3, W: 4 };
    const hand = v.cards.slice().sort(function (a, b) { return order[a[0]] - order[b[0]] || a.localeCompare(b); });
    let html = '<div class="cc-top"><span>You <b>' + v.scores[me] + '</b> · Them <b>' + v.scores[1 - me] + '</b>' + (v.target ? ' <small>to ' + v.target + '</small>' : '') + '</span>' +
      '<span class="cc-them">' + ArkCC.card(null, 'mini') + '× ' + v.counts[1 - me] + '</span></div>' +
      '<p class="cc-msg">' + message(v) + (v.timed && v.timeLeftMs && v.turn === me && v.phase !== 'handEnd' && v.phase !== 'over' ? ' <small>' + Math.ceil(v.timeLeftMs / 1000) + 's</small>' : '') + '</p>';
    if (v.uncalled === 1 - me) html += '<button class="cc-catch">They didn\'t say CLASH! Catch them!</button>';
    if (v.phase === 'over') return void (root.innerHTML = html + '<button class="primary rematch">Rematch</button>');
    html += '<div class="cc-table"><div class="cc-pile">' + ArkCC.card(v.top, 'top') + ArkCC.colourChip(v.colour) + '</div>' +
      '<button class="cc-draw"' + (mine && v.phase === 'play' ? '' : ' disabled') + '>' + ArkCC.card(null) + '<small>Draw · ' + v.stock + '</small></button></div>';
    if (picking) html += picker('Wild! Pick the colour');
    else if (v.phase === 'colour' && v.turn === me) html += picker('Pick the colour');
    html += '<div class="cc-hand">' + hand.map(function (c) {
      const can = mine && v.playable.includes(c);
      return ArkCC.card(c, (can ? 'can' : mine ? 'dim' : '') + (c === v.drawn ? ' drawn' : ''), ' data-card="' + c + '"');
    }).join('') + '</div>';
    const showCall = (mine && v.cards.length === 2) || v.uncalled === me;
    html += '<div class="cc-btns">' + (showCall ? '<button class="cc-call' + (calling || v.uncalled === me ? ' on' : '') + '">' + (v.uncalled === me ? 'Say CLASH! now!' : calling ? 'CLASH! ✓' : 'Say CLASH!') + '</button>' : '') +
      (v.phase === 'drawn' && v.turn === me ? '<button class="cc-keep">Keep it</button>' : '') + '</div>';
    root.innerHTML = html;
  }

  Ark.register('player', 'colour-clash', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'cc-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (picking && !v.playable.includes(picking)) picking = null;
      if (prev && v.turn === v.you && prev.turn !== v.you && v.phase === 'play') api.vibrate(40);
      if (prev && v.uncalled === 1 - v.you && prev.uncalled !== 1 - v.you) api.vibrate([30, 30, 30]);
      if ((v.phase === 'handEnd' || v.phase === 'over') && buzzed !== v.hand + v.phase) {
        buzzed = v.hand + v.phase;
        api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200);
      }
      render();
    },
    unmount: function () {
      root = view = null;
      picking = null;
      calling = false;
      buzzed = '';
    },
  });
})();
