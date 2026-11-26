(function () {
  Ark.loadCss('/games/odd-even/style.css');
  const HANDS = ['', '☝️', '✌️', '🤟', '🖖', '🖐️'];
  let root = null;
  let api = null;

  function onClick(e) {
    const b = e.target.closest('[data-n]');
    if (b && !b.disabled) {
      api.send({ type: 'pick', fingers: Number(b.getAttribute('data-n')) });
      api.vibrate(20);
      Ark.showPick(b, 'data-n');
      return;
    }
    if (e.target.closest('.rematch')) api.send({ type: 'rematch' });
  }

  function render(v) {
    const you = v.you;
    const mineOdd = v.odd === you;
    const score = '<div class="oe-score">You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them · first to ' + v.winScore + '</div>';
    const role = '<div class="oe-me ' + (mineOdd ? 'odd' : 'even') + '">You\'re <b>' + (mineOdd ? 'ODD' : 'EVEN') + '</b></div>';
    if (v.phase === 'pick') {
      const msg = v.mine !== null
        ? 'Locked in. ' + (v.locked[1 - you] ? 'Showing…' : 'Waiting for them…')
        : 'You want the total to be <strong>' + (mineOdd ? 'odd' : 'even') + '</strong>. How many fingers?';
      let html = score + role + '<p class="oe-msg">' + msg + '</p><div class="oe-picks">';
      for (let n = 1; n <= 5; n++) {
        const cls = v.mine === n ? 'picked' : v.mine !== null ? 'dim' : '';
        html += '<button data-n="' + n + '" class="' + cls + '"' + (v.mine !== null ? ' disabled' : '') + '>' + HANDS[n] + '<span>' + n + '</span></button>';
      }
      return html + '</div>';
    }
    if (v.phase === 'over') {
      return score + '<div class="oe-out ark-result ' + (v.winner === you ? 'won">You win the match! 🏆' : 'lost">You lose the match') + '</div>' +
        '<button class="primary rematch">Rematch</button>';
    }
    const r = v.result;
    const line = r.point === null ? 'No point' : r.point === you ? 'Your point!' : 'Their point';
    const show = (n) => (n ? n : '⌛');
    return score + role +
      '<div class="oe-sum">' + show(r.picks[you]) + ' + ' + show(r.picks[1 - you]) + (r.total === null ? '' : ' = <b>' + r.total + '</b>') + '</div>' +
      '<div class="oe-out ' + (r.point === you ? 'won' : r.point === null ? '' : 'lost') + '">' + (r.total === null ? 'Out of time' : r.total % 2 ? 'Odd' : 'Even') + ' · ' + line + '</div>';
  }

  Ark.register('player', 'odd-even', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'oe-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
    },
    update: function (v) {
      root.innerHTML = render(v);
      Ark.phoneClock(v.phase === 'pick' && v.timed && v.mine === null ? v.timeLeftMs : 0);
    },
    unmount: function () { Ark.phoneClock(0); root = null; },
  });
})();
