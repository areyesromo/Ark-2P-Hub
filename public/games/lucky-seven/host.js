(function () {
  Ark.loadCss('/games/lucky-seven/style.css');
  const ready = Ark.loadScript('/games/lucky-seven/cards.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  const BADGE = { stopped: 'Banked', bust: 'Bust!', lucky: 'Lucky Seven! 🍀', in: '' };

  function row(v, slot) {
    const st = v.status[slot];
    const fresh = v.event && v.event.by === slot && v.event.card;
    const turn = v.turn === slot;
    const r = turn ? ArkLucky.risk(v, slot) : null;
    return '<section class="l7-row p' + (slot + 1) + (turn ? ' turn' : '') + ' ' + st + '">' +
      '<header>' + nameOf(v, slot) + '<span class="l7-score">' + v.scores[slot] + '<small> / ' + v.target + '</small></span></header>' +
      '<div class="l7-bar"><i style="width:' + Math.min(100, (100 * v.scores[slot]) / v.target) + '%"></i></div>' +
      ArkLucky.hand(v.hands[slot], fresh) +
      '<footer>' + (BADGE[st] ? '<span class="l7-badge ' + st + '">' + BADGE[st] + '</span>' : '') +
      (st !== 'bust' && v.hands[slot].length ? ' <b>' + v.banked[slot] + '</b> this round' : '') +
      (turn ? ' · ' + (r.bad ? r.bad + ' of ' + r.of + ' cards would bust' : 'safe to flip') + (v.timed ? ' · ⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's' : '') : '') + '</footer></section>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    let banner = '';
    if (v.phase === 'over') banner = '<div class="l7-banner"><span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins!</span></div>';
    else if (v.phase === 'roundEnd') banner = '<div class="l7-banner">Round ' + v.round + ': +' + v.result.gains[0] + ' and +' + v.result.gains[1] + '</div>';
    root.innerHTML = '<div class="l7-head"><span>Round <strong>' + v.round + '</strong></span><span>First to <strong>' + v.target + '</strong></span>' +
      '<span class="l7-deck">' + ArkLucky.card(null) + ' <b>' + v.deckLeft + '</b> left</span></div>' +
      '<div class="l7-table">' + row(v, 0) + row(v, 1) + banner + '</div>';
  }

  Ark.register('host', 'lucky-seven', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return ['fanfare'];
      if (v.event && (!prev.event || prev.event.n !== v.event.n)) {
        return [{ bust: 'wrong', shield: 'lock', lucky: 'fanfare', double: 'correct', stop: 'point' }[v.event.what] || 'tick'];
      }
      return [];
    },
    padHint: 'A flip a card · B stop and bank',
    pad: function (btn, v, slot) {
      if (v.phase !== 'play' || v.turn !== slot) return null;
      if (btn === 'A') return { type: 'flip' };
      if (btn === 'B') return { type: 'stop' };
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'l7-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) { view = v; render(); },
    unmount: function () { root = view = null; },
  });
})();
