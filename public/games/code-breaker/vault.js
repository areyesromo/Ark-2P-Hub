// Code Breaker pieces for the TV and the phones: code wheels and the bulls-and-cows pegs. Sets window.ArkCode.
(function () {
  /** A code as wheels; null digits show a padlock (hidden) or a gap (not typed yet). */
  function wheels(code, length, opts) {
    opts = opts || {};
    let html = '<span class="cb-wheels' + (opts.small ? ' small' : '') + '">';
    for (let i = 0; i < length; i++) {
      const d = code ? code[i] : undefined;
      html += '<b class="cb-wheel' + (d === undefined ? (opts.hidden ? ' locked' : ' empty') : '') + (opts.caret === i ? ' caret' : '') + '">' + (d === undefined ? (opts.hidden ? '🔒' : '') : d) + '</b>';
    }
    return html + '</span>';
  }

  /** Gold pegs for bulls, silver for cows, dim for the rest. */
  function pegs(bulls, cows, length) {
    let html = '<span class="cb-pegs" aria-label="' + bulls + ' bulls, ' + cows + ' cows">';
    for (let i = 0; i < length; i++) html += '<i class="' + (i < bulls ? 'bull' : i < bulls + cows ? 'cow' : '') + '"></i>';
    return html + '</span>';
  }

  /** A list of guesses, latest at the bottom. */
  function rows(list, length, max) {
    let html = '<ol class="cb-rows">';
    list.forEach(function (g, i) {
      html += '<li class="' + (g.bulls === length ? 'cracked' : '') + (i === list.length - 1 ? ' fresh' : '') + '"><small>' + (i + 1) + '</small>' + wheels(g.guess, length, { small: true }) + pegs(g.bulls, g.cows, length) + '</li>';
    });
    if (max) for (let i = list.length; i < max; i++) html += '<li class="blank"><small>' + (i + 1) + '</small></li>';
    return html + '</ol>';
  }

  window.ArkCode = { wheels: wheels, pegs: pegs, rows: rows };
})();
