// Crazy Eights on the TV (server/games/crazy-eights.js): the draw pile and the top card in the
// middle, the suit to follow, each player's hand face down (just how many), whose turn it is
// and their clock. At the end of a hand both hands are turned over and scored.
(function () {
  Ark.loadCss('/games/crazy-eights/style.css');
  const esc = Ark.escapeHtml;
  let C = window.ArkCards || null;
  Ark.loadScript('/games/crazy-eights/cards.js').then(function () {
    C = window.ArkCards;
    lastKey = '';
    if (view && root) render(view);
  });

  let root = null;
  let bar = null;
  let raf = null;
  let view = null;
  let viewAt = 0;
  let lastKey = '';
  let lastTop = null;
  let topAt = 0;

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  /** A player's hand, face down: one back per card (the rest as "+n"). */
  function backs(n) {
    let h = '';
    for (let i = 0; i < Math.min(n, 12); i++) h += C.back('small');
    return '<div class="ce-backs">' + h + (n > 12 ? '<span class="more">+' + (n - 12) + '</span>' : '') + '</div>';
  }

  function side(v, slot) {
    const on = v.phase !== 'over' && v.phase !== 'handEnd' && v.turn === slot;
    let status = '';
    if (on && v.phase === 'suit') status = 'Calling the suit…';
    else if (on && v.pending) status = v.pendingKind === '2' ? 'Answer with a 2, or take ' + v.pending : 'Takes ' + v.pending + '!';
    else if (on) status = v.drawn ? 'Drew a card…' : 'Their turn';
    return '<div class="ce-side' + (slot === 1 ? ' right' : '') + (on ? ' on p' + (slot + 1) : '') + '">' +
      '<div class="name">' + nameOf(v, slot) + ' <span class="count">' + v.counts[slot] + (v.counts[slot] === 1 ? ' card' : ' cards') + '</span></div>' +
      backs(v.counts[slot]) +
      '<div class="score">' + v.scores[slot] + (v.target ? ' / ' + v.target : '') + ' pts</div>' +
      '<div class="status">' + status + '</div></div>';
  }

  /** What just happened, in a line. */
  function lastLine(v) {
    const l = v.last;
    if (!l) return '';
    const who = nameOf(v, l.slot);
    if (l.kind === 'draw') return who + ' drew a card';
    if (l.kind === 'penalty') return who + ' took ' + l.count + ' cards';
    const r = C.rank(l.card);
    const extra = r === '8' ? (v.suit ? ' and called ' + C.SYMBOL[v.suit] + ' ' + C.NAME[v.suit] : ' and is calling the suit…')
      : v.actions && r === 'J' ? ': another turn' : v.actions && r === '2' ? ': draw two' : v.actions && l.card === 'QS' ? ': draw five!' : '';
    return who + ' played the ' + r + C.SYMBOL[C.suit(l.card)] + extra;
  }

  function middle(v) {
    // The card that just landed: its landing plays on, even if the screen is redrawn mid-way.
    if (v.top !== lastTop) topAt = performance.now();
    const age = performance.now() - topAt;
    const fresh = age < 350;
    const called = C.rank(v.top) === '8' && v.suit ? '<div class="ce-called ' + (v.suit === 'H' || v.suit === 'D' ? 'red' : 'black') + '">' + C.SYMBOL[v.suit] + '</div>' : '';
    return '<div class="ce-table">' +
      '<div class="ce-pile">' + C.back('big') + '<span>' + v.deckCount + ' left</span></div>' +
      '<div class="ce-pile">' + C.face(v.top, 'big' + (fresh ? ' fresh' : ''), fresh ? ' style="animation-delay:-' + Math.round(age) + 'ms"' : '') + called + '<span>' +
        (C.rank(v.top) !== '8' ? 'Match ' + C.SYMBOL[C.suit(v.top)] + ' or ' + C.rank(v.top) : v.suit ? 'Follow ' + C.NAME[v.suit] : 'Calling the suit…') + '</span></div>' +
      (v.pending ? '<div class="ce-pending">+' + v.pending + '</div>' : '') +
      '</div><div class="ce-last">' + lastLine(v) + '</div>';
  }

  function body(v) {
    if (v.phase === 'handEnd' || v.phase === 'over') {
      const r = v.result;
      const hands = [0, 1].map(function (slot) {
        const left = r.left[slot];
        return '<div class="ce-left"><div>' + nameOf(v, slot) + (left.length ? '' : ' 🎉 out!') + '</div><div class="ce-row">' +
          left.map(function (c) { return C.face(c, 'small'); }).join('') + '</div></div>';
      }).join('');
      const head = v.phase === 'over'
        ? '🏆 ' + nameOf(v, v.winner) + ' wins' + (v.target ? ' <strong>' + v.scores[v.winner] + ' : ' + v.scores[1 - v.winner] + '</strong>' : '') + '!'
        : nameOf(v, r.winner) + ' is out! <strong>+' + r.points + '</strong>';
      return '<div class="ce-end"><div class="head">' + head + '</div>' + hands +
        '<div class="sub">' + (v.phase === 'over' ? 'Rematch or head back to the lobby from your phones.' : 'Next hand coming up…') + '</div></div>';
    }
    return middle(v) + '<div class="ce-bar"><div class="fill"></div></div>';
  }

  function render(v) {
    if (!C) return;
    root.innerHTML = '<div class="ce-top">' + side(v, 0) + '<div class="ce-hand-no">Hand ' + v.hand + '</div>' + side(v, 1) + '</div>' + body(v);
    lastTop = v.top;
    bar = root.querySelector('.ce-bar .fill');
  }

  // The server pushes a view on every move; ease the turn clock in between.
  function tick() {
    raf = requestAnimationFrame(tick);
    if (!bar || !view) return;
    const frac = Math.max(0, view.timeLeftMs - (performance.now() - viewAt)) / view.turnMs;
    bar.style.width = (frac * 100).toFixed(2) + '%';
    bar.classList.toggle('low', frac < 0.25);
  }

  Ark.register('host', 'crazy-eights', {
    sounds: function (prev, v) {
      const out = [];
      const a = prev.events;
      const b = v.events;
      if (!a || !b) return out;
      if (b.eights > a.eights) out.push('reveal');
      else if (b.plays > a.plays) out.push('drop');
      if (b.draws > a.draws) out.push('tick');
      if (b.penalties > a.penalties) out.push('wrong');
      if (v.phase === 'handEnd' && prev.phase !== 'handEnd') out.push('point');
      if (v.phase === 'over' && prev.phase !== 'over') out.push('fanfare');
      return out;
    },
    padHint: 'Crazy Eights needs two phones: your hand is secret · A: rematch at the end',
    pad: function (btn, v) {
      return v.phase === 'over' && (btn === 'A' || btn === 'START') ? { type: 'rematch' } : null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'ce-host';
      el.appendChild(root);
      raf = requestAnimationFrame(tick);
    },
    update: function (v) {
      view = v;
      viewAt = performance.now();
      const key = JSON.stringify([v.phase, v.hand, v.top, v.suit, v.turn, v.counts, v.deckCount, v.pending, v.drawn, v.last, v.scores, v.players.map(function (p) { return p.name; })]);
      if (key === lastKey) return;
      lastKey = key;
      render(v);
    },
    unmount: function () {
      cancelAnimationFrame(raf);
      root = bar = view = lastTop = null;
      lastKey = '';
    },
  });
})();
