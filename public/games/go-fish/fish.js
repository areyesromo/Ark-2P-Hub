// Go Fish's shared bits for the TV and the phones: an ask in words, and a book as a little stack.
(function () {
  const NAME = { A: 'aces', J: 'jacks', Q: 'queens', K: 'kings' };
  const plural = function (r) { return NAME[r] || r + 's'; };

  /** "Any sevens?" and what came of it. */
  function askText(e) {
    if (!e.rank) return { ask: 'No ask in time', answer: 'Went fishing 🎣' };
    const answer = e.got ? 'Here: ' + e.got + ' ' + (e.got === 1 ? 'card' : 'cards') + '!' : e.lucky ? 'Go fish… and drew one! 🍀' : e.fished ? 'Go fish! 🎣' : 'Go fish! (the pond is empty)';
    return { ask: 'Any ' + plural(e.rank) + '?', answer: answer };
  }

  function books(list) {
    return '<div class="gf-books">' + list.map(function (r) { return '<span class="gf-book">' + r + '</span>'; }).join('') + '</div>';
  }

  window.ArkFish = { askText: askText, books: books, plural: plural };
})();
