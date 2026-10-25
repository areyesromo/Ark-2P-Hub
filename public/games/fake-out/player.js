// Fake Out on the phone (server/games/fake-out.js): write your fake (or use your ready-made one),
// then pick the answer you think is real (your own fake isn't offered), then see how you did.
(function () {
  Ark.loadCss('/games/fake-out/style.css');
  const esc = Ark.escapeHtml;

  let root = null;
  let api = null;
  let lastKey = '';
  let lastTries = 0;

  function send() {
    const input = root && root.querySelector('.fo-input');
    if (!input || !input.value.trim()) return;
    api.send({ type: 'fake', text: input.value });
    api.vibrate(20);
  }

  function onClick(e) {
    if (e.target.closest('.fo-send')) return send();
    if (e.target.closest('.fo-suggest')) {
      api.send({ type: 'suggest' });
      api.vibrate(20);
      return;
    }
    const pick = e.target.closest('[data-option]');
    if (pick && !pick.disabled) {
      api.send({ type: 'pick', option: Number(pick.getAttribute('data-option')) });
      api.vibrate(20);
      return;
    }
    if (e.target.closest('.rematch')) api.send({ type: 'rematch' });
  }

  function onKey(e) {
    if (e.key === 'Enter' && e.target.classList.contains('fo-input')) {
      e.preventDefault();
      send();
    }
  }

  function score(v) {
    return '<div class="score">You ' + v.scores[v.you] + ' – ' + v.scores[1 - v.you] + ' Them' +
      (v.round ? ' · Round ' + v.round + '/' + v.rounds + (v.last ? ' ⭐×2' : '') : '') + '</div>';
  }

  function render(v) {
    const me = v.you;
    if (v.phase === 'countdown') {
      return score(v) + '<div class="fo-wait"><div class="big">' + (v.countdown || '') + '</div><p>Get ready to lie! The fact shows on the TV and here.</p></div>';
    }
    if (v.phase === 'over') {
      const text = v.draw ? 'Draw! 🤝' : v.winner === me ? 'You win! 🏆' : 'You lose';
      return score(v) + '<div class="fo-wait"><div class="outcome ' + (v.draw ? '' : v.winner === me ? 'won' : 'lost') + '">' + text + '</div>' +
        '<button class="primary rematch">Rematch</button></div>';
    }
    const fact = '<div class="fo-q">' + esc(v.question).split('___').join('<span class="fo-blank"></span>') + '</div>';
    if (v.phase === 'write') {
      if (v.yourFake) {
        return score(v) + fact + '<div class="fo-wait"><p>Your fake:</p><div class="fo-mine">“' + esc(v.yourFake) + '”</div><p>' +
          (v.written[1 - me] ? 'Both in!' : 'Waiting for the other player…') + '</p></div>';
      }
      const note = v.notice === 'truth' ? '<p class="lost">That\'s actually the truth! Write a fake one.</p>'
        : v.notice === 'empty' ? '<p class="lost">Use some letters or numbers.</p>'
          : '<p class="msg">Write a fake answer that sounds true.</p>';
      return score(v) + fact + note +
        (v.peeked ? '<p class="msg">You know the truth now, so finding it won\'t score this round.</p>' : '') +
        '<div class="fo-write"><input class="fo-input" type="text" maxlength="40" autocomplete="off" autocapitalize="off" enterkeyhint="send" placeholder="Your fake answer">' +
        '<button class="primary fo-send">Send</button></div>' +
        '<button class="ghost fo-suggest">Stuck? Use “' + esc(v.suggestion) + '”</button>' +
        '<p class="msg fo-other">' + (v.written[1 - me] ? 'The other player has written theirs.' : '') + '</p>';
    }
    if (v.phase === 'pick') {
      const picked = v.yourPick !== null;
      return score(v) + fact + '<p class="msg">' + (picked ? 'Locked in. Waiting for the other player…' : 'Which one is real?') + '</p>' +
        '<div class="fo-picks">' + v.options.map(function (o) {
          if (o.mine) return '<button class="mine" disabled>' + esc(o.text) + ' <small>(your fake)</small></button>';
          return '<button data-option="' + o.i + '" class="' + (v.yourPick === o.i ? 'picked' : picked ? 'dim' : '') + '"' + (picked ? ' disabled' : '') + '>' + esc(o.text) + '</button>';
        }).join('') + '</div>';
    }
    // The reveal: what you picked, then (once the truth is out) how the round went.
    const done = v.step >= v.reveal.length;
    let mine = '';
    if (done) {
      const truth = v.reveal.find(function (r) { return r.kind === 'truth'; });
      const found = truth.pickedBy.indexOf(me) !== -1;
      const fooledThem = v.reveal.some(function (r) { return r.kind === 'fake' && r.authors.indexOf(me) !== -1 && r.pickedBy.indexOf(1 - me) !== -1; });
      mine = '<p class="' + (found ? 'won' : 'lost') + '">' + (found ? '✅ You found the truth' + (v.peeked ? ' (no points: you peeked)' : '') : '❌ The truth was “' + esc(truth.text) + '”') + '</p>' +
        (fooledThem ? '<p class="won">🤥 Your fake fooled them!</p>' : '') +
        (v.gained[me] ? '<p class="won">+' + v.gained[me] + '</p>' : '');
    }
    return score(v) + fact + '<div class="fo-wait"><p>Watch the TV…</p>' + mine + '</div>';
  }

  Ark.register('player', 'fake-out', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'fo-phone';
      root.addEventListener('click', onClick);
      root.addEventListener('keydown', onKey);
      el.appendChild(root);
    },
    update: function (v) {
      // While you're typing, the other player sending theirs only changes a line of text: the box
      // isn't redrawn under your fingers (the keyboard would close mid-word).
      const typing = v.phase === 'write' && !v.yourFake;
      const key = JSON.stringify([v.phase, v.round, v.countdown, v.yourFake, v.notice, v.tries, v.yourPick, v.step, v.scores, typing ? null : v.written]);
      const other = root.querySelector('.fo-other');
      if (other && typing) other.textContent = v.written[1 - v.you] ? 'The other player has written theirs.' : '';
      if (key === lastKey) return;
      const refused = v.tries !== lastTries;
      lastTries = v.tries;
      lastKey = key;
      // Keep whatever you were typing when the screen redraws (but not a fake that was just turned down).
      const input = root.querySelector('.fo-input');
      const typed = input && !refused ? input.value : '';
      const focused = input && document.activeElement === input;
      root.innerHTML = render(v);
      const again = root.querySelector('.fo-input');
      if (again) {
        again.value = typed;
        if (focused) again.focus();
      }
    },
    unmount: function () {
      root = null;
      lastKey = '';
      lastTries = 0;
    },
  });
})();
