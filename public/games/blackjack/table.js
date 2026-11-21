// Blackjack cards and chips for the TV and the phones. Sets window.ArkBJ.
(function () {
  const SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };
  // Chip colours by value, as at a real table.
  const CHIP = { 25: 'green', 50: 'orange', 100: 'black', 200: 'pink', 500: 'purple' };

  /** A card ('10H'), or its back (null). `fresh`: it slides in from the shoe. */
  function card(c, fresh, delay) {
    const anim = fresh ? ' deal" style="animation-delay:' + (delay || 0) + 'ms' : '';
    if (!c) return '<div class="bj-card back' + anim + '"></div>';
    const s = c.slice(-1);
    const r = c.slice(0, -1);
    return '<div class="bj-card ' + (s === 'H' || s === 'D' ? 'red' : 'black') + anim + '" aria-label="' + r + ' of ' + NAME[s] + '">' +
      '<span class="ix">' + r + '<i>' + SYMBOL[s] + '</i></span><span class="pip">' + SYMBOL[s] + '</span></div>';
  }

  /** A row of cards. `key` names the row so the cards new since the last render slide in. */
  function cards(list, key, seen) {
    let html = '<div class="bj-cards">';
    let n = 0;
    list.forEach(function (c, i) {
      const id = key + ':' + i + ':' + (c || '?');
      const fresh = seen && !seen.has(id);
      if (seen) seen.add(id);
      html += card(c, fresh, fresh ? n++ * 140 : 0);
    });
    return html + '</div>';
  }

  /** A chip of `value`. */
  function chip(value, extra, style) {
    const colour = CHIP[value] || 'gold';
    return '<span class="bj-chip ' + colour + (extra ? ' ' + extra : '') + '"' + (style ? ' style="' + style + '"' : '') + '><b>' + value + '</b></span>';
  }

  /** The chips that make up an amount, biggest first (for a little stack). */
  function stack(amount) {
    const out = [];
    [500, 200, 100, 50, 25].forEach(function (v) {
      while (amount >= v && out.length < 6) { out.push(v); amount -= v; }
    });
    return '<span class="bj-stack">' + out.map(function (v, i) { return chip(v, '', '--i:' + i); }).join('') + '</span>';
  }

  const OUTCOME = { win: 'Win', lose: 'Lose', bust: 'Bust', push: 'Push', blackjack: 'Blackjack!' };

  /** A hand's result as a badge: what happened and the chips won or lost. */
  function result(r) {
    const amount = r.win > 0 ? '+' + r.win : r.win < 0 ? '−' + -r.win : '±0';
    return '<span class="bj-result ' + r.outcome + '">' + OUTCOME[r.outcome] + ' <b>' + amount + '</b></span>';
  }

  /** "17" or "soft 17", or "Bust" over 21. */
  function totalText(h) {
    if (h.total === null || h.total === undefined) return '';
    if (h.total > 21) return 'Bust';
    return (h.soft ? 'soft ' : '') + h.total;
  }

  window.ArkBJ = { card: card, cards: cards, chip: chip, stack: stack, result: result, totalText: totalText, CHIP: CHIP };
})();
