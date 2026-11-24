// Lights Out's grid, drawn the same way on the TV and the phone.
(function () {
  /** The grid's markup; opts.cursor outlines the selected light (the TV's controller cursor). */
  function html(v, opts) {
    opts = opts || {};
    let out = '<div class="lo-grid" style="--n:' + v.n + '">';
    v.board.forEach(function (on, i) {
      out += '<button type="button" class="lo-cell' + (on ? ' on' : '') + (opts.cursor === i ? ' cursor' : '') + '" data-cell="' + i + '"></button>';
    });
    return out + '</div>';
  }

  window.ArkLights = { html: html };
})();
