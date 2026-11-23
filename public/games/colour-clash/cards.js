// Colour Clash cards for the TV and the phones. Sets window.ArkCC.
(function () {
  const NAME = { R: 'red', G: 'green', B: 'blue', Y: 'yellow' };
  // A shape for each colour, so they can be told apart without the colours.
  const SHAPE = { R: '▲', G: '■', B: '●', Y: '★' };
  const SYMBOL = { S: '⊘', R: '⇄', D: '+2', W: '', W4: '+4' };

  const isWild = function (c) { return c[0] === 'W'; };
  const face = function (c) { return c.split('#')[0].slice(isWild(c) ? 0 : 1); };

  /** A card ('R5#1', 'W4#2') or its back (null). `extra`: classes; `attrs`: raw attributes. */
  function card(c, extra, attrs) {
    if (!c) return '<div class="cc-card back' + (extra ? ' ' + extra : '') + '"' + (attrs || '') + '><span class="cc-gem"></span></div>';
    const f = face(c);
    const col = isWild(c) ? 'W' : c[0];
    const mark = SYMBOL[f] !== undefined ? SYMBOL[f] : f;
    const shape = isWild(c) ? '' : SHAPE[col];
    return '<div class="cc-card c' + col + (isWild(c) ? ' wild' : '') + (extra ? ' ' + extra : '') + '"' + (attrs || '') +
      ' aria-label="' + label(c) + '"><span class="cc-ix">' + (mark || '★') + '<i>' + shape + '</i></span>' +
      '<span class="cc-face">' + (isWild(c) ? '<span class="cc-gem"></span>' : '') + '<b>' + mark + '</b></span>' +
      '<span class="cc-ix low">' + (mark || '★') + '<i>' + shape + '</i></span></div>';
  }

  function label(c) {
    const f = face(c);
    if (f === 'W') return 'Wild';
    if (f === 'W4') return 'Wild Draw Four';
    const what = { S: 'Skip', R: 'Reverse', D: 'Draw Two' }[f] || f;
    return NAME[c[0]] + ' ' + what;
  }

  /** The colour to follow, as a chip. */
  function colourChip(col) {
    return '<span class="cc-chip c' + col + '">' + SHAPE[col] + ' ' + NAME[col] + '</span>';
  }

  window.ArkCC = { card: card, label: label, colourChip: colourChip, isWild: isWild, face: face, NAME: NAME, SHAPE: SHAPE };
})();
