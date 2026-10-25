// Crazy Eights card faces for the TV and the phones: a card id like '10H' becomes a little card
// (rank in the corners, the suit big in the middle). Sets window.ArkCards.
(function () {
  const SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };

  function rank(c) { return c.slice(0, -1); }
  function suit(c) { return c.slice(-1); }

  /** A card face; `extra` adds classes (playable, dim...) and `attrs` raw attributes (data-card...). */
  function face(c, extra, attrs) {
    const s = suit(c);
    const red = s === 'H' || s === 'D';
    return '<div class="ce-card ' + (red ? 'red' : 'black') + (extra ? ' ' + extra : '') + '"' + (attrs || '') + ' aria-label="' + rank(c) + ' of ' + NAME[s] + '">' +
      '<span class="corner">' + rank(c) + '<br>' + SYMBOL[s] + '</span><span class="pip">' + SYMBOL[s] + '</span>' +
      '<span class="corner low">' + rank(c) + '<br>' + SYMBOL[s] + '</span></div>';
  }

  function back(extra) {
    return '<div class="ce-card back' + (extra ? ' ' + extra : '') + '"></div>';
  }

  window.ArkCards = { face: face, back: back, SYMBOL: SYMBOL, NAME: NAME, suit: suit, rank: rank };
})();
