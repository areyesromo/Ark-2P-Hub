// Heads-up Hold'em's shared bits for the TV and the phones: an action as words, and the raise
// sizes the phone offers (the least you can, half the pot, the pot, all in).
(function () {
  function actText(a) {
    if (!a) return '';
    const amt = a.amount ? ' ' + a.amount.toLocaleString() : '';
    const word = { 'small blind': 'Small blind', 'big blind': 'Big blind', fold: 'Fold', check: 'Check', call: 'Call', bet: 'Bet', raise: 'Raise to', 'all in': 'All in' }[a.act] || a.act;
    return '<span class="hd-said ' + a.act.replace(' ', '-') + '">' + word + amt + '</span>';
  }

  /** The raise choices: [{ label, to }], each to a different amount, from the view's options. */
  function raises(v) {
    const o = v.options;
    if (!o || o.minTo === null) return [];
    const theirs = v.bets[1 - v.you];
    const sized = function (frac) { return Math.max(o.minTo, Math.min(o.maxTo, theirs + Math.round((v.pot * frac) / 5) * 5)); };
    const list = [{ label: 'Min', to: o.minTo }, { label: '½ pot', to: sized(0.5) }, { label: 'Pot', to: sized(1) }, { label: 'All in', to: o.maxTo }];
    const out = [];
    list.forEach(function (r) { if (!out.some(function (x) { return x.to === r.to; })) out.push(r); });
    return out;
  }

  window.ArkPoker = { actText: actText, raises: raises };
})();
