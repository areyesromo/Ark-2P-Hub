(function () {
  Ark.loadCss('/games/rock-paper-scissors/style.css');
  const CHOICES = [
    { id: 'rock', emoji: '✊', label: 'Rock' },
    { id: 'paper', emoji: '✋', label: 'Paper' },
    { id: 'scissors', emoji: '✌️', label: 'Scissors' },
  ];
  const EMOJI = { rock: '✊', paper: '✋', scissors: '✌️' };
  let root = null;
  let api = null;

  function onClick(e) {
    const pick = e.target.closest('[data-pick]');
    if (pick && !pick.disabled) {
      api.send({ type: 'pick', choice: pick.getAttribute('data-pick') });
      api.vibrate(20);
      return;
    }
    if (e.target.closest('.rematch')) api.send({ type: 'rematch' });
  }

  function render(v) {
    const you = v.you;
    const score = '<div class="score">You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them · first to ' + v.winScore + '</div>';

    if (v.phase === 'choose') {
      const msg = v.yourPick
        ? 'Locked in. ' + (v.opponentLocked ? 'Revealing…' : 'Waiting for your opponent…')
        : v.opponentLocked
          ? '<strong>They\'ve picked!</strong> Your turn.'
          : 'Pick one. It stays secret until you both lock in.';
      return (
        score + '<p class="msg">' + msg + '</p>' +
        '<div class="rps-choices">' +
        CHOICES.map(function (c) {
          const picked = v.yourPick === c.id;
          return (
            '<button data-pick="' + c.id + '" class="' + (picked ? 'picked' : '') + '"' + (v.yourPick ? ' disabled' : '') + '>' +
            c.emoji + '<span>' + c.label + '</span></button>'
          );
        }).join('') +
        '</div>'
      );
    }

    let outcome = 'Draw';
    let cls = '';
    if (v.roundWinner !== null) {
      cls = v.roundWinner === you ? 'won' : 'lost';
      outcome = v.roundWinner === you ? 'You win the round' : 'They win the round';
    }
    if (v.phase === 'over') {
      cls = v.winner === you ? 'won' : 'lost';
      outcome = v.winner === you ? 'You win the match! 🏆' : 'You lose the match';
    }
    return (
      score +
      '<div class="rps-big">' + EMOJI[v.yourPick] + ' vs ' + EMOJI[v.opponentPick] + '</div>' +
      '<div class="rps-outcome ' + cls + '">' + outcome + '</div>' +
      (v.phase === 'over' ? '<button class="primary rematch">Rematch</button>' : '')
    );
  }

  Ark.register('player', 'rock-paper-scissors', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'rps-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
    },
    update: function (v) {
      root.innerHTML = render(v);
    },
    unmount: function () { root = null; },
  });
})();
