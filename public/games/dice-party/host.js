(function () {
  Ark.loadCss('/games/dice-party/style.css');
  Ark.loadCss('/shared/dice.css');
  const diceReady = Ark.loadScript('/shared/dice.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let key = '';
  const cursors = [null, null]; // controller players: { die, box }

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function openBoxes(v) {
    return v.boxes.filter(function (b) { return v.cards[v.turn][b.id] === undefined; });
  }

  function cursorFor(v) {
    const c = cursors[v.turn];
    if (!c) return null;
    const open = openBoxes(v);
    if (!open.some(function (b) { return b.id === c.box; })) c.box = open.length ? open[0].id : null;
    return c;
  }

  function dice(v, c) {
    return v.dice.map(function (d, i) {
      return '<span class="dp-slot' + (c && c.die === i ? ' cur' : '') + '">' + ArkDice.html(d, v.held[i] ? 'held' : '') +
        (v.held[i] ? '<b>HELD</b>' : '') + '</span>';
    }).join('');
  }

  function card(v, c) {
    let rows = '';
    v.boxes.forEach(function (b, i) {
      if (i === 6) {
        rows += '<tr class="sum"><td>Bonus <span class="muted">(' + v.bonus.at + '+ up top)</span></td>' + [0, 1].map(function (s) {
          const t = v.totals[s];
          return '<td>' + (t.bonus ? '+' + t.bonus : '<span class="muted">' + t.upper + '/' + v.bonus.at + '</span>') + '</td>';
        }).join('') + '</tr>';
      }
      rows += '<tr' + (c && c.box === b.id ? ' class="cur"' : '') + '><td>' + esc(b.name) + '</td>' + [0, 1].map(function (s) {
        const got = v.cards[s][b.id];
        if (got !== undefined) return '<td class="got' + (v.last && v.last.by === s && v.last.box === b.name ? ' fresh' : '') + '">' + got + '</td>';
        if (v.phase === 'turn' && s === v.turn && b.id in v.options) return '<td class="opt' + (v.options[b.id] ? '' : ' zero') + '">' + v.options[b.id] + '</td>';
        return '<td></td>';
      }).join('') + '</tr>';
    });
    rows += '<tr class="total"><td>Total</td><td>' + v.scores[0] + '</td><td>' + v.scores[1] + '</td></tr>';
    return '<table class="dp-card"><tr><th></th><th>' + nameOf(v, 0) + '</th><th>' + nameOf(v, 1) + '</th></tr>' + rows + '</table>';
  }

  function status(v) {
    if (v.phase === 'over') {
      return '<div class="title">' + (v.draw ? '🤝 A draw!' : '🏆 ' + nameOf(v, v.winner) + ' wins!') + '</div>' +
        '<p class="muted">Rematch on a phone or press A (or ⚙ change the settings).</p>';
    }
    const last = v.last ? '<div class="sub">' + nameOf(v, v.last.by) + ' scored <strong>' + v.last.points + '</strong> in ' + esc(v.last.box) + '</div>' : '';
    return '<div class="sub">Round ' + v.round + ' of ' + v.rounds + '</div>' +
      '<div class="title">' + nameOf(v, v.turn) + '\'s turn</div>' +
      '<div class="sub">' + (v.rollsLeft === 3 ? 'Roll the dice!' : v.rollsLeft ? v.rollsLeft + ' roll' + (v.rollsLeft > 1 ? 's' : '') + ' left · hold, roll, or score' : 'No rolls left: pick a box') + '</div>' + last;
  }

  function render() {
    const v = view;
    if (!window.ArkDice || !root || !v) return;
    const c = v.phase === 'turn' ? cursorFor(v) : null;
    const k = JSON.stringify([v.phase, v.turn, v.dice, v.held, v.rollsLeft, v.cards, c]);
    if (k === key) return;
    key = k;
    root.innerHTML = '<div class="dp-play">' + status(v) + (v.phase === 'turn' ? '<div class="dp-dice">' + dice(v, c) + '</div>' : '') + '</div>' + card(v, c);
  }

  Ark.register('host', 'dice-party', {
    sounds: function (prev, v) {
      if (v.turn === prev.turn && v.rollsLeft < prev.rollsLeft) return ['drop'];
      if (v.last && JSON.stringify(v.cards) !== JSON.stringify(prev.cards)) {
        return [v.phase === 'over' ? 'fanfare' : v.last.points ? 'point' : 'wrong'];
      }
      if (v.held.join() !== prev.held.join()) return ['lock'];
      return [];
    },
    padHint: 'X rolls · ←→ pick a die, A holds it · ↑↓ pick a box, Y scores it · End: A rematch',
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.turn !== slot) return null;
      if (!cursors[slot]) cursors[slot] = { die: 0, box: null };
      const c = cursorFor(v);
      const open = openBoxes(v);
      if (btn === 'X') return { type: 'roll' };
      if (btn === 'LEFT' || btn === 'RIGHT') c.die = (c.die + (btn === 'LEFT' ? 4 : 1)) % 5;
      else if (btn === 'UP' || btn === 'DOWN') {
        const i = open.findIndex(function (b) { return b.id === c.box; });
        c.box = open[(i + (btn === 'UP' ? open.length - 1 : 1)) % open.length].id;
      } else if (btn === 'A') return v.rollsLeft < 3 ? { type: 'hold', die: c.die } : { type: 'roll' };
      else if ((btn === 'Y' || btn === 'START') && v.rollsLeft < 3 && c.box) return { type: 'score', box: c.box };
      else return null;
      render();
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'dp-host';
      el.appendChild(root);
      diceReady.then(function () { key = ''; render(); });
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () { root = view = null; key = ''; cursors[0] = cursors[1] = null; },
  });
})();
