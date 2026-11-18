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

  // The lower boxes' short badges (the preview's guide spells them out).
  const SHORT = { three: '3×', four: '4×', house: 'FH', small: 'SM', large: 'LG', yahtzee: '5×', chance: 'CH' };
  const FACE = { ones: 1, twos: 2, threes: 3, fours: 4, fives: 5, sixes: 6 };

  /**
   * The scorecard, big enough to read from the couch: the six numbers down the left (a die for each),
   * the combos down the right, both players' scores side by side in each, sums along the bottom.
   * An open box shows, faintly, what the dice would score there for whoever is rolling.
   */
  function card(v, c) {
    function cell(b, s) {
      const got = v.cards[s][b.id];
      const mine = v.phase === 'turn' && s === v.turn;
      if (got !== undefined) return '<b class="got' + (v.last && v.last.by === s && v.last.box === b.name ? ' fresh' : '') + '">' + got + '</b>';
      if (mine && b.id in v.options) return '<b class="opt' + (v.options[b.id] ? '' : ' zero') + '">' + v.options[b.id] + '</b>';
      return '<b class="empty"></b>';
    }
    function row(b) {
      const label = b.upper
        ? '<span class="lab">' + ArkDice.html(FACE[b.id]) + '</span>'
        : '<span class="lab" title="' + esc(b.name) + '"><span class="badge">' + SHORT[b.id] + '</span></span>';
      return '<div class="dp-row' + (c && c.box === b.id ? ' cur' : '') + '">' + label + cell(b, 0) + cell(b, 1) + '</div>';
    }
    function sumRow(name, a, b, cls) {
      return '<div class="dp-row sum ' + (cls || '') + '"><span class="lab">' + name + '</span><b>' + a + '</b><b>' + b + '</b></div>';
    }
    const upper = v.boxes.filter(function (b) { return b.upper; });
    const lower = v.boxes.filter(function (b) { return !b.upper; });
    const t = v.totals;
    const bonus = function (s) { return t[s].bonus ? '+' + t[s].bonus : '<span class="muted">' + t[s].upper + '/' + v.bonus.at + '</span>'; };
    const head = '<div class="dp-row head"><span class="lab"></span>' + [0, 1].map(function (s) {
      return '<b class="p' + (s + 1) + (v.phase === 'turn' && v.turn === s ? ' on' : '') + '">' + esc(v.players[s].name) + '</b>';
    }).join('') + '</div>';
    return '<div class="dp-sheet turn-' + v.turn + '">' +
      '<div class="col">' + head + upper.map(row).join('') +
        '<div class="dp-row sum"><span class="lab">Bonus <small>' + v.bonus.at + '+ up top: +' + v.bonus.points + '</small></span><b>' + bonus(0) + '</b><b>' + bonus(1) + '</b></div>' +
        sumRow('Upper', t[0].upper + t[0].bonus, t[1].upper + t[1].bonus) + '</div>' +
      '<div class="col">' + head + lower.map(row).join('') + sumRow('Lower', t[0].lower, t[1].lower) + '</div>' +
      '<div class="dp-total"><span>Total</span><b class="p1-text">' + v.scores[0] + '</b><b class="p2-text">' + v.scores[1] + '</b></div>' +
      '</div>';
  }

  function status(v) {
    if (v.phase === 'over') {
      return '<div class="title ark-result">' + (v.draw ? '🤝 A draw!' : '🏆 ' + nameOf(v, v.winner) + ' wins!') + '</div>' +
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
