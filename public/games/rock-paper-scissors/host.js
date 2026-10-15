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
    return '<div class="' + cls + '"><div class="emoji">' + emoji + '</div><div class="caption">' + caption + '</div></div>';
  }

  function banner(view) {
    const nameOf = function (slot) {
      return '<span class="p' + (slot + 1) + '-text">' + esc(view.players[slot].name) + '</span>';
    };
    if (view.phase === 'choose') return 'Make your pick on your phone';
    if (view.phase === 'over') return '🏆 ' + nameOf(view.winner) + ' wins the match!';
    if (view.roundWinner === null) return 'Draw!';
    return nameOf(view.roundWinner) + ' takes the round';
  }

  Ark.register('host', 'rock-paper-scissors', {
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
