// Memory Pairs' cards, drawn the same way on the TV and the phone.
(function () {
  /** The grid's markup: each card carries data-cell; cursor marks a controller's place. */
  function html(v, cursor) {
    let out = '<div class="mem-grid" style="--w:' + v.w + ';--h:' + v.h + '">';
    v.cards.forEach(function (c, i) {
      const up = c !== null;
      out += '<button type="button" class="mem-card' + (up ? ' up' : '') + (v.matched[i] ? ' matched' : '') + (cursor === i ? ' cursor' : '') + '" data-cell="' + i + '">' +
        '<span class="back"></span><span class="face">' + (up ? Ark.escapeHtml(c) : '') + '</span></button>';
    });
    return out + '</div>';
  }
  window.ArkSoloMemory = { html: html };
})();
