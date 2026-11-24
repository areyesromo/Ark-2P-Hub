// FreeCell's table, drawn the same way on the TV and the phone, with
// Solitaire's cards (see /games/solitaire/board.js). Codes like 'h12'.
(function () {
  const TOP = ['c0', 'c1', 'c2', 'c3', 'f0', 'f1', 'f2', 'f3'];
  const SPREAD = 5.2; // a column fits in this many card heights; long ones bunch up

  const is = function (mark, pile, index) { return mark && mark.pile === pile && (mark.index === undefined || index === undefined || index >= mark.index); };
  const at = function (mark, pile, index) { return mark && mark.pile === pile && (mark.index === undefined ? index === undefined : mark.index === index); };

  /** opts.selected / opts.cursor: { pile, index? }. Every card and place carries data-pile (data-index in a column). */
  function html(v, opts) {
    opts = opts || {};
    const card = window.ArkSoloCards.card;
    const mark = function (pile, index) { return (is(opts.selected, pile, index) ? ' sel' : '') + (at(opts.cursor, pile, index) ? ' cursor' : ''); };
    let top = '<div class="fc-top">';
    TOP.forEach(function (pile, i) {
      const c = pile[0] === 'c' ? v.cells[i] : v.found[i - 4];
      top += '<div class="slot ' + (pile[0] === 'c' ? 'cell' : 'found') + (c ? '' : mark(pile)) + '" data-pile="' + pile + '">' +
        (c ? card(c, mark(pile), { pile: pile }) : '<span class="mark">' + (pile[0] === 'c' ? '' : 'A') + '</span>') + '</div>';
    });
    top += '</div><div class="fc-tab">';
    v.tab.forEach(function (col, n) {
      const pile = 't' + n;
      const gap = col.length > 1 ? Math.min(0.27, (SPREAD - 1) / (col.length - 1)) : 0.27;
      const cards = col.map(function (c, i) { return card(c, mark(pile, i), { pile: pile, index: i }, i * gap); }).join('');
      const empty = !col.length && at(opts.cursor, pile, undefined) ? ' cursor' : '';
      top += '<div class="col' + empty + '" data-pile="' + pile + '">' + cards + '</div>';
    });
    return top + '</div>';
  }

  const rank = function (c) { return Number(c.slice(1)); };
  const red = function (c) { return c[0] === 'h' || c[0] === 'd'; };
  const onto = function (a, b) { return red(a) !== red(b) && rank(a) === rank(b) + 1; };

  /** The cards a pick takes: [codes], or null when it isn't an ordered run (the server's rules). */
  function taking(v, pile, index) {
    if (pile[0] === 'c') return v.cells[Number(pile[1])] ? [v.cells[Number(pile[1])]] : null;
    if (pile[0] === 'f') return v.found[Number(pile[1])] ? [v.found[Number(pile[1])]] : null;
    const col = v.tab[Number(pile[1])];
    const start = index === undefined ? col.length - 1 : index;
    if (start < 0 || start >= col.length) return null;
    for (let i = start; i < col.length - 1; i++) if (!onto(col[i], col[i + 1])) return null;
    return col.slice(start);
  }

  /** Could the cards picked up at (from, index) go on `to`? */
  function fits(v, from, index, to) {
    if (from === to) return false;
    const cards = taking(v, from, index);
    if (!cards) return false;
    const c = cards[0];
    if (to[0] === 'c') return cards.length === 1 && !v.cells[Number(to[1])];
    if (to[0] === 'f') {
      const top = v.found[Number(to[1])];
      return cards.length === 1 && (top ? top[0] === c[0] && rank(top) === rank(c) - 1 : rank(c) === 1);
    }
    const col = v.tab[Number(to[1])];
    const free = v.cells.filter(function (x) { return !x; }).length;
    const empty = v.tab.filter(function (x, n) { return !x.length && 't' + n !== to; }).length;
    if (cards.length > (free + 1) * Math.pow(2, empty)) return false;
    return !col.length || onto(col[col.length - 1], c);
  }

  window.ArkFreeCell = { html: html, fits: fits, taking: taking, TOP: TOP };
})();
