// Dice faces drawn with pips (not emoji, so every screen shows them the same).
(function () {
  // Which of the 3×3 pip spots are filled for each face (reading order).
  const PIPS = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };

  /** A die showing `value` (1-6; 0 or anything else draws a blank "?" die). `cls`: extra classes. */
  function html(value, cls) {
    const on = PIPS[value];
    let pips = '';
    for (let i = 0; i < 9; i++) pips += '<i' + (on && on.indexOf(i) !== -1 ? ' class="on"' : '') + '></i>';
    return '<span class="die' + (on ? '' : ' blank') + (cls ? ' ' + cls : '') + '">' + (on ? pips : '?') + '</span>';
  }

  window.ArkDice = { html: html };
})();
