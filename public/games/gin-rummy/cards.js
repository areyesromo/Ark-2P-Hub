// Gin Rummy's cards for the TV and the phones. Sets window.ArkGin.
(function () {
  const SYMBOL = { S: '♠', H: '♥', D: '♦', C: '♣' };
  const NAME = { S: 'spades', H: 'hearts', D: 'diamonds', C: 'clubs' };

  /** A card ('10H') or its back (null). `extra`: classes; `attrs`: raw attributes. */
  function card(c, extra, attrs) {
    if (!c) return '<div class="gr-card back' + (extra ? ' ' + extra : '') + '"' + (attrs || '') + '></div>';
    const s = c.slice(-1);
    const r = c.slice(0, -1);
    return '<div class="gr-card ' + (s === 'H' || s === 'D' ? 'red' : 'black') + (extra ? ' ' + extra : '') + '"' + (attrs || '') +
      ' aria-label="' + r + ' of ' + NAME[s] + '"><span class="ix">' + r + '<i>' + SYMBOL[s] + '</i></span><span class="pip">' + SYMBOL[s] + '</span></div>';
  }

  /** "7♥" for a caption. */
  function name(c) {
    return c ? c.slice(0, -1) + SYMBOL[c.slice(-1)] : '';
  }

  const rank = function (c) { return ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'].indexOf(c.slice(0, -1)); };

  /** A shown hand: its melds (laid-off cards marked), then the deadwood. */
  function shownHtml(shown, opts) {
    opts = opts || {};
    const laid = shown.laid || [];
    let html = '<div class="gr-shown">';
    shown.melds.forEach(function (m) {
      html += '<div class="gr-meld">' + m.slice().sort(function (a, b) { return rank(a) - rank(b); }).map(function (c) { return card(c); }).join('') + '</div>';
    });
    if (laid.length) html += '<div class="gr-meld laid" title="Laid off">' + laid.map(function (c) { return card(c, 'laid'); }).join('') + '</div>';
    if (shown.deadwood.length) html += '<div class="gr-meld dead">' + shown.deadwood.map(function (c) { return card(c, 'dead'); }).join('') + '</div>';
    html += '<div class="gr-count' + (shown.points === 0 ? ' gin' : '') + '">' + (shown.points === 0 ? 'Gin!' : shown.points + (opts.short ? '' : ' left over')) + '</div>';
    return html + '</div>';
  }

  window.ArkGin = { card: card, name: name, shownHtml: shownHtml, rank: rank };
})();
