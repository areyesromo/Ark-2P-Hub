(function () {
  Ark.loadCss('/games/dominoes/style.css');
  const ready = Ark.loadScript('/games/dominoes/tiles.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function seat(v, slot) {
    const active = v.phase === 'play' && v.turn === slot;
    let tiles = '';
    if (v.phase !== 'play' && v.result) tiles = v.result.hands[slot].map(function (t) { const h = t.split('-').map(Number); return ArkDom.tile(h[0], h[1], 'v'); }).join('');
    else for (let i = 0; i < v.counts[slot]; i++) tiles += ArkDom.back();
    const clock = active && v.timed && v.timeLeftMs ? ' <span class="dm-clock' + (v.timeLeftMs < 8000 ? ' low' : '') + '">⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's</span>' : '';
    return '<section class="dm-seat p' + (slot + 1) + (active ? ' active' : '') + '">' +
      '<header><span class="dm-name">' + nameOf(v, slot) + '</span><span class="dm-score">' + v.scores[slot] + '<small>/' + v.target + '</small></span></header>' +
      '<div class="dm-hand">' + tiles + '</div><footer>' + v.counts[slot] + ' tile' + (v.counts[slot] === 1 ? '' : 's') + clock + '</footer></section>';
  }

  function caption(v) {
    if (v.phase === 'over') return '<span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins ' + v.scores[v.winner] + ' to ' + v.scores[1 - v.winner] + '</span>';
    if (v.phase === 'handEnd') {
      const r = v.result;
      if (r.winner === null) return 'Blocked, and level: nobody scores';
      return (r.blocked ? 'Blocked! ' + nameOf(v, r.winner) + ' holds fewer pips' : nameOf(v, r.winner) + ' is out!') + ' +' + r.points;
    }
    const l = v.last;
    if (!l) return nameOf(v, v.turn) + ' leads';
    if (l.what === 'draw') return nameOf(v, l.by) + ' draws' + (l.n > 1 ? ' (' + l.n + ')' : '') + '…';
    if (l.what === 'pass') return nameOf(v, l.by) + ' can\'t go: pass';
    return nameOf(v, l.by) + ' plays ' + l.tile.replace('-', '|');
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const fresh = v.last && v.last.what === 'play' ? (v.last.end === 'L' ? 0 : v.line.length - 1) : -1;
    root.innerHTML = '<div class="dm-tv">' + seat(v, 0) +
      '<div class="dm-table">' + ArkDom.lineHtml(v.line, 7, fresh) +
      '<div class="dm-foot"><span class="dm-yard">' + ArkDom.back('small') + ' ' + v.yard + ' in the boneyard</span>' +
      (v.ends ? '<span class="dm-ends">Ends: <b>' + v.ends[0] + '</b> and <b>' + v.ends[1] + '</b></span>' : '') + '</div>' +
      '<div class="dm-caption">' + caption(v) + '</div></div>' + seat(v, 1) + '</div>';
  }

  Ark.register('host', 'dominoes', {
    sounds: function (prev, v) {
      const k = function (x) { return JSON.stringify(x.last) + x.line.length + x.counts; };
      if (!v.last || k(v) === k(prev)) return [];
      return [v.last.what === 'play' ? 'knock' : v.last.what === 'pass' ? 'wrong' : 'tick'];
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'dm-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) { view = v; render(); },
    unmount: function () { root = view = null; },
  });
})();
