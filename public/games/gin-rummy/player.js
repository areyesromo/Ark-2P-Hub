(function () {
  Ark.loadCss('/games/gin-rummy/style.css');
  const ready = Ark.loadScript('/games/gin-rummy/cards.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let picked = null; // the card picked to throw away
  let buzzed = '';

  function onClick(e) {
    if (!view) return;
    const v = view;
    if (e.target.closest('.rematch')) return api.send({ type: 'rematch' });
    if (e.target.closest('.gr-next')) { api.send({ type: 'next' }); return; }
    const mine = v.turn === v.you;
    const from = e.target.closest('[data-from]');
    if (from && mine && v.phase === 'draw') {
      api.send({ type: 'draw', from: from.getAttribute('data-from') });
      api.vibrate(15);
      from.classList.add('taking');
      return;
    }
    const act = e.target.closest('[data-act]');
    if (act && !act.disabled && picked) {
      api.send({ type: act.getAttribute('data-act'), card: picked });
      api.vibrate(act.getAttribute('data-act') === 'knock' ? [40, 30, 40] : 15);
      picked = null;
      Ark.showPick(act, 'data-act');
      return;
    }
    const c = e.target.closest('[data-card]');
    if (c && mine && v.phase === 'discard') {
      const card = c.getAttribute('data-card');
      if (card === v.took) return api.vibrate([20, 30, 20]); // (not straight back)
      picked = picked === card ? null : card;
      render();
    }
  }

  /** Your hand: melds together, then the rest, each card a button when you're throwing one away. */
  function handHtml(v) {
    const throwing = v.phase === 'discard' && v.turn === v.you;
    const inMeld = new Set(v.melds.flat());
    const groups = v.melds.map(function (m) { return m.slice().sort(function (a, b) { return ArkGin.rank(a) - ArkGin.rank(b); }); });
    const rest = v.cards.filter(function (c) { return !inMeld.has(c); }).sort(function (a, b) {
      return a.slice(-1).localeCompare(b.slice(-1)) || ArkGin.rank(a) - ArkGin.rank(b);
    });
    const one = function (c) {
      const knockable = throwing && v.after && v.after[c] !== undefined && v.after[c] <= 10;
      const cls = (picked === c ? 'picked' : '') + (c === v.took ? ' took' : '') + (knockable ? ' knockable' : '');
      return ArkGin.card(c, cls, ' data-card="' + c + '"');
    };
    let html = '<div class="gr-hand">';
    groups.forEach(function (g) { html += '<div class="gr-group meld">' + g.map(one).join('') + '</div>'; });
    // The rest by suit (runs are easier to spot, and the groups wrap on a narrow phone).
    ['S', 'H', 'D', 'C'].forEach(function (suit) {
      const of = rest.filter(function (c) { return c.slice(-1) === suit; });
      if (of.length) html += '<div class="gr-group dead">' + of.map(one).join('') + '</div>';
    });
    return html + '</div>';
  }

  function controls(v) {
    const me = v.you;
    if (v.phase === 'over') return '<button class="primary rematch">Rematch</button>';
    if (v.phase === 'show') return '<button class="gr-btn go gr-next"' + (v.ready && v.ready[me] ? ' disabled' : '') + '>' + (v.ready && v.ready[me] ? 'Waiting for them…' : 'Next hand') + '</button>';
    if (v.turn !== me || v.phase !== 'discard') return '';
    const left = picked && v.after ? v.after[picked] : null;
    const can = left !== null && left !== undefined && left <= 10;
    return '<div class="gr-btns"><button class="gr-btn" data-act="discard"' + (picked ? '' : ' disabled') + '>Throw away</button>' +
      '<button class="gr-btn knock' + (left === 0 ? ' gin' : '') + '" data-act="knock"' + (can ? '' : ' disabled') + '>' +
      (left === 0 ? 'Gin! 🎉' : can ? 'Knock (' + left + ')' : 'Knock') + '</button></div>';
  }

  function message(v) {
    const me = v.you;
    if (v.phase === 'over') return v.winner === me ? '<span class="won big ark-result">You win! 🏆</span>' : v.winner === null ? '<span class="ark-result draw big">A draw!</span>' : '<span class="lost big ark-result">You lose</span>';
    if (v.phase === 'show') {
      const r = v.result;
      if (r.draw) return 'The deck ran out: no score this hand';
      const what = { gin: 'Gin', undercut: 'Undercut', knock: 'Knock' }[r.kind];
      return (r.winner === me ? '<span class="won">' : '<span class="lost">') + what + '! ' + (r.winner === me ? 'You score ' : 'They score ') + r.points + '</span>';
    }
    if (v.turn !== me) return 'Their turn…';
    if (v.phase === 'draw') return '<strong>Your turn!</strong> Take from the deck or the pile';
    return picked ? (v.after[picked] <= 10 ? 'Throw it away, or knock with it' : 'Throw it away?') : 'Tap a card to throw away';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const me = v.you;
    const mine = v.turn === me && v.phase === 'draw';
    const top = v.pile[v.pile.length - 1];
    let table = '';
    if (v.phase === 'show' && v.result && !v.result.draw) {
      table = '<div class="gr-reveal"><small>Theirs</small>' + ArkGin.shownHtml(v.result.shown[1 - me], { short: true }) + '</div>';
    } else if (v.phase !== 'over') {
      table = '<div class="gr-table">' +
        '<button class="gr-take' + (mine ? ' on' : '') + '" data-from="stock"' + (mine ? '' : ' disabled') + '>' + ArkGin.card(null) + '<small>Deck · ' + v.stock + '</small></button>' +
        '<button class="gr-take' + (mine && top ? ' on' : '') + '" data-from="pile"' + (mine && top ? '' : ' disabled') + '>' + (top ? ArkGin.card(top) : '<div class="gr-card empty"></div>') + '<small>Pile</small></button>' +
        '</div>';
    }
    root.innerHTML =
      '<div class="gr-top"><span>You <b>' + v.scores[me] + '</b> · Them <b>' + v.scores[1 - me] + '</b> <small>to ' + v.target + '</small></span>' +
      '<span class="gr-dw' + (v.points <= 10 ? ' low' : '') + '">' + (v.points === 0 ? 'Gin hand!' : 'Left over ' + v.points) + '</span></div>' +
      '<p class="gr-msg">' + message(v) + (v.timed && v.timeLeftMs && v.turn === me && (v.phase === 'draw' || v.phase === 'discard') ? ' <small>' + Math.ceil(v.timeLeftMs / 1000) + 's</small>' : '') + '</p>' +
      table + handHtml(v) + controls(v);
  }

  Ark.register('player', 'gin-rummy', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'gr-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      const prev = view;
      view = v;
      if (picked && (!v.cards.includes(picked) || v.phase !== 'discard')) picked = null;
      if (prev && v.turn === v.you && v.phase === 'draw' && (prev.turn !== v.you || prev.phase !== 'draw')) api.vibrate(40);
      if ((v.phase === 'show' || v.phase === 'over') && buzzed !== v.hand + v.phase && v.result && !v.result.draw) {
        buzzed = v.hand + v.phase;
        api.vibrate(v.result.winner === v.you ? [60, 40, 60] : 200);
      }
      render();
    },
    unmount: function () {
      root = view = null;
      picked = null;
      buzzed = '';
    },
  });
})();
