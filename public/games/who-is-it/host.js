(function () {
  Ark.loadCss('/games/who-is-it/style.css');
  const ready = Ark.loadScript('/games/who-is-it/faces.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;

  // The clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  /** A player's board: the faces they still think could be the other's. */
  function board(v, s) {
    const standing = {};
    v.left[s].forEach(function (i) { standing[i] = true; });
    return '<section class="wi-board p' + (s + 1) + (v.turn === s ? ' turn' : '') + '"><header>' + nameOf(v, s) + '<small>' + v.left[s].length + ' faces left</small></header>' +
      '<div class="wi-grid">' + v.faces.map(function (f, i) { return ArkFaces.card(f, standing[i] ? '' : 'down'); }).join('') + '</div></section>';
  }

  function last(v) {
    const q = {};
    v.questions.forEach(function (x) { q[x.id] = x.text; });
    if (v.phase === 'over' || v.phase === 'roundEnd') {
      const r = v.result;
      const line = r.how === 'right' ? nameOf(v, r.winner) + ' named it!' : nameOf(v, 1 - r.winner) + ' guessed wrong';
      return (v.phase === 'over' ? '<span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins the match!</span> · ' : '') + line +
        '<div class="wi-secrets">' + [0, 1].map(function (s) { return '<div>' + nameOf(v, s) + '\'s face' + ArkFaces.card(v.faces[r.secrets[s]], 'secret') + '</div>'; }).join('') + '</div>';
    }
    const clock = v.timed && v.timeLeftMs ? ' · ⏱ <span class="wi-secs">' + secsLeft() + 's</span>' : '';
    const e = v.log[v.log.length - 1];
    let said = '';
    if (e && e.q) said = nameOf(v, e.by) + ' asked “' + q[e.q] + '” <b class="' + (e.yes ? 'yes' : 'no') + '">' + (e.yes ? 'Yes' : 'No') + '</b> · ';
    else if (e && e.pass) said = nameOf(v, e.by) + ' ran out of time · ';
    return said + nameOf(v, v.turn) + ' to ask' + clock;
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="wi-last">' + last(v) + '</div>' +
      '<div class="wi-boards">' + board(v, 0) + board(v, 1) + '</div>';
  }

  Ark.register('host', 'who-is-it', {
    sounds: function (prev, v) {
      if (prev.phase !== 'over' && v.phase === 'over') return ['fanfare'];
      if (v.phase === 'roundEnd' && prev.phase !== 'roundEnd') return [v.result.how === 'right' ? 'correct' : 'wrong'];
      if (v.n > prev.n) return ['whoosh'];
      return [];
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'wi-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
      tick = setInterval(function () {
        if (root) root.querySelectorAll('.wi-secs').forEach(function (c) { c.textContent = secsLeft() + 's'; });
      }, 250);
    },
    update: function (v) { view = v; gotAt = Date.now(); render(); },
    unmount: function () { clearInterval(tick); root = view = null; },
  });
})();
