(function () {
  Ark.loadCss('/games/rock-paper-scissors/style.css');
  const esc = Ark.escapeHtml;
  const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' };
  let root = null;

  function hand(view, slot) {
    const pick = view.picks[slot];
    let cls = 'rps-hand p' + (slot + 1);
    let emoji = '🤔';
    let caption = 'Choosing…';
    if (pick) {
      emoji = EMOJI[pick];
      caption = pick.charAt(0).toUpperCase() + pick.slice(1);
      if (view.roundWinner === slot) cls += ' win';
      else if (view.roundWinner !== null) cls += ' lose';
    } else if (view.locked[slot]) {
      cls += ' locked';
      emoji = '🔒';
      caption = 'Locked in';
    }
    // A controller player still choosing gets the buttons right in their block, big.
    const keys = !pick && !view.locked[slot] && view.phase === 'choose' && view.players[slot].local
      ? '<div class="keys"><span><b>X</b>✊</span><span><b>Y</b>✋</span><span><b>B</b>✌️</span></div>'
      : '';
    return '<div class="' + cls + '"><div class="emoji">' + emoji + '</div><div class="caption">' + caption + '</div>' + keys + '</div>';
  }

  function banner(view) {
    const nameOf = function (slot) {
      return '<span class="p' + (slot + 1) + '-text">' + esc(view.players[slot].name) + '</span>';
    };
    if (view.phase === 'choose') return 'Make your picks!';
    if (view.phase === 'over') return '🏆 ' + nameOf(view.winner) + ' wins the match!';
    if (view.roundWinner === null) return 'Draw!';
    return nameOf(view.roundWinner) + ' takes the round';
  }

  // Controller players: left / top / right face button (or D-pad) = rock / paper / scissors.
  const PAD_PICKS = { X: 'rock', LEFT: 'rock', Y: 'paper', UP: 'paper', B: 'scissors', RIGHT: 'scissors' };

  Ark.register('host', 'rock-paper-scissors', {
    // Sound: a click as each player locks in, a chime at the reveal.
    sounds: function (prev, v) {
      const out = [];
      if (v.locked.filter(Boolean).length > prev.locked.filter(Boolean).length) out.push('lock');
      if (prev.phase === 'choose' && v.phase !== 'choose') out.push('reveal');
      return out;
    },
    padHint: 'X ✊ Rock · Y ✋ Paper · B ✌️ Scissors (or D-pad ← ↑ →) · A: rematch at the end',
    pad: function (btn, view) {
      if (view.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (view.phase === 'choose' && PAD_PICKS[btn]) return { type: 'pick', choice: PAD_PICKS[btn] };
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'rps-host';
      el.appendChild(root);
    },
    update: function (view) {
      root.innerHTML =
        Ark.scoreboardHtml(view.players, view.scores, view.winScore, view.round) +
        '<div class="rps-arena">' + hand(view, 0) + '<div class="rps-vs">VS</div>' + hand(view, 1) + '</div>' +
        '<div class="rps-banner">' + banner(view) + '</div>';
    },
    unmount: function () { root = null; },
  });
})();
