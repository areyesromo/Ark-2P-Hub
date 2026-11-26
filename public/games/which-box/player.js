(function () {
  Ark.loadCss('/games/which-box/style.css');
  let root = null;
  let api = null;

  function onClick(e) {
    const b = e.target.closest('[data-box]');
    if (b && !b.disabled) {
      api.send({ type: 'pick', box: Number(b.getAttribute('data-box')) });
      api.vibrate(20);
      Ark.showPick(b, 'data-box');
      return;
    }
    if (e.target.closest('.rematch')) api.send({ type: 'rematch' });
  }

  function render(v) {
    const you = v.you;
    const hiding = v.hider === you;
    const score = '<div class="wb-score">You ' + v.scores[you] + ' – ' + v.scores[1 - you] + ' Them · round ' + Math.min(v.round, v.rounds) + ' of ' + v.rounds + '</div>';
    if (v.phase === 'pick') {
      const msg = v.mine !== null
        ? 'Locked in. ' + (v.locked[1 - you] ? 'Opening…' : 'Waiting for them…')
        : hiding ? '🙈 <strong>Hide the prize.</strong> They\'ll try to find it.' : '🔎 <strong>Which box is it in?</strong>';
      let html = score + '<p class="wb-msg">' + msg + '</p><div class="wb-picks">';
      for (let b = 0; b < 3; b++) {
        const cls = v.mine === b ? 'picked' : v.mine !== null ? 'dim' : '';
        html += '<button data-box="' + b + '" class="' + cls + '"' + (v.mine !== null ? ' disabled' : '') + '>' +
          (v.mine === b && hiding ? '🎁' : '📦') + '<span>Box ' + (b + 1) + '</span></button>';
      }
      return html + '</div>';
    }
    if (v.phase === 'over') {
      const res = v.winner === null ? '<div class="wb-out ark-result draw">A draw!</div>'
        : '<div class="wb-out ark-result ' + (v.winner === you ? 'won">You win the match! 🏆' : 'lost">You lose the match') + '</div>';
      return score + res + '<button class="primary rematch">Rematch</button>';
    }
    const r = v.result;
    let line;
    if (r.point === null) line = 'Nobody picked';
    else if (r.point === you) line = r.found ? 'You found it! +1' : r.sought === null ? 'They didn\'t look: +1' : 'They missed it! +1';
    else line = r.found ? (r.hid === null ? 'You didn\'t hide it: they get it' : 'They found it') : 'Empty box';
    const where = r.hid === null ? 'not hidden' : 'box ' + (r.hid + 1);
    return score + '<div class="wb-big">' + (r.found ? '🎁' : '💨') + '</div>' +
      '<div class="wb-out ' + (r.point === you ? 'won' : r.point === null ? '' : 'lost') + '">' + line + '</div>' +
      '<p class="wb-msg">The prize: ' + where + ' · looked in: ' + (r.sought === null ? 'nothing' : 'box ' + (r.sought + 1)) + '</p>';
  }

  Ark.register('player', 'which-box', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'wb-phone';
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
