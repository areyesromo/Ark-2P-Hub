(function () {
  Ark.loadCss('/games/liars-dice/style.css');
  Ark.loadCss('/shared/dice.css');
  const diceReady = Ark.loadScript('/shared/dice.js');
  const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

  let root = null;
  let api = null;
  let view = null;
  let key = '';
  let pick = null; // { qty, face } being set up

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

  function render(v) {
    view = v;
    if (!window.ArkDice || !root) return;
    const mine = v.you;
    const myTurn = v.phase === 'bidding' && v.turn === mine;
    if (!myTurn) pick = null;
    else if (!pick || !legal(v, pick)) pick = nextBid(v);
    const k = JSON.stringify([v.phase, v.mine, v.bid, v.result, v.turn, v.counts, pick]);
    if (k === key) return;
    key = k;
    let html = '';
    if (v.phase === 'needPhones') {
      root.innerHTML = '<p class="ld-msg">Liar\'s Dice needs two phones: your dice are secret.</p>';
      return;
    }
    html += '<div class="ld-mine">' + (v.mine || []).map(function (d) { return ArkDice.html(d, v.wild && d === 1 ? 'wild' : ''); }).join('') + '</div>';
    html += '<p class="ld-info">Your dice (hidden from ' + (v.counts[1 - mine]) + '-dice rival) · ' + v.total + ' dice in play' + (v.wild ? ' · ones are wild' : '') + '</p>';
    if (v.phase === 'bidding') {
      html += '<div class="ld-current">' + (v.bid ? (v.bid.by === mine ? 'You bid ' : 'They bid ') + bidText(v.bid) : 'No bid yet') + '</div>';
      if (myTurn) {
        let faces = '';
        for (let f = v.wild ? 2 : 1; f <= 6; f++) faces += '<button class="face' + (pick.face === f ? ' on' : '') + '" data-face="' + f + '">' + ArkDice.html(f) + '</button>';
        html += '<div class="ld-qty"><button class="ghost" data-qty="-1">−</button><span>' + pick.qty + '</span><button class="ghost" data-qty="1">+</button></div>' +
          '<div class="ld-faces">' + faces + '</div>' +
          '<button class="primary ld-bid"' + (legal(v, pick) ? '' : ' disabled') + '>Bid ' + bidText(pick) + '</button>' +
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
        if (b.hasAttribute('data-qty')) pick.qty = Math.max(1, Math.min(view.total, pick.qty + Number(b.getAttribute('data-qty'))));
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
