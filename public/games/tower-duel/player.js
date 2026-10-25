// Tower Defence Duel on the phone (server/games/tower-duel.js): your half of the map as a grid.
// Tap a free tile to pick it, then build (Arrow, Cannon or Frost); tap a tower to upgrade or
// sell it. The send buttons along the bottom send creeps down your rival's road (and raise your
// income). Lives, gold and income at the top; the creeps themselves are on the TV.
(function () {
  Ark.loadCss('/games/tower-duel/style.css');
  const ICON = { arrow: '🏹', cannon: '💣', frost: '❄️' };
  const NAME = { arrow: 'Arrow', cannon: 'Cannon', frost: 'Frost' };
  const SEND = [['runner', '🏃', 'Runner'], ['brute', '🐗', 'Brute'], ['swarm', '🐜', 'Swarm']];

  let root = null;
  let api = null;
  let view = null;
  let picked = null; // [x, y]
  let lastKey = '';
  let road = null; // 'x,y' of the road tiles

  function roadTiles(v) {
    const out = new Set();
    for (let i = 1; i < v.path.length; i++) {
      const a = v.path[i - 1];
      const b = v.path[i];
      const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 4);
      for (let k = 0; k <= n; k++) {
        const x = Math.floor(a[0] + ((b[0] - a[0]) * k) / n);
        const y = Math.floor(a[1] + ((b[1] - a[1]) * k) / n);
        if (x >= 0 && y >= 0 && x < v.grid.w && y < v.grid.h) out.add(x + ',' + y);
      }
    }
    return out;
  }

  function onClick(e) {
    const cell = e.target.closest('[data-cell]');
    if (cell) {
      const xy = cell.getAttribute('data-cell').split(',').map(Number);
      picked = picked && picked[0] === xy[0] && picked[1] === xy[1] ? null : xy;
      lastKey = '';
      render(view);
      return;
    }
    const act = e.target.closest('[data-act]');
    if (act && !act.disabled && picked) {
      const a = act.getAttribute('data-act');
      if (a === 'upgrade' || a === 'sell') api.send({ type: a, x: picked[0], y: picked[1] });
      else api.send({ type: 'build', x: picked[0], y: picked[1], kind: a });
      if (a === 'sell') picked = null;
      api.vibrate(15);
      return;
    }
    const send = e.target.closest('[data-send]');
    if (send && !send.disabled) {
      api.send({ type: 'send', kind: send.getAttribute('data-send') });
      api.vibrate(20);
      return;
    }
    if (e.target.closest('.rematch')) api.send({ type: 'rematch' });
  }

  /** The panel under the grid: build choices for a free tile, upgrade / sell for a tower. */
  function panel(v, s) {
    if (!picked) return '<p class="msg">Tap a tile beside the road to build there.</p>';
    const t = s.towers.find(function (x) { return x.x === picked[0] && x.y === picked[1]; });
    if (t) {
      const def = v.towers[t.kind];
      const up = t.level < 3 ? def.upgrade[t.level - 1] : null;
      let spent = def.cost;
      for (let i = 0; i < t.level - 1; i++) spent += def.upgrade[i];
      return '<div class="td-acts"><button data-act="upgrade"' + (up === null || s.gold < up ? ' disabled' : '') + '>' + ICON[t.kind] + ' ' + (up === null ? 'Top level' : 'Upgrade to ' + (t.level + 1) + ' · ' + up + ' 💰') + '</button>' +
        '<button class="ghost" data-act="sell">Sell · +' + Math.floor(spent * v.refund) + ' 💰</button></div>';
    }
    return '<div class="td-acts">' + ['arrow', 'cannon', 'frost'].map(function (k) {
      return '<button data-act="' + k + '"' + (s.gold < v.towers[k].cost ? ' disabled' : '') + '>' + ICON[k] + ' ' + NAME[k] + '<small>' + v.towers[k].cost + ' 💰</small></button>';
    }).join('') + '</div>';
  }

  function render(v) {
    if (!v) return;
    view = v;
    const s = v.sides[v.you];
    if (!road) road = roadTiles(v);
    if (picked && road.has(picked[0] + ',' + picked[1])) picked = null;
    const key = JSON.stringify([v.phase, v.countdown, s.gold, s.lives, s.income, s.towers, picked, v.sides[1 - v.you].lives, v.winner]);
    if (key === lastKey) return;
    lastKey = key;
    const top = '<div class="td-top"><span>❤️ ' + s.lives + '</span><span>💰 ' + s.gold + ' <small>+' + s.income + '/5s</small></span><span class="them">Them ❤️ ' + v.sides[1 - v.you].lives + '</span></div>';
    if (v.phase === 'countdown') {
      root.innerHTML = top + '<div class="td-wait"><div class="big">' + (v.countdown || '') + '</div><p>Build towers beside your road, send creeps down theirs.</p></div>';
      return;
    }
    if (v.phase === 'over') {
      const won = v.winner === v.you;
      root.innerHTML = top + '<div class="td-wait"><div class="outcome ' + (v.winner === null ? '' : won ? 'won' : 'lost') + '">' +
        (v.winner === null ? 'Draw! 🤝' : won ? 'You win! 🏆' : 'You lose') + '</div><button class="primary rematch">Rematch</button></div>';
      return;
    }
    let cells = '';
    for (let y = 0; y < v.grid.h; y++) {
      for (let x = 0; x < v.grid.w; x++) {
        const k = x + ',' + y;
        const t = s.towers.find(function (q) { return q.x === x && q.y === y; });
        const sel = picked && picked[0] === x && picked[1] === y ? ' picked' : '';
        if (road.has(k)) cells += '<div class="cell road"></div>';
        else cells += '<button class="cell' + (t ? ' tower' : '') + sel + '" data-cell="' + k + '">' + (t ? ICON[t.kind] + '<i>' + '•'.repeat(t.level) + '</i>' : '') + '</button>';
      }
    }
    root.innerHTML = top +
      '<div class="td-grid" style="grid-template-columns:repeat(' + v.grid.w + ',1fr)">' + cells + '</div>' + panel(v, s) +
      '<div class="td-sends"><div class="label">Send to them:</div>' + SEND.map(function (x) {
        const def = v.creepTypes[x[0]];
        return '<button data-send="' + x[0] + '"' + (s.gold < def.cost ? ' disabled' : '') + '>' + x[1] + ' ' + x[2] + '<small>' + def.cost + ' 💰 · +' + def.income + ' income</small></button>';
      }).join('') + '</div>';
  }

  Ark.register('player', 'tower-duel', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'td-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
    },
    update: render,
    unmount: function () {
      root = view = picked = road = null;
      lastKey = '';
    },
  });
})();
