(function () {
  // The cards and chips are Blackjack's.
  Ark.loadCss('/games/blackjack/style.css');
  Ark.loadCss('/games/video-poker/style.css');
  const ready = Ark.loadScript('/games/blackjack/table.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;

  // The clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);
  function ticking() {
    tick = setInterval(function () {
      if (root) root.querySelectorAll('.vp-secs').forEach(function (c) { c.textContent = secsLeft() + 's'; });
    }, 250);
  }

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  /** A row of cards, the held ones raised with a HELD tag. */
  function row(cards, holds) {
    return '<div class="vp-row">' + cards.map(function (c, i) {
      const held = holds && holds[i];
      return '<div class="vp-slot' + (held ? ' held' : '') + '">' + ArkBJ.card(c) + (held ? '<b>HELD</b>' : '') + '</div>';
    }).join('') + '</div>';
  }

  function seat(v, slot) {
    const r = v.result;
    const won = r && r.winner === slot;
    return '<section class="vp-seat p' + (slot + 1) + (won ? ' won' : '') + '">' +
      '<header>' + nameOf(v, slot) + '<span>' + v.chips[slot].toLocaleString() + ' <small>chips</small></span></header>' +
      (v.finals ? row(v.finals[slot], v.holds[slot]) + '<div class="vp-name">' + esc(r.names[slot]) + (won ? ' 🏆' : '') + '</div>'
        : '<div class="vp-wait">' + (v.locked[slot] ? '🔒 Holding…' : 'Choosing what to hold…') + '</div>') +
      '</section>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    let caption;
    if (v.phase === 'over') caption = v.winner === null ? '<span class="ark-result draw">Level on chips!</span>' : '<span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins the match</span>';
    else if (v.phase === 'reveal') caption = v.result.winner === null ? 'Split pot' : nameOf(v, v.result.winner) + ' takes ' + v.result.pot.toLocaleString();
    else caption = 'You both have these five: hold and draw' + (v.timed && v.timeLeftMs ? ' · ⏱ <span class="vp-secs">' + secsLeft() + 's</span>' : '');
    root.innerHTML = '<div class="vp-head"><span>Hand <strong>' + v.hand + '</strong> / ' + v.hands + '</span><span>Ante <strong>' + v.ante + '</strong></span><span>Pot <strong>' + v.pot.toLocaleString() + '</strong></span></div>' +
      '<div class="vp-caption">' + caption + '</div>' +
      '<div class="vp-table"><div class="vp-dealt">' + row(v.dealt || []) + '</div>' +
      '<div class="vp-seats">' + seat(v, 0) + seat(v, 1) + '</div></div>';
  }

  Ark.register('host', 'video-poker', {
    sounds: function (prev, v) {
      if (v.phase === 'over' && prev.phase !== 'over') return ['fanfare'];
      if (v.phase === 'reveal' && prev.phase !== 'reveal') return ['reveal'];
      if (v.hand !== prev.hand) return ['whoosh'];
      if (v.locked.filter(Boolean).length > prev.locked.filter(Boolean).length) return ['lock'];
      return [];
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'vp-host';
      el.appendChild(root);
      ticking();
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) { view = v; gotAt = Date.now(); render(); },
    unmount: function () { clearInterval(tick); root = view = null; },
  });
})();
