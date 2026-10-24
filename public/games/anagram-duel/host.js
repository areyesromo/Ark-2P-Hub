(function () {
  Ark.loadCss('/games/anagram-duel/style.css');
  const esc = Ark.escapeHtml;
  let root = null;
  let key = '';

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  // How far along each player is with their word (just how many letters, not which).
  function lane(v, slot) {
    let dots = '';
    for (let i = 0; i < 5; i++) dots += '<span class="dot' + (i < v.progress[slot] ? ' on' : '') + '"></span>';
    return '<div class="ad-lane p' + (slot + 1) + '">' + nameOf(v, slot) + '<span class="dots">' + dots + '</span></div>';
  }

  function middle(v) {
    if (v.phase === 'countdown') return '<div class="big">Round ' + v.round + '</div><div class="sub">Get your fingers ready…</div>';
    if (v.phase === 'play') {
      return '<div class="ad-tiles">' + v.letters.map(function (c) { return '<span class="ad-tile">' + esc(c.toUpperCase()) + '</span>'; }).join('') + '</div>' +
                // Views only come when something happens, so the bar runs down by itself from the time left.
        '<div class="ad-bar"><span style="width:' + (100 * v.timeLeft) / v.roundMs + '%;animation-duration:' + v.timeLeft + 'ms"></span></div>' +
        '<div class="ad-lanes">' + lane(v, 0) + lane(v, 1) + '</div>' +
        '<div class="sub">Make a word with all five letters on your phone. Any real word counts.</div>';
    }
    const r = v.result;
    let line = '';
    if (r && r.winner !== null) {
      line = '<div class="big">' + esc(r.word.toUpperCase()) + '</div><div class="sub">' + nameOf(v, r.winner) + ' got it' +
        (r.word !== r.answer ? ' <span class="muted">(it was dealt as ' + esc(r.answer.toUpperCase()) + ')</span>' : '') + '</div>';
    } else if (r) {
      line = '<div class="big muted">' + esc(r.answer.toUpperCase()) + '</div><div class="sub">Nobody found it in time. No point.</div>';
    }
    if (v.phase === 'over') {
      line += '<div class="ad-over">🏆 ' + nameOf(v, v.winner) + ' wins ' + v.scores[v.winner] + ' : ' + v.scores[1 - v.winner] + '!' +
        '<div class="sub">' + [0, 1].map(function (s) { return nameOf(v, s) + ': fastest ' + (v.fastest[s] === null ? '–' : (v.fastest[s] / 1000).toFixed(1) + ' s'); }).join(' · ') + '</div>' +
        '<div class="sub">Rematch or head back to the lobby from your phones.</div></div>';
    }
    return line;
  }

  Ark.register('host', 'anagram-duel', {
    sounds: function (prev, v) {
      if (v.phase === 'play' && prev.phase !== 'play') return ['go'];
      if (v.phase !== prev.phase && v.result && prev.phase === 'play') return [v.result.winner === null ? 'wrong' : 'correct'];
      return [];
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'ad-host';
      el.appendChild(root);
    },
    update: function (v) {
      const k = JSON.stringify([v.phase, v.round, v.scores, v.letters, v.progress, v.result]);
      if (k === key) return;
      key = k;
      root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) + '<div class="ad-main">' + middle(v) + '</div>';
    },
    unmount: function () {
      root = null;
      key = '';
    },
  });
})();
