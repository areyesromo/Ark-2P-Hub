// Hangman's gallows, word and keyboard, drawn the same way on the TV and the phone.
(function () {
  const ROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];

  /** The gallows, with one more part of the man for each wrong guess. */
  function gallows(wrong, max) {
    const parts = [
      '<circle cx="150" cy="62" r="16"/>', // head
      '<line x1="150" y1="78" x2="150" y2="125"/>', // body
      '<line x1="150" y1="90" x2="127" y2="112"/>', // arms
      '<line x1="150" y1="90" x2="173" y2="112"/>',
      '<line x1="150" y1="125" x2="130" y2="158"/>', // legs
      '<line x1="150" y1="125" x2="170" y2="158"/>',
    ];
    return '<svg class="hm-gallows" viewBox="0 0 220 190" aria-label="' + wrong + ' of ' + max + ' wrong">' +
      '<g class="frame"><line x1="30" y1="180" x2="140" y2="180"/><line x1="70" y1="180" x2="70" y2="20"/><line x1="70" y1="20" x2="150" y2="20"/><line x1="150" y1="20" x2="150" y2="46"/></g>' +
      '<g class="man">' + parts.slice(0, wrong).join('') + '</g></svg>';
  }

  /** The word: a tile per letter, the blanks empty (and, when it's over, the ones you missed in red). */
  function word(v) {
    return '<div class="hm-word">' + [...v.pattern].map(function (c, i) {
      const missed = v.answer && c === '_';
      return '<span class="hm-tile' + (c !== '_' ? ' hit' : '') + (missed ? ' missed' : '') + '">' + (c !== '_' ? c.toUpperCase() : missed ? v.answer[i].toUpperCase() : '') + '</span>';
    }).join('') + '</div>';
  }

  /** The keyboard: guessed letters are marked right or wrong; cursor outlines one (the TV's controller). */
  function keyboard(v, cursor) {
    return '<div class="hm-kb">' + ROWS.map(function (row, r) {
      return '<div class="hm-row">' + [...row].map(function (L, c) {
        const l = L.toLowerCase();
        const cls = v.hits.indexOf(l) !== -1 ? ' hit' : v.misses.indexOf(l) !== -1 ? ' miss' : '';
        return '<button type="button" class="hm-key' + cls + (cursor && cursor.r === r && cursor.c === c ? ' cursor' : '') + '" data-k="' + l + '">' + L + '</button>';
      }).join('') + '</div>';
    }).join('') + '</div>';
  }

  window.ArkHangman = { ROWS: ROWS, gallows: gallows, word: word, keyboard: keyboard };
})();
