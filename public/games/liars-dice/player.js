(function () {
  Ark.loadCss('/games/liars-dice/style.css');
  Ark.loadCss('/shared/dice.css');
  const diceReady = Ark.loadScript('/shared/dice.js').then(function () { return Ark.loadScript('/games/liars-dice/howto.js'); });
  const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

  let root = null;
  let api = null;
  let view = null;
  let key = '';
  let pick = null; // { qty, face } being set up
  let step = 0; // the how-to-play example's step, flipped through with ◀ ▶

  function legal(v, b) {
    if (b.qty < 1 || b.qty > v.total || b.face < (v.wild ? 2 : 1) || b.face > 6) return false;
    return !v.bid || b.qty > v.bid.qty || (b.qty === v.bid.qty && b.face > v.bid.face);
  }

  /** The smallest bid that beats the current one. */
  function nextBid(v) {
    const low = v.wild ? 2 : 1;
    if (!v.bid) return { qty: 1, face: low };
    return v.bid.face < 6 ? { qty: v.bid.qty, face: v.bid.face + 1 } : { qty: v.bid.qty + 1, face: low };
  }

  function bidText(b) {
    return (WORDS[b.qty] || b.qty) + ' ' + ArkDice.html(b.face) + (b.qty === 1 ? '' : 's');
  }

  function howto(v) {
    // The example's two players (the TV shows the real names).
    const shown = [0, 1].map(function (s) { return '<span class="p' + (s + 1) + '-text">Player ' + (s + 1) + '</span>'; });
    const last = ArkLD.steps('', '').length - 1;
    return ArkLD.demoHtml(step, shown) +
      '<div class="ld-demo-nav"><button class="ghost" data-step="-1"' + (step === 0 ? ' disabled' : '') + '>◀</button><span>' + (step + 1) + ' / ' + (last + 1) + '</span><button class="ghost" data-step="1"' + (step === last ? ' disabled' : '') + '>▶</button></div>' +
      (v.ready[v.you] ? '<p class="ld-info">✅ Ready · waiting for ' + (v.ready[1 - v.you] ? '…' : 'them') + '</p>' : '<button class="primary ld-ready">Got it, let\'s play</button>');
  }

  /** In plain words: what a bid claims, what you hold, and the odds it's true. */
  function explain(v, b, theirs) {
    const o = ArkLD.odds(v, b);
    const what = (theirs ? 'They say' : 'You\'d say') + ': at least <b>' + b.qty + '</b> ' + ArkDice.html(b.face) + ' among all ' + v.total + ' dice.';
    const have = 'You have ' + o.mine + (v.wild && b.face !== 1 ? ' (with wild 1s)' : '') + (o.need > 0 ? ', so ' + o.need + ' more must be in their ' + o.n + '.' : ': that\'s already enough!');
    return '<div class="ld-explain">' + what + ' ' + have + ' Chance it\'s true: ' + ArkLD.chanceWords(o.chance) + '</div>';
  }

  function render(v) {
    view = v;
    if (!window.ArkLD || !root) return;
    if (v.phase === 'howto') {
      key = '';
      root.innerHTML = howto(v);
      return;
    }
    const mine = v.you;
    const myTurn = v.phase === 'bidding' && v.turn === mine;
    if (!myTurn) pick = null;
    else if (!pick || !legal(v, pick)) pick = nextBid(v);
    const k = JSON.stringify([v.phase, v.mine, v.bid, v.result, v.turn, v.counts, pick]);
    if (k === key) return;
    key = k;
    let html = '';
    html += '<div class="ld-mine">' + (v.mine || []).map(function (d) { return ArkDice.html(d, v.wild && d === 1 ? 'wild' : ''); }).join('') + '</div>';
    html += '<p class="ld-info">Your dice · rival has ' + v.counts[1 - mine] + ' · ' + v.total + ' dice in play' + (v.wild ? ' · ones are wild' : '') + '</p>';
    if (v.phase === 'bidding') {
      html += '<div class="ld-current">' + (v.bid ? (v.bid.by === mine ? 'You bid ' : 'They bid ') + bidText(v.bid) : 'No bid yet') + '</div>';
      if (myTurn && v.bid) html += explain(v, v.bid, true);
      if (myTurn) {
        let faces = '';
        for (let f = v.wild ? 2 : 1; f <= 6; f++) faces += '<button class="face' + (pick.face === f ? ' on' : '') + '" data-face="' + f + '">' + ArkDice.html(f) + '</button>';
        html += '<div class="ld-qty"><button class="ghost" data-qty="-1">−</button><span>' + pick.qty + '</span><button class="ghost" data-qty="1">+</button></div>' +
          '<div class="ld-faces">' + faces + '</div>' +
          '<p class="ld-hint">Raise: more dice, or the same number of a higher face</p>' +
          '<button class="primary ld-bid"' + (legal(v, pick) ? '' : ' disabled') + '>Bid ' + bidText(pick) + '</button>' + explain(v, pick, false) +
          (v.bid && v.bid.by !== mine ? '<button class="ld-liar">Liar!</button>' : '');
      } else {
        html += '<p class="ld-info">Their turn…</p>';
      }
    } else if (v.result) {
      const r = v.result;
      html += '<div class="ld-current">' + (r.loser === mine ? '😬 You lose a die' : '😎 They lose a die') + '</div>' +
        '<p class="ld-info">There ' + (r.actual === 1 ? 'was' : 'were') + ' ' + r.actual + ' for a bid of ' + bidText(r.bid) + '</p>';
      if (v.phase === 'over') html += '<div class="ld-current big">' + (v.winner === mine ? 'You win! 🏆' : 'You lose') + '</div><button class="primary ld-rematch">Rematch</button>';
    }
    root.innerHTML = html;
  }

  Ark.register('player', 'liars-dice', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'ld-phone';
      el.appendChild(root);
      root.addEventListener('click', function (e) {
        const b = e.target.closest('button');
        if (!b || b.disabled || !view) return;
        if (b.hasAttribute('data-step')) step = Math.max(0, step + Number(b.getAttribute('data-step')));
        else if (b.classList.contains('ld-ready')) { api.send({ type: 'ready' }); return; }
        else if (b.hasAttribute('data-qty')) pick.qty = Math.max(1, Math.min(view.total, pick.qty + Number(b.getAttribute('data-qty'))));
        else if (b.hasAttribute('data-face')) pick.face = Number(b.getAttribute('data-face'));
        else if (b.classList.contains('ld-bid')) { api.send({ type: 'bid', qty: pick.qty, face: pick.face }); api.vibrate(20); return; }
        else if (b.classList.contains('ld-liar')) { api.send({ type: 'liar' }); api.vibrate([40, 30, 40]); return; }
        else if (b.classList.contains('ld-rematch')) return api.send({ type: 'rematch' });
        key = '';
        render(view);
      });
      diceReady.then(function () { if (view) { key = ''; render(view); } });
    },
    update: function (v) {
      // Keep the bid being set up unless it's no longer legal.
      render(v);
    },
    unmount: function () { root = view = pick = null; key = ''; },
  });
})();
