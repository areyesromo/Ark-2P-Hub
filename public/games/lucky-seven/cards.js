// Lucky Seven's own cards, for the TV and the phones: a number in its own colour, the gold ×2
// Double and the blue Shield. Sets window.ArkLucky.
(function () {
  // A colour per number (the cards' own paint).
  const PAINT = { 1: '#ef4444', 2: '#f97316', 3: '#eab308', 4: '#84cc16', 5: '#22c55e', 6: '#14b8a6', 7: '#0ea5e9', 8: '#6366f1', 9: '#a855f7' };

  function card(c, cls) {
    if (!c) return '<div class="l7-card back' + (cls ? ' ' + cls : '') + '"><span>7</span></div>';
    if (c === 'D') return '<div class="l7-card double' + (cls ? ' ' + cls : '') + '"><b>×2</b><small>Double</small></div>';
    if (c === 'S') return '<div class="l7-card shield' + (cls ? ' ' + cls : '') + '"><b>🛡</b><small>Shield</small></div>';
    return '<div class="l7-card' + (cls ? ' ' + cls : '') + '" style="--paint:' + PAINT[c] + '"><b>' + c + '</b></div>';
  }

  /** A hand, numbers in order, the specials after. `fresh`: the last card (it flips in). */
  function hand(cards, fresh) {
    const order = cards.map(function (c, i) { return { c: c, i: i }; }).sort(function (a, b) {
      const ka = /\d/.test(a.c) ? Number(a.c) : 10;
      const kb = /\d/.test(b.c) ? Number(b.c) : 10;
      return ka - kb;
    });
    return '<div class="l7-hand">' + order.map(function (x) { return card(x.c, fresh && x.i === cards.length - 1 ? 'fresh' : ''); }).join('') + '</div>';
  }

  /** How many of the cards left would bust this hand (they're all face up: anyone can count). */
  function risk(v, slot) {
    const left = {};
    for (let n = 1; n <= 9; n++) left[n] = 10 - n;
    v.gone.forEach(function (c) { if (/\d/.test(c)) left[c]--; });
    const deck = Math.max(1, v.deckLeft);
    if (v.hands[slot].includes('S')) return { bad: 0, of: deck };
    let bad = 0;
    new Set(v.hands[slot].filter(function (c) { return /\d/.test(c); })).forEach(function (c) { bad += Math.max(0, left[c]); });
    return { bad: Math.min(bad, deck), of: deck };
  }

  window.ArkLucky = { card: card, hand: hand, risk: risk };
})();
