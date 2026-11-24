// Hangman Duel's shared pieces: the gallows (drawn a stroke per wrong letter) and the word's tiles.
(function () {
  // Seven strokes: the head, body, two arms, two legs, then the face (out).
  const PARTS = [
    '<circle cx="70" cy="34" r="10"/>',
    '<line x1="70" y1="44" x2="70" y2="74"/>',
    '<line x1="70" y1="52" x2="56" y2="64"/>',
    '<line x1="70" y1="52" x2="84" y2="64"/>',
    '<line x1="70" y1="74" x2="58" y2="92"/>',
    '<line x1="70" y1="74" x2="82" y2="92"/>',
    '<path class="face" d="M65 31l4 4m0-4l-4 4M71 31l4 4m0-4l-4 4"/>',
  ];

  /** The gallows with `misses` strokes; `state` 'solved' | 'hanged' | null colours it. */
  function gallows(misses, lives, state) {
    let body = '';
    for (let i = 0; i < Math.min(misses, PARTS.length); i++) body += i === misses - 1 ? '<g class="fresh">' + PARTS[i] + '</g>' : PARTS[i];
    return '<svg class="hg-gallows' + (state ? ' ' + state : '') + '" viewBox="0 0 110 110" aria-label="' + misses + ' of ' + lives + ' wrong">' +
      '<path class="wood" d="M10 104h60M24 104V8h46v14"/><path class="brace" d="M24 26l16-18"/>' +
      '<g class="man">' + body + '</g></svg>';
  }

  /** The word's tiles: letters found showing, the rest blank (`word` fills them in at the end). */
  function tiles(mask, word) {
    if (!mask) return '';
    return '<div class="hg-tiles">' + mask.map(function (c, i) {
      const shown = c || (word ? word[i] : '');
      return '<span class="hg-tile' + (c ? ' found' : shown ? ' missed' : '') + '">' + (shown || '') + '</span>';
    }).join('') + '</div>';
  }

  window.ArkHang = { gallows: gallows, tiles: tiles };
})();
