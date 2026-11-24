// Anagram Rush's letters and the word being made, the same on the TV and the phone.
// The word is made on the screen itself (picks: which letters, in order) and sent
// whole once every letter is used.
(function () {
  /** What just happened, as a line under the letters. */
  function feedback(v) {
    const l = v.last;
    if (!l) return '';
    if (l.timeUp) return '⏰ Time! It was <strong>' + l.answer.toUpperCase() + '</strong>';
    if (l.skipped) return '⏭ Skipped: it was <strong>' + l.answer.toUpperCase() + '</strong>';
    if (l.ok) return '<span class="ok">✓ ' + l.word.toUpperCase() + '</span>' + (l.word !== l.answer ? ' <span class="muted">(or ' + l.answer.toUpperCase() + ')</span>' : '');
    return '<span class="no">✗ ' + l.word.toUpperCase() + ' isn\'t a word</span>';
  }

  /** The letters to pick from (used ones faded) and the word so far; cursor outlines a letter (the TV's controller). */
  function html(v, picks, cursor) {
    const letters = v.letters || [];
    let tiles = '<div class="an-tiles">';
    letters.forEach(function (ch, i) {
      tiles += '<button type="button" class="an-tile' + (picks.indexOf(i) !== -1 ? ' used' : '') + (cursor === i ? ' cursor' : '') + '" data-i="' + i + '">' + ch.toUpperCase() + '</button>';
    });
    tiles += '</div>';
    let word = '<div class="an-word">';
    for (let k = 0; k < letters.length; k++) word += '<span class="an-slot' + (k < picks.length ? ' full' : '') + '">' + (k < picks.length ? letters[picks[k]].toUpperCase() : '') + '</span>';
    word += '</div>';
    return word + tiles;
  }

  /** A fresh word (or a wrong guess) clears what's been picked: the key changes when it should. */
  function roundKey(v) {
    return (v.letters ? v.letters.join('') : '') + '|' + (v.last ? v.last.n : 0);
  }

  window.ArkAnagram = { html: html, feedback: feedback, roundKey: roundKey };
})();
