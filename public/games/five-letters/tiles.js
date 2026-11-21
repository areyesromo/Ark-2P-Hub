// Five Letters boards for the TV and the phones. Sets window.ArkFL.
(function () {
  const esc = function (s) { return Ark.escapeHtml(String(s)); };

  /**
   * A board of `rows` × `letters` tiles. guesses: [{ word|null, marks }]. typing: the row being
   * typed (phone). fresh: how many guesses were already shown (rows after that flip in).
   * opts.shake: shake the typing row (not a word).
   */
  function board(guesses, opts) {
    const rows = opts.rows;
    const n = opts.letters;
    let html = '<div class="fl-board' + (opts.small ? ' small' : '') + '" style="--n:' + n + '">';
    for (let r = 0; r < rows; r++) {
      const g = guesses[r];
      const typing = !g && r === guesses.length && opts.typing !== undefined && opts.typing !== null;
      html += '<div class="fl-row' + (typing && opts.shake ? ' shake' : '') + '">';
      for (let i = 0; i < n; i++) {
        if (g) {
          const flip = opts.seen !== undefined && r >= opts.seen && g.marks[i] !== 'p';
          const letter = g.word ? g.word[i] : '';
          html += '<span class="fl-tile ' + g.marks[i] + (flip ? ' flip' : '') + '"' + (flip ? ' style="animation-delay:' + i * 160 + 'ms"' : '') + '>' + esc(letter) + '</span>';
        } else if (typing) {
          const ch = opts.typing[i] || '';
          html += '<span class="fl-tile typing' + (ch ? ' filled' : '') + (i === opts.typing.length ? ' caret' : '') + '">' + esc(ch) + '</span>';
        } else {
          html += '<span class="fl-tile"></span>';
        }
      }
      html += '</div>';
    }
    return html + '</div>';
  }

  /** The answer, a tile per letter (the round's reveal). */
  function word(w) {
    return '<div class="fl-word">' + w.split('').map(function (ch, i) {
      return '<span class="fl-tile g flip" style="animation-delay:' + i * 120 + 'ms">' + esc(ch) + '</span>';
    }).join('') + '</div>';
  }

  /** Each letter's best colour so far on a board (for the keyboard). */
  function keyStates(guesses) {
    const rank = { g: 3, y: 2, b: 1 };
    const out = {};
    guesses.forEach(function (g) {
      if (!g.word) return;
      for (let i = 0; i < g.word.length; i++) {
        const ch = g.word[i];
        if (!out[ch] || rank[g.marks[i]] > rank[out[ch]]) out[ch] = g.marks[i];
      }
    });
    return out;
  }

  window.ArkFL = { board: board, word: word, keyStates: keyStates, esc: esc };
})();
