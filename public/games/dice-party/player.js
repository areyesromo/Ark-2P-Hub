// Dice Party on the phone (server/games/dice-party.js). On the TV screen: your dice, Roll, and
// the boxes you could score (the scorecard is on the TV). On the Handheld screen: the whole
// scorecard on top (tap a box in your column, then again to score it), the dice and Roll in a
// tray at the bottom under your thumb, so no TV is needed.
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

  /** The dice, tappable to hold on your turn once you've rolled. */
  function diceRow(v, mine) {
    return '<div class="dp-dice">' + v.dice.map(function (d, i) {
      return '<button class="dp-die" data-die="' + i + '"' + (mine && v.rollsLeft < 3 ? '' : ' disabled') + '>' + ArkDice.html(d, v.held[i] ? 'held' : '') + (v.held[i] ? '<b>HELD</b>' : '') + '</button>';
    }).join('') + '</div>';
  }

  /** Handheld: the whole scorecard (you first), then the tray with the dice and Roll / Score. */
  function handheld(v) {
    const me = v.you;
    const them = 1 - me;
    const myTurn = v.phase === 'turn' && v.turn === me;
    const theirTurn = v.phase === 'turn' && v.turn === them;
    const fresh = function (slot, b) { return v.last && v.last.by === slot && v.last.box === b.name ? ' fresh' : ''; };
    let rows = '';
    v.boxes.forEach(function (b, i) {
      if (i === 6) {
        rows += '<tr class="sum"><td>Bonus <span class="muted">' + v.bonus.at + '+ up top</span></td>' + [me, them].map(function (s) {
          const t = v.totals[s];
          return '<td>' + (t.bonus ? '+' + t.bonus : '<span class="muted">' + t.upper + '/' + v.bonus.at + '</span>') + '</td>';
        }).join('') + '</tr>';
      }
      const mine = v.cards[me][b.id];
      let my = '';
      if (mine !== undefined) my = '<td class="got' + fresh(me, b) + '">' + mine + '</td>';
      else if (myTurn && b.id in v.options) my = '<td><button class="dp-pick' + (pick === b.id ? ' on' : '') + (v.options[b.id] ? '' : ' zero') + '" data-box="' + b.id + '">' + v.options[b.id] + '</button></td>';
      else my = '<td></td>';
      const theirs = v.cards[them][b.id];
      const their = theirs !== undefined ? '<td class="got' + fresh(them, b) + '">' + theirs + '</td>'
        : theirTurn && b.id in v.options ? '<td class="opt' + (v.options[b.id] ? '' : ' zero') + '">' + v.options[b.id] + '</td>' : '<td></td>';
      rows += '<tr' + (pick === b.id ? ' class="cur"' : '') + '><td>' + esc(b.name) + '</td>' + my + their + '</tr>';
    });
    rows += '<tr class="total"><td>Total</td><td>' + v.scores[me] + '</td><td>' + v.scores[them] + '</td></tr>';
    const table = '<div class="dp-scroll"><table class="dp-card dp-mini"><tr><th>Round ' + v.round + '/' + v.rounds + '</th><th class="p' + (me + 1) + '-text">You</th><th class="p' + (them + 1) + '-text">Them</th></tr>' + rows + '</table></div>';
    let tray;
    if (v.phase === 'over') {
      tray = '<div class="dp-big">' + (v.draw ? 'A draw 🤝' : v.winner === me ? 'You win! 🏆' : 'You lose') + '</div><button class="primary dp-rematch">Rematch</button>';
    } else {
      const lastLine = v.last ? (v.last.by === me ? 'You' : 'They') + ' scored ' + v.last.points + ' in ' + esc(v.last.box) : '';
      const status = myTurn ? (v.rollsLeft === 3 ? '<strong>Your turn:</strong> roll!' : v.rollsLeft ? 'Tap dice to hold · tap a box (twice) to score' : 'No rolls left: pick a box')
        : 'Their turn…' + (lastLine ? ' · ' + lastLine : '');
      let buttons = '';
      if (myTurn) {
        buttons = pick
          ? '<button class="primary dp-score">Score ' + v.options[pick] + ' in ' + esc(v.boxes.find(function (x) { return x.id === pick; }).name) + '</button>'
          : '<button class="primary dp-roll"' + (v.rollsLeft ? '' : ' disabled') + '>' + (v.rollsLeft ? '🎲 Roll (' + v.rollsLeft + ' left)' : 'No rolls left') + '</button>';
      }
      tray = '<p class="dp-info">' + status + '</p>' + (v.rollsLeft < 3 || myTurn ? diceRow(v, myTurn) : '') + buttons;
    }
    return table + '<div class="dp-tray">' + tray + '</div>';
  }

  function render(v) {
    view = v;
    if (!window.ArkDice || !root) return;
    const me = v.you;
    const myTurn = v.phase === 'turn' && v.turn === me;
    const rolled = v.rollsLeft < 3;
    if (!myTurn || !(pick in v.options)) pick = null;
    const k = JSON.stringify([v.handheld, v.phase, v.turn, v.dice, v.held, v.rollsLeft, v.cards, pick]);
    if (k === key) return;
    key = k;
    root.classList.toggle('handheld', Boolean(v.handheld));
    if (v.handheld) {
      root.innerHTML = handheld(v);
      return;
    }
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
          const box = b.getAttribute('data-box');
          // Handheld: a second tap on the same box scores it.
          if (view.handheld && pick === box) { api.send({ type: 'score', box: box }); pick = null; api.vibrate(20); return; }
          pick = box;
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
