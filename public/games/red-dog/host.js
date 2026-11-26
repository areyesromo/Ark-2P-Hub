(function () {
  // The cards are Blackjack's.
  Ark.loadCss('/games/blackjack/style.css');
  Ark.loadCss('/games/red-dog/style.css');
  const ready = Ark.loadScript('/games/blackjack/table.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;

  // The clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  const PAYS = { 5: '5 to 1', 4: '4 to 1', 2: '2 to 1', 1: 'evens' };
  const RAISE = ['Stays', 'Raises one', 'Raises two'];
  const signed = (n) => (n > 0 ? '+' + n : n < 0 ? '−' + -n : '±0');

  function spreadLine(v) {
    if (v.phase === 'over') return '';
    if (v.spread < 0) return 'A pair: three of a kind pays 11 to 1';
    if (v.spread === 0) return 'Next to each other: no bet, antes back';
    let line = 'Spread ' + v.spread + ' · pays ' + PAYS[v.pays];
    if (v.phase === 'raise') line += ' · ' + v.inside + ' of ' + v.packLeft + ' cards left fall inside';
    return line;
  }

  function seat(v, slot) {
    const r = v.result;
    let state = '';
    if (v.phase === 'raise') {
      const p = v.players[slot];
      state = v.locked[slot] ? '🔒 Decided' : 'Thinking…' + (p.local && !p.bot ? ' <small>B stay · A raise one · Y raise two</small>' : '');
    } else if (r) {
      const raise = r.raises[slot];
      state = (raise === 'fold' ? 'Out of time: folded' : raise === null ? '' : RAISE[raise]) +
        ' <b class="' + (r.change[slot] > 0 ? 'up' : r.change[slot] < 0 ? 'down' : '') + '">' + signed(r.change[slot]) + '</b>';
    }
    const lead = v.phase === 'over' && v.winner === slot;
    return '<div class="rd-seat p' + (slot + 1) + (lead ? ' won' : '') + '"><header>' + nameOf(v, slot) + '<span>' + v.chips[slot].toLocaleString() + ' chips</span></header>' +
      '<div class="rd-state">' + state + '</div></div>';
  }

  function caption(v) {
    if (v.phase === 'over') {
      if (v.winner === null) return '<span class="ark-result draw">Level on chips: a draw</span>';
      return '<span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins the match!</span>';
    }
    if (v.phase === 'raise') return 'Raise in secret: will the next card fall in between?' + (v.timed && v.timeLeftMs ? ' · ⏱ <span class="rd-secs">' + secsLeft() + 's</span>' : '');
    const o = v.result.outcome;
    return { inside: '🎯 Inside!', outside: 'Outside', post: 'It matches a card: lost', trips: '🎉 Three of a kind!', pair: 'No three of a kind: antes back', next: 'Antes back' }[o];
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const posts = v.posts || [null, null];
    root.innerHTML =
      '<div class="rd-head"><span>Hand <strong>' + Math.min(v.hand, v.hands) + '</strong> / ' + v.hands + '</span><span>Ante <strong>' + v.ante + '</strong></span><span>Deck <strong>' + v.packLeft + '</strong> left</span></div>' +
      '<div class="rd-table">' +
      '<div class="rd-cards">' + ArkBJ.card(posts[0]) + '<div class="rd-third' + (v.third ? ' ' + (v.result ? v.result.outcome : '') : '') + '">' + (v.third ? ArkBJ.card(v.third, true) : '<div class="rd-gap">?</div>') + '</div>' + ArkBJ.card(posts[1]) + '</div>' +
      '<div class="rd-spread">' + spreadLine(v) + '</div>' +
      '<div class="rd-seats">' + seat(v, 0) + seat(v, 1) + '</div></div>' +
      '<div class="rd-caption">' + caption(v) + '</div>';
  }

  Ark.register('host', 'red-dog', {
    sounds: function (prev, v) {
      const out = [];
      if (v.locked.filter(Boolean).length > prev.locked.filter(Boolean).length) out.push('lock');
      if (v.third && !prev.third) out.push(v.result && (v.result.outcome === 'inside' || v.result.outcome === 'trips') ? 'correct' : 'reveal');
      if (prev.phase !== 'over' && v.phase === 'over') out.push('fanfare');
      return out;
    },
    padHint: 'B stay · A raise one ante · Y raise two · A: rematch at the end',
    pad: function (btn, v) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'raise') return null;
      const n = { B: 0, A: 1, Y: 2 }[btn];
      return n === undefined ? null : { type: 'raise', raise: n };
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'rd-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
      tick = setInterval(function () {
        if (root) root.querySelectorAll('.rd-secs').forEach(function (c) { c.textContent = secsLeft() + 's'; });
      }, 250);
    },
    update: function (v) { view = v; gotAt = Date.now(); render(); },
    unmount: function () { clearInterval(tick); root = view = null; },
  });
})();
