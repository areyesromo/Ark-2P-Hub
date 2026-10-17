(function () {
  Ark.loadCss('/games/dice-party/style.css');
  Ark.loadCss('/shared/dice.css');
  const diceReady = Ark.loadScript('/shared/dice.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let api = null;
  let view = null;
  let key = '';
  let pick = null; // box id waiting for a confirm tap

  function render(v) {
    view = v;
    if (!window.ArkDice || !root) return;
    const me = v.you;
    const myTurn = v.phase === 'turn' && v.turn === me;
    const rolled = v.rollsLeft < 3;
    if (!myTurn || !(pick in v.options)) pick = null;
    const k = JSON.stringify([v.phase, v.turn, v.dice, v.held, v.rollsLeft, v.cards, pick]);
    if (k === key) return;
    key = k;
    let html = '';
    if (v.phase === 'over') {
      html += '<div class="dp-big">' + (v.draw ? 'A draw 🤝' : v.winner === me ? 'You win! 🏆' : 'You lose') + '</div>' +
        '<p class="dp-info">' + v.scores[me] + ' to ' + v.scores[1 - me] + '</p><button class="primary dp-rematch">Rematch</button>';
      root.innerHTML = html;
      return;
    }
    html += '<p class="dp-info">Round ' + v.round + ' of ' + v.rounds + ' · You ' + v.scores[me] + ' · Them ' + v.scores[1 - me] + '</p>';
    html += '<div class="dp-dice">' + v.dice.map(function (d, i) {
      return '<button class="dp-die" data-die="' + i + '"' + (myTurn && rolled ? '' : ' disabled') + '>' + ArkDice.html(d, v.held[i] ? 'held' : '') + (v.held[i] ? '<b>HELD</b>' : '') + '</button>';
    }).join('') + '</div>';
    if (!myTurn) {
      root.innerHTML = html + '<p class="dp-info">Their turn…</p>';
      return;
    }
    html += '<button class="primary dp-roll"' + (v.rollsLeft ? '' : ' disabled') + '>' +
      (v.rollsLeft ? '🎲 Roll (' + v.rollsLeft + ' left)' : 'No rolls left') + '</button>';
    if (rolled) {
      html += '<p class="dp-info">Tap dice to hold them · pick a box to score</p><div class="dp-boxes">' + v.boxes.filter(function (b) { return b.id in v.options; }).map(function (b) {
        const pts = v.options[b.id];
        return '<button class="dp-box' + (pick === b.id ? ' on' : '') + (pts ? '' : ' zero') + '" data-box="' + b.id + '"><span>' + esc(b.name) + '</span><strong>' + pts + '</strong></button>';
      }).join('') + '</div>';
      if (pick) {
        const b = v.boxes.find(function (x) { return x.id === pick; });
        html += '<button class="primary dp-score">Score ' + v.options[pick] + ' in ' + esc(b.name) + '</button>';
      }
    }
    root.innerHTML = html;
  }

  Ark.register('player', 'dice-party', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'dp-phone';
      el.appendChild(root);
      root.addEventListener('click', function (e) {
        const b = e.target.closest('button');
        if (!b || b.disabled || !view) return;
        if (b.hasAttribute('data-die')) { api.send({ type: 'hold', die: Number(b.getAttribute('data-die')) }); api.vibrate(10); return; }
        if (b.classList.contains('dp-roll')) { api.send({ type: 'roll' }); api.vibrate(30); return; }
        if (b.classList.contains('dp-score')) { api.send({ type: 'score', box: pick }); pick = null; api.vibrate(20); return; }
        if (b.classList.contains('dp-rematch')) return api.send({ type: 'rematch' });
        if (b.hasAttribute('data-box')) {
          pick = b.getAttribute('data-box');
          key = '';
          render(view);
        }
      });
      diceReady.then(function () { if (view) { key = ''; render(view); } });
    },
    update: render,
    unmount: function () { root = view = pick = null; key = ''; },
  });
})();
