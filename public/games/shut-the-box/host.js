(function () {
  Ark.loadCss('/shared/dice.css');
  Ark.loadCss('/games/shut-the-box/style.css');
  const ready = Ark.loadScript('/shared/dice.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  const pads = {}; // a controller player's cursor and picked tiles: { at, picked: [] }

  // The clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function box(v, slot) {
    const p = v.players[slot];
    const local = v.turn === slot && p.local && !p.bot && v.phase === 'shut';
    const pad = pads[slot];
    let tiles = '';
    for (let n = 1; n <= v.tiles; n++) {
      const open = v.open[slot].includes(n);
      const cls = 'sb-tile' + (open ? '' : ' shut') + (local && pad && pad.picked.includes(n) ? ' picked' : '') + (local && pad && pad.at === n ? ' aim p' + (slot + 1) : '');
      tiles += '<span class="' + cls + '">' + n + '</span>';
    }
    const done = v.scores[slot];
    let line = '';
    if (done !== null) line = done === 0 ? '🎉 Shut the box! <b>0</b>' : 'Scored <b>' + done + '</b>';
    else if (v.turn === slot) line = 'Playing · ' + v.open[slot].reduce((a, b) => a + b, 0) + ' still open';
    else line = 'Waiting';
    if (local) line += ' <small>◀ ▶ A pick · X shut</small>';
    return '<section class="sb-box p' + (slot + 1) + (v.turn === slot ? ' turn' : '') + (v.result && v.result.winner === slot ? ' won' : '') + '">' +
      '<header>' + nameOf(v, slot) + '</header><div class="sb-tiles" style="--n:' + v.tiles + '">' + tiles + '</div><footer>' + line + '</footer></section>';
  }

  function middle(v) {
    if (v.phase === 'over') return '<span class="ark-result won">🏆 ' + nameOf(v, v.winner) + ' wins the match!</span>';
    if (v.phase === 'roundEnd') {
      const r = v.result;
      return r.winner === null ? 'Level: ' + r.scores[0] + ' each. Nobody takes it' : nameOf(v, r.winner) + ' takes the round, ' + r.scores[r.winner] + ' to ' + r.scores[1 - r.winner];
    }
    const clock = v.timed && v.timeLeftMs ? ' · ⏱ <span class="sb-secs">' + secsLeft() + 's</span>' : '';
    const target = v.scores[1 - v.turn];
    const beat = target !== null ? '<div class="sb-beat">Score to beat: <b>' + target + '</b></div>' : '';
    if (v.phase === 'roll') {
      const p = v.players[v.turn];
      return beat + '<div class="sb-note">' + nameOf(v, v.turn) + ' to roll' + (v.oneDie ? ' (one die or two)' : '') + clock + (p.local && !p.bot ? '<small>B roll two' + (v.oneDie ? ' · Y roll one' : '') + '</small>' : '') + '</div>';
    }
    return beat + '<div class="sb-dice">' + v.dice.map(function (d) { return ArkDice.html(d); }).join('') + '<b>' + v.total + '</b></div>' +
      '<div class="sb-note">' + (v.phase === 'stuck' ? 'Nothing adds up to ' + v.total + ': that\'s the turn' : 'Shut tiles that add up to ' + v.total + clock) + '</div>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    root.innerHTML = Ark.scoreboardHtml(v.players, v.wins, v.winScore, v.round) +
      '<div class="sb-table">' + box(v, 0) + '<div class="sb-middle">' + middle(v) + '</div>' + box(v, 1) + '</div>';
  }

  Ark.register('host', 'shut-the-box', {
    sounds: function (prev, v) {
      if (prev.phase !== 'over' && v.phase === 'over') return ['fanfare'];
      if (v.phase === 'roundEnd' && prev.phase !== 'roundEnd') return ['point'];
      if (v.dice.length && v.n !== prev.n && (v.phase === 'shut' || v.phase === 'stuck')) return [v.phase === 'stuck' ? 'wrong' : 'drop'];
      if (v.turn !== null && prev.turn === v.turn && v.open[v.turn].length < prev.open[v.turn].length) return ['knock'];
      return [];
    },
    padHint: 'B roll two dice (Y one) · ◀ ▶ picks a tile, A marks it, X shuts them · A: rematch at the end',
    pad: function (btn, v, slot) {
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.turn !== slot) return null;
      if (v.phase === 'roll') return btn === 'B' ? { type: 'roll', dice: 2 } : btn === 'Y' && v.oneDie ? { type: 'roll', dice: 1 } : null;
      if (v.phase !== 'shut') return null;
      const pad = pads[slot] || (pads[slot] = { at: v.open[slot][0], picked: [] });
      pad.picked = pad.picked.filter(function (n) { return v.open[slot].includes(n); });
      if (btn === 'LEFT' || btn === 'RIGHT') {
        const list = v.open[slot];
        const i = Math.max(0, list.indexOf(pad.at));
        pad.at = list[Math.min(list.length - 1, Math.max(0, i + (btn === 'LEFT' ? -1 : 1)))];
      } else if (btn === 'A') {
        const k = pad.picked.indexOf(pad.at);
        if (k >= 0) pad.picked.splice(k, 1); else pad.picked.push(pad.at);
      } else if (btn === 'X' && pad.picked.length) {
        const tiles = pad.picked.slice();
        pad.picked = [];
        return { type: 'shut', tiles: tiles };
      }
      render();
      return null;
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'sb-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
      tick = setInterval(function () {
        if (root) root.querySelectorAll('.sb-secs').forEach(function (c) { c.textContent = secsLeft() + 's'; });
      }, 250);
    },
    update: function (v) {
      if (view && view.n !== v.n) { delete pads[0]; delete pads[1]; } // (a fresh pick each roll)
      view = v;
      gotAt = Date.now();
      render();
    },
    unmount: function () { clearInterval(tick); root = view = null; delete pads[0]; delete pads[1]; },
  });
})();
