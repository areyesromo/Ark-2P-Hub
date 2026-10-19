// Liar's Dice: the "how to play" example round (TV and phones) and the bid helper (phones).
(function () {
  const WORDS = ['', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  // The example: player 1 rolled these, player 2 those. Two 4s + one 4 + a wild 1 = four 4s.
  const HANDS = [[2, 4, 4, 5, 6], [1, 3, 4, 6, 6]];

  /**
   * The steps, given the two names (HTML): a title, what to say, whose dice show (0, 1 or
   * 'both'), the bid on the table, and which faces to light up.
   */
  function steps(a, b) {
    return [
      { title: '🎲 Your dice are secret', text: 'You each roll five dice under a cup. Only you see yours, on your phone.', show: 0 },
      { title: '🗣️ Bid on ALL the dice', text: 'A bid is a guess about both cups together. ' + a + ' has two 4s, so bids <b>three 4s</b>: “at least three dice show 4, counting both of us”.', show: 0, bid: { qty: 3, face: 4, by: 0 } },
      { title: '⬆️ Raise…', text: b + ' must go higher: <b>more dice</b> (four 4s) or the <b>same number of a higher face</b> (three 5s). ' + b + ' has a 4 and a wild 1, so bids <b>four 4s</b>.', show: 1, bid: { qty: 4, face: 4, by: 1 } },
      { title: '🤥 …or call Liar!', text: 'Think the last bid is too high? Call <b>Liar!</b> ' + a + ' does. The cups come up.', show: 'none', bid: { qty: 4, face: 4, by: 1 }, liar: 0 },
      { title: '🔍 Count them', text: 'Count that face in both cups. <b>Ones are wild</b>: they count as any face. 4s: two + one + a wild 1 = <b>four</b>. The bid was true!', show: 'both', bid: { qty: 4, face: 4, by: 1 }, light: 4 },
      { title: '💀 Wrong? Lose a die', text: 'Whoever was wrong loses a die: here ' + a + ', who called Liar! on a true bid. Lose all your dice and you\'re out.', show: 'both', bid: { qty: 4, face: 4, by: 1 }, light: 4, lose: 0 },
      { title: '💡 Tip', text: 'Count your own dice, then guess theirs: each of their dice shows a face about 1 time in 6 (1 in 3 with wild 1s). Your phone works out the odds for you.', show: 'none' },
    ];
  }

  /** "four 5s" with a die picture. */
  function bidHtml(b) {
    return '<strong>' + (WORDS[b.qty] || b.qty) + '</strong> ' + ArkDice.html(b.face) + (b.qty === 1 ? '' : '<span class="s">s</span>');
  }

  /** One player's cup in the example: their dice, or hidden ones. */
  function cup(st, slot) {
    const open = st.show === 'both' || st.show === slot;
    return HANDS[slot].map(function (d) {
      if (!open) return ArkDice.html(0);
      const lit = st.light && (d === st.light || d === 1);
      return ArkDice.html(d, lit ? (d === 1 ? 'wild' : 'match') : '');
    }).join('') + (st.lose === slot ? '<span class="ld-lose">−🎲</span>' : '');
  }

  /** The example at step `i` (looping), as HTML; `names` = [p1 HTML, p2 HTML]. */
  function demoHtml(i, names) {
    const all = steps(names[0], names[1]);
    const st = all[i % all.length];
    return '<div class="ld-demo"><div class="ld-demo-step">' + (i % all.length + 1) + ' / ' + all.length + '</div>' +
      '<div class="ld-demo-title">' + st.title + '</div><div class="ld-demo-text">' + st.text + '</div>' +
      '<div class="ld-demo-table">' +
      '<div class="ld-demo-cup"><div>' + names[0] + '</div><div class="cup">' + cup(st, 0) + '</div></div>' +
      '<div class="ld-demo-bid">' + (st.bid ? names[st.bid.by] + ' bids<br>' + bidHtml(st.bid) : '') + (st.liar !== undefined ? '<div class="ld-demo-liar">' + names[st.liar] + ': Liar!</div>' : '') + '</div>' +
      '<div class="ld-demo-cup"><div>' + names[1] + '</div><div class="cup">' + cup(st, 1) + '</div></div>' +
      '</div></div>';
  }

  /** Chance that at least `need` of `n` dice show a face, each with chance `p`. */
  function atLeast(need, n, p) {
    if (need <= 0) return 1;
    if (need > n) return 0;
    let sum = 0;
    let c = 1; // n choose k
    for (let k = 0; k <= n; k++) {
      if (k >= need) sum += c * Math.pow(p, k) * Math.pow(1 - p, n - k);
      c = (c * (n - k)) / (k + 1);
    }
    return sum;
  }

  /**
   * Is bid `b` likely true, from `you`'s point of view? How many you hold of its face, how many
   * more it needs from the rival's dice, and the chance they have them.
   */
  function odds(v, b) {
    const wildHere = v.wild && b.face !== 1;
    const mine = (v.mine || []).filter(function (d) { return d === b.face || (wildHere && d === 1); }).length;
    const n = v.counts[1 - v.you];
    const need = b.qty - mine;
    return { mine: mine, need: need, n: n, chance: atLeast(need, n, wildHere ? 1 / 3 : 1 / 6) };
  }

  function chanceWords(c) {
    const pct = Math.round(c * 100) + '%';
    if (c >= 0.66) return '<b class="good">likely true (' + pct + ')</b>';
    if (c >= 0.33) return '<b class="warn">could go either way (' + pct + ')</b>';
    return '<b class="bad">probably a lie (' + pct + ')</b>';
  }

  window.ArkLD = { steps: steps, demoHtml: demoHtml, bidHtml: bidHtml, odds: odds, chanceWords: chanceWords, WORDS: WORDS };
})();
