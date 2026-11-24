// Solitaire's table, drawn the same way on the TV and the phone.
// Cards are codes like 'h12' (suit + rank); '#' is a face-down card.
(function () {
  const SUIT = { s: '♠', h: '♥', d: '♦', c: '♣' };
  const RANK = { 1: 'A', 11: 'J', 12: 'Q', 13: 'K' };
  const DOWN_GAP = 0.12; // how much of a card shows under the next one, face down / face up
  const UP_GAP = 0.27;

  function face(code) {
    const s = code[0];
    const r = Number(code.slice(1));
    return '<span class="rank">' + (RANK[r] || r) + '</span><span class="suit">' + SUIT[s] + '</span><span class="big">' + SUIT[s] + '</span>';
  }

  function card(code, extra, data, y) {
    const down = code === '#';
    return '<div class="sol-card' + (down ? ' down' : ' up ' + (code[0] === 'h' || code[0] === 'd' ? 'red' : 'black') + ' s' + code[0]) + (extra || '') + '"' +
      (data ? ' data-pile="' + data.pile + '"' + (data.index !== undefined ? ' data-index="' + data.index + '"' : '') : '') +
      (y !== undefined ? ' style="--y:' + y.toFixed(2) + '"' : '') + '>' + (down ? '' : face(code)) + '</div>';
  }

  const is = function (mark, pile, index) { return mark && mark.pile === pile && (mark.index === undefined || index === undefined || index >= mark.index); };
  const at = function (mark, pile, index) { return mark && mark.pile === pile && (mark.index === undefined ? index === undefined : mark.index === index); };

  /**
   * opts.selected { pile, index? }: cards picked up (lifted); opts.cursor { pile, index? }:
   * where a controller is (outlined). Every card and empty place carries data-pile (and data-index in a column).
   */
  function html(v, opts) {
    opts = opts || {};
    const sel = opts.selected;
    const cur = opts.cursor;
    const mark = function (pile, index) {
      return (is(sel, pile, index) ? ' sel' : '') + (at(cur, pile, index) ? ' cursor' : '');
    };
    let top = '<div class="sol-top">';
    top += '<div class="slot stock' + mark('stock') + '" data-pile="stock">' + (v.stock ? card('#', '', { pile: 'stock' }) + '<span class="count">' + v.stock + '</span>' : '<span class="again">↻</span>') + '</div>';
    top += '<div class="slot waste' + (v.draw === 3 ? ' fan' : '') + '" data-pile="waste">' + v.waste.map(function (c, i) {
      const last = i === v.waste.length - 1;
      return card(c, (last ? mark('waste') : '') + ' w' + (v.waste.length - 1 - i), last ? { pile: 'waste' } : null);
    }).join('') + '</div><div class="slot gap"></div>';
    v.found.forEach(function (c, f) {
      top += '<div class="slot found' + mark('f' + f) + '" data-pile="f' + f + '">' + (c ? card(c, '', { pile: 'f' + f }) : '<span class="ace">A</span>') + '</div>';
    });
    top += '</div>';

    let tab = '<div class="sol-tab">';
    v.tab.forEach(function (col, n) {
      const pile = 't' + n;
      let y = 0;
      let cards = '';
      col.forEach(function (c, i) {
        cards += card(c, c === '#' ? '' : mark(pile, i), c === '#' ? null : { pile: pile, index: i }, y);
        y += c === '#' ? DOWN_GAP : UP_GAP;
      });
      const empty = !col.length && at(cur, pile, undefined) ? ' cursor' : '';
      tab += '<div class="col' + empty + '" data-pile="' + pile + '" style="--h:' + (y + 1).toFixed(2) + '">' + cards + '</div>';
    });
    return top + tab + '</div>';
  }

  const rankOf = function (code) { return Number(code.slice(1)); };
  const redOf = function (code) { return code[0] === 'h' || code[0] === 'd'; };

  /** The card on top of a pile in a view (or the card at index in a column), or null. */
  function cardAt(v, pile, index) {
    if (pile === 'waste') return v.waste[v.waste.length - 1] || null;
    if (pile[0] === 'f') return v.found[Number(pile[1])];
    const col = v.tab[Number(pile[1])];
    return col[index === undefined ? col.length - 1 : index] || null;
  }

  /** Could the cards picked up at (from, index) go on pile `to`? The same rules as the server's. */
  function fits(v, from, index, to) {
    if (from === to || to === 'stock') return false;
    const c = cardAt(v, from, index);
    if (!c || c === '#') return false;
    const many = from[0] === 't' && index !== undefined && index < v.tab[Number(from[1])].length - 1;
    const top = to[0] === 'f' ? v.found[Number(to[1])] : cardAt(v, to);
    if (to[0] === 'f') return !many && (top ? top[0] === c[0] && rankOf(top) === rankOf(c) - 1 : rankOf(c) === 1);
    if (!top) return rankOf(c) === 13;
    return top !== '#' && redOf(top) !== redOf(c) && rankOf(top) === rankOf(c) + 1;
  }

  window.ArkSoloCards = { html: html, fits: fits, card: card };
})();
