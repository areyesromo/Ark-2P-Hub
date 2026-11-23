(function () {
  Ark.loadCss('/games/colour-clash/style.css');
  const ready = Ark.loadScript('/games/colour-clash/cards.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function seat(v, slot) {
    const active = v.turn === slot && ['play', 'drawn', 'colour'].includes(v.phase);
    const n = v.counts[slot];
    let backs = '';
    for (let i = 0; i < Math.min(n, 14); i++) backs += ArkCC.card(null, '', ' style="--i:' + i + ';--n:' + Math.min(n, 14) + '"');
    const clock = active && v.timed && v.timeLeftMs ? ' <span class="cc-clock' + (v.timeLeftMs < 8000 ? ' low' : '') + '">⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's</span>' : '';
    return '<section class="cc-seat p' + (slot + 1) + (active ? ' active' : '') + '">' +
      '<header><span class="cc-name">' + nameOf(v, slot) + '</span><span class="cc-score">' + v.scores[slot] + (v.target ? '<small>/' + v.target + '</small>' : '') + '</span></header>' +
      '<div class="cc-backs">' + backs + '</div>' +
      '<footer><b class="cc-count' + (n === 1 ? ' one' : '') + '">' + n + ' card' + (n === 1 ? '' : 's') + '</b>' +
      (v.uncalled === slot ? ' <span class="cc-alert">didn\'t say CLASH!</span>' : '') + clock + '</footer></section>';
  }

  function caption(v) {
    if (v.phase === 'over') return '<span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins ' + v.scores[v.winner] + ' to ' + v.scores[1 - v.winner] + '</span>';
    if (v.phase === 'handEnd') return nameOf(v, v.result.winner) + (v.result.blocked ? ' holds fewer points' : ' is out!') + ' +' + v.result.points;
    const l = v.last;
    if (!l) return nameOf(v, v.turn) + ' goes first';
    if (l.what === 'catch') return '<b class="cc-big">Caught!</b> ' + nameOf(v, 1 - l.by) + ' draws ' + l.n;
    if (l.what === 'call' || l.called) return '<b class="cc-big">CLASH!</b> ' + nameOf(v, l.by) + ' has one card';
    if (l.what === 'draw') return nameOf(v, l.by) + ' drew a card';
    if (l.what === 'keep') return nameOf(v, l.by) + ' kept it';
    if (v.phase === 'colour') return nameOf(v, l.by) + ' is picking a colour…';
    return nameOf(v, l.by) + ' played ' + ArkCC.label(l.card);
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    root.innerHTML = '<div class="cc-tv">' + seat(v, 0) +
      '<div class="cc-middle"><div class="cc-piles"><div class="cc-deck">' + ArkCC.card(null) + '<small>' + v.stock + ' to draw</small></div>' +
      '<div class="cc-discard c' + v.colour + '">' + ArkCC.card(v.top, 'top') + '</div></div>' +
      '<div class="cc-follow">Colour: ' + ArkCC.colourChip(v.colour) + '</div>' +
      '<div class="cc-caption">' + caption(v) + '</div>' +
      (v.phase === 'over' ? '<p class="cc-hint">Rematch or back to the lobby from your phones.</p>' : '') +
      '</div>' + seat(v, 1) + '</div>';
  }

  Ark.register('host', 'colour-clash', {
    sounds: function (prev, v) {
      const out = [];
      const key = function (x) { return x.last ? JSON.stringify(x.last) + x.counts : ''; };
      if (key(v) !== key(prev) && v.last) {
        const l = v.last;
        out.push(l.what === 'catch' ? 'boom' : l.what === 'call' || l.called ? 'fanfare' : l.what === 'play' ? (ArkCC.face(l.card).length > 1 || /[SRD]/.test(ArkCC.face(l.card)) ? 'whoosh' : 'chalk') : 'tick');
      }
      if (v.uncalled !== null && prev.uncalled === null) out.push('wrong');
      return out;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'cc-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
    },
    update: function (v) {
      view = v;
      render();
    },
    unmount: function () {
      root = view = null;
    },
  });
})();
