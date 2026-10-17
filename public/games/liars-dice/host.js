(function () {
  Ark.loadCss('/games/liars-dice/style.css');
  Ark.loadCss('/shared/dice.css');
  const diceReady = Ark.loadScript('/shared/dice.js');
  const esc = Ark.escapeHtml;
  const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

  let root = null;
  let view = null;
  let key = '';

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  /** "four 5s" with a die picture. */
  function bidHtml(b) {
    return '<strong>' + (WORDS[b.qty] || b.qty) + '</strong> ' + ArkDice.html(b.face) + (b.qty === 1 ? '' : '<span class="s">s</span>');
  }

  function side(v, slot) {
    const r = v.result;
    let dice = '';
    if (v.hands) {
      dice = v.hands[slot].map(function (d) {
        const match = r && (d === r.bid.face || (v.wild && d === 1));
        return ArkDice.html(d, match ? (d === 1 && r.bid.face !== 1 ? 'wild' : 'match') : '');
      }).join('');
    } else {
      for (let k = 0; k < v.counts[slot]; k++) dice += ArkDice.html(0);
    }
    return '<div class="ld-side p' + (slot + 1) + (v.turn === slot && v.phase === 'bidding' ? ' active' : '') + '">' +
      '<div class="name">' + nameOf(v, slot) + ' <span class="muted">· ' + v.counts[slot] + ' dice</span></div><div class="cup">' + dice + '</div></div>';
  }

  function middle(v) {
    if (v.phase === 'needPhones') return '<div class="title">📱 Liar\'s Dice needs two phones</div><p>Your dice are secret, so each of you needs a phone.</p>';
    if (v.phase === 'bidding') {
      return (v.bid ? '<div class="sub">' + nameOf(v, v.bid.by) + ' bids</div><div class="bid">' + bidHtml(v.bid) + '</div>' : '<div class="sub">Round ' + v.round + ': opening bid</div>') +
        '<div class="sub">' + nameOf(v, v.turn) + (v.bid ? ': raise, or call <strong>Liar!</strong>' : ' bids first') + '</div>';
    }
    const r = v.result;
    const call = nameOf(v, r.caller) + ' called <strong>Liar!</strong> on ' + bidHtml(r.bid);
    const truth = 'There ' + (r.actual === 1 ? 'is' : 'are') + ' <strong>' + r.actual + '</strong>' + (v.wild ? ' (ones are wild)' : '');
    const out = v.phase === 'over'
      ? '<div class="title">🏆 ' + nameOf(v, v.winner) + ' wins!</div>'
      : '<div class="sub">' + nameOf(v, r.loser) + ' loses a die</div>';
    return '<div class="sub">' + call + '</div><div class="sub">' + truth + '</div>' + out +
      (v.phase === 'over' ? '<p class="muted">Rematch on a phone (or ⚙ change the settings).</p>' : '');
  }

  function render(v) {
    view = v;
    if (!window.ArkDice || !root) return;
    const k = JSON.stringify([v.phase, v.counts, v.bid, v.result, v.turn]);
    if (k === key) return;
    key = k;
    root.innerHTML = v.phase === 'needPhones' ? '<div class="ld-mid">' + middle(v) + '</div>'
      : side(v, 0) + '<div class="ld-mid">' + middle(v) + '<div class="ld-bids">' + v.bids.map(function (b) {
        return '<span class="p' + (b.by + 1) + '">' + bidHtml(b) + '</span>';
      }).join('') + '</div></div>' + side(v, 1);
  }

  Ark.register('host', 'liars-dice', {
    sounds: function (prev, v) {
      if (v.bids.length > prev.bids.length) return ['lock'];
      if ((v.phase === 'reveal' || v.phase === 'over') && prev.phase === 'bidding') return ['reveal'];
      return [];
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'ld-host';
      el.appendChild(root);
      diceReady.then(function () { if (view) { key = ''; render(view); } });
    },
    update: render,
    unmount: function () { root = view = null; key = ''; },
  });
})();
