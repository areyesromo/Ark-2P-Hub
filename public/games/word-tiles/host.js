(function () {
  Ark.loadCss('/games/word-tiles/style.css');
  const ready = Ark.loadScript('/games/word-tiles/board.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;

  // The clock counts down between updates.
  let gotAt = 0;
  let tick = null;
  const secsLeft = () => (view ? Math.ceil(Math.max(0, view.timeLeftMs - (Date.now() - gotAt)) / 1000) : 0);
  const clockText = (s) => Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');

  const nameOf = (v, slot) => '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';

  function side(v, s) {
    const active = v.phase === 'play' && v.turn === s;
    let backs = '';
    for (let k = 0; k < v.rackSizes[s]; k++) backs += '<i></i>';
    return '<aside class="wt-side p' + (s + 1) + (active ? ' active' : '') + '"><div class="wt-name">' + nameOf(v, s) + '</div>' +
      '<div class="wt-pts">' + v.points[s] + '</div><div class="wt-backs">' + backs + '</div>' +
      '<div class="wt-turn">' + (active ? 'To play' + (v.timed && v.timeLeftMs ? ' ⏱ <span class="wt-secs">' + clockText(secsLeft()) + '</span>' : '') : '') + '</div></aside>';
  }

  function note(v) {
    const p = v.lastPlay;
    let s = '';
    if (p) {
      if (p.kind === 'play') s = nameOf(v, p.by) + ': ' + p.words.map(function (w) { return w.word.toUpperCase() + ' ' + w.score; }).join(', ') + (p.cells.length === 7 ? ' + 25 for all seven!' : '') + ' = <b>' + p.score + '</b>';
      else if (p.kind === 'swap') s = nameOf(v, p.by) + ' swapped ' + p.count + (p.count === 1 ? ' tile' : ' tiles');
      else s = nameOf(v, p.by) + (p.late ? ' ran out of time' : ' passed');
    }
    return s + ' <small>' + (s ? '· ' : '') + v.bag + ' tiles in the bag</small>';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    let banner = '';
    if (v.phase === 'over' || v.phase === 'roundEnd') {
      const r = v.result;
      banner = '<div class="wt-banner">' + (r.winner === null ? '<span class="ark-result draw">Level! A draw</span>' : '<span class="ark-result won">' + (v.phase === 'over' ? '🏆 ' : '') + nameOf(v, r.winner) + ' wins</span>') +
        '<small>' + r.points[0] + ' to ' + r.points[1] + ' (after the tiles left over)</small></div>';
    }
    root.innerHTML = Ark.scoreboardHtml(v.players, v.scores, v.winScore, v.round) +
      '<div class="wt-stage">' + side(v, 0) + '<div class="wt-centre">' + ArkTiles.boardHtml(v, {}) + banner + '</div>' + side(v, 1) + '</div>' +
      '<div class="wt-note">' + note(v) + '</div>';
  }

  Ark.register('host', 'word-tiles', {
    sounds: function (prev, v) {
      if (prev.phase !== 'over' && v.phase === 'over') return ['fanfare'];
      const p = v.lastPlay;
      if (p && (!prev.lastPlay || prev.lastPlay.n !== p.n)) return [p.kind === 'play' ? (p.score >= 30 ? 'correct' : 'drop') : 'close'];
      return [];
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'wt-host';
      el.appendChild(root);
      ready.then(function () { loaded = true; render(); });
      tick = setInterval(function () {
        if (root) root.querySelectorAll('.wt-secs').forEach(function (c) { c.textContent = clockText(secsLeft()); });
      }, 250);
    },
    update: function (v) { view = v; gotAt = Date.now(); render(); },
    unmount: function () { clearInterval(tick); root = view = null; },
  });
})();
