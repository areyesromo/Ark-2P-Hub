// Word Guess's board and keyboard, drawn the same way on the TV and the phone.
(function () {
  const ROWS = ['qwertyuiop', 'asdfghjkl', '⏎zxcvbnm⌫'];
  const CLASS = { g: 'green', y: 'yellow', '.': 'grey' };

  /** The six rows: the guesses so far (coloured), the word being typed, then empty rows. flip: the row that turns over. */
  function board(v, flip) {
    let out = '<div class="wg-board">';
    for (let r = 0; r < v.tries; r++) {
      const g = v.guesses[r];
      const typing = !g && r === v.guesses.length && v.phase === 'play';
      out += '<div class="wg-row' + (typing ? ' current' : '') + (r === flip ? ' flip' : '') + '">';
      for (let i = 0; i < 5; i++) {
        if (g) out += '<i class="' + CLASS[g.marks[i]] + '" style="--i:' + i + '">' + g.word[i] + '</i>';
        else if (typing && v.entry[i]) out += '<i class="typed">' + v.entry[i] + '</i>';
        else out += '<i></i>';
      }
      out += '</div>';
    }
    return out + '</div>';
  }

  /** The keyboard, each key coloured by what's known about its letter. cursor: { r, c } outlines a key (controllers). */
  function keyboard(v, cursor) {
    return '<div class="wg-keys">' + ROWS.map(function (row, r) {
      return '<div class="wg-krow">' + row.split('').map(function (k, c) {
        const cls = k === '⏎' ? ' wide enter' : k === '⌫' ? ' wide back' : v.keys[k] ? ' ' + CLASS[v.keys[k]] : '';
        const on = cursor && cursor.r === r && cursor.c === c ? ' cursor' : '';
        return '<button type="button" class="key' + cls + on + '" data-k="' + k + '">' + (k === '⏎' ? 'Enter' : k) + '</button>';
      }).join('') + '</div>';
    }).join('') + '</div>';
  }

  /** What a key on the on-screen keyboard sends. */
  function input(k) {
    if (k === '⏎') return { type: 'enter' };
    if (k === '⌫') return { type: 'back' };
    return { type: 'letter', letter: k };
  }

  window.ArkSoloWords = { ROWS: ROWS, board: board, keyboard: keyboard, input: input };
})();
