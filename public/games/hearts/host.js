(function () {
  Ark.loadCss('/games/blackjack/style.css');
  Ark.loadCss('/games/spades/style.css'); // (Spades' table)
  Ark.loadCss('/games/hearts/style.css');
  const ready = Ark.loadScript('/games/blackjack/table.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;

  // The clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);
  function ticking() {
    tick = setInterval(function () {
      if (root) root.querySelectorAll('.spd-secs').forEach(function (c) { c.textContent = secsLeft() + 's'; });
    }, 250);
  }

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function seat(v, slot) {
    let backs = '';
    for (let k = 0; k < v.handCounts[slot]; k++) backs += ArkBJ.card(null);
    const status = v.phase === 'draw' ? (v.turn === slot ? 'Drawing…' : '') : v.turn === slot ? 'To play' : '';
    const taken = v.taken[slot].slice().sort(function (a, b) { return (b === 'QS') - (a === 'QS'); });
    const pts = v.taken[slot].reduce(function (t, c) { return t + (c === 'QS' ? 13 : c.slice(-1) === 'H' ? 1 : 0); }, 0);
    return '<section class="spd-seat p' + (slot + 1) + (v.turn === slot ? ' turn' : '') + '">' +
      '<header>' + nameOf(v, slot) + (v.dealer === slot ? ' <span class="spd-dealer">Dealer</span>' : '') + '<span class="spd-score">' + v.scores[slot] + '</span></header>' +
      '<div class="spd-sub">points</div>' +
      '<div class="spd-backs">' + backs + '</div>' +
      '<div class="hrt-taken">' + (taken.length ? taken.map(function (c) { return ArkBJ.card(c); }).join('') : '') + '</div>' +
      '<div class="spd-bid">' + (v.phase === 'draw' ? '' : 'This hand <b>' + pts + '</b>') + '</div>' +
      '<footer>' + status + (status && v.timed && v.timeLeftMs ? ' · ⏱ <span class="spd-secs">' + secsLeft() + 's</span>' : '') + '</footer></section>';
  }

  function middle(v) {
    if (v.phase === 'draw') return '<div class="spd-pack">' + ArkBJ.card(null) + '<b>' + v.pack + '</b><small>Drawing your hands: keep a card, or take the next</small></div>';
    if (v.phase === 'handEnd' || v.phase === 'over') {
      const r = v.result;
      return '<div class="spd-sum">' + [0, 1].map(function (s) {
        return '<div>' + nameOf(v, s) + ' takes <b>' + r.points[s] + (r.points[s] === 1 ? ' point' : ' points') + '</b></div>';
      }).join('') + (v.phase === 'over' ? '<span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins</span>' : '') + '</div>';
    }
    const cards = v.phase === 'trick' && v.lastTrick ? v.lastTrick.cards : v.trick;
    return '<div class="spd-trick">' + cards.map(function (t) { return '<div class="spd-play p' + (t.by + 1) + '">' + ArkBJ.card(t.card) + '</div>'; }).join('') + '</div>' +
      (v.phase === 'trick' && v.lastTrick ? '<div class="spd-note">' + nameOf(v, v.lastTrick.winner) + ' takes it</div>' : '<div class="spd-note">' + (v.broken ? '♥ Hearts are broken' : '♥ Hearts not broken yet: no leading them') + '</div>');
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    root.innerHTML = '<div class="spd-head">Hand <strong>' + v.deal + '</strong> · ♥ 1 point, Q♠ 13 · at <strong>' + v.target + '</strong> the lower score wins (or after ' + v.maxHands + ' hands)</div>' +
      '<div class="spd-table">' + seat(v, 0) + '<div class="spd-middle">' + middle(v) + '</div>' + seat(v, 1) + '</div>';
  }

  Ark.register('host', 'hearts', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return ['fanfare'];
      if (v.phase === 'trick' && prev.phase !== 'trick') return [v.lastTrick.cards.some(function (t) { return t.card === 'QS'; }) ? 'boom' : 'point'];
      if (v.n > prev.n) return ['knock'];
      return [];
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'spd-host';
      el.appendChild(root);
      ticking();
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) { view = v; gotAt = Date.now(); render(); },
    unmount: function () { clearInterval(tick); root = view = null; },
  });
})();
