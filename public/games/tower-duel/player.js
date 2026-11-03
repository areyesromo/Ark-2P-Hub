// Tower Defence Duel on the phone (server/games/tower-duel.js): your half of the map as a grid.
// Tap a free tile to pick it, then build (Arrow, Cannon or Frost); tap a tower to upgrade or
// sell it. The send buttons along the bottom send creeps down your rival's road (and raise your
// income). Lives, gold and income at the top. The creeps walk your road on the grid, and a
// small map shows your rival's road (their towers and creeps), so you can play without the TV.
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
  let segs = null; // the road as segments, to place a creep from how far along it is
  const CREEP_LOOK = { runner: { r: 0.2, fill: '#f97316' }, brute: { r: 0.32, fill: '#7f1d1d' }, swarm: { r: 0.13, fill: '#a855f7' } };

  function pointAt(d) {
    for (let i = 0; i < segs.length; i++) {
      const q = segs[i];
      if (d <= q.len) return [q.a[0] + ((q.b[0] - q.a[0]) * d) / q.len, q.a[1] + ((q.b[1] - q.a[1]) * d) / q.len];
      d -= q.len;
    }
    return segs[segs.length - 1].b;
  }

  /** A canvas sized to its box (in pixels), scaled to grid tiles. */
  function fit(c, v) {
    const css = c.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const W = Math.round(css.width * dpr);
    const H = Math.round(css.height * dpr);
    if (c.width !== W || c.height !== H) {
      c.width = W;
      c.height = H;
    }
    const g = c.getContext('2d');
    g.setTransform(W / v.grid.w, 0, 0, H / v.grid.h, 0, 0);
    g.clearRect(0, 0, v.grid.w, v.grid.h);
    return g;
  }

  function drawCreeps(g, side) {
    side.creeps.forEach(function (c) {
      const p = pointAt(c.d);
      const look = CREEP_LOOK[c.kind] || CREEP_LOOK.runner;
      g.fillStyle = look.fill;
      g.beginPath();
      g.arc(p[0], p[1], look.r, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = c.slow ? '#7dd3fc' : 'rgba(0,0,0,0.6)';
      g.lineWidth = 0.06;
      g.stroke();
    });
  }

  /** The creeps on your grid, and your rival's road on the small map: redrawn on every view. */
  function drawLive(v) {
    if (!root || v.phase !== 'play') return;
    const mine = root.querySelector('.td-creeps');
    if (mine) drawCreeps(fit(mine, v), v.sides[v.you]);
    const mini = root.querySelector('.td-mini canvas');
    if (!mini) return;
    const g = fit(mini, v);
    const them = v.sides[1 - v.you];
    g.fillStyle = '#3f7d3a';
    g.fillRect(0, 0, v.grid.w, v.grid.h);
    g.fillStyle = '#a16207';
    road.forEach(function (k) { const xy = k.split(','); g.fillRect(Number(xy[0]), Number(xy[1]), 1, 1); });
    g.fillStyle = '#374151';
    them.towers.forEach(function (t) { g.fillRect(t.x + 0.1, t.y + 0.1, 0.8, 0.8); });
    drawCreeps(g, them);
  }

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
      if (a === 'upgrade') api.send({ type: a, x: picked[0], y: picked[1], level: Number(act.getAttribute('data-level')) });
      else if (a === 'sell') api.send({ type: a, x: picked[0], y: picked[1] });
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
      return '<div class="td-acts"><button data-act="upgrade" data-level="' + t.level + '" data-cost="' + (up === null ? 1e9 : up) + '"' + (up === null || s.gold < up ? ' disabled' : '') + '>' + ICON[t.kind] + ' ' + (up === null ? 'Top level' : 'Upgrade to ' + (t.level + 1) + ' · ' + up + ' 💰') + '</button>' +
        '<button class="ghost" data-act="sell">Sell · +' + Math.floor(spent * v.refund) + ' 💰</button></div>';
    }
    return '<div class="td-acts">' + ['arrow', 'cannon', 'frost'].map(function (k) {
      return '<button data-act="' + k + '" data-cost="' + v.towers[k].cost + '"' + (s.gold < v.towers[k].cost ? ' disabled' : '') + '>' + ICON[k] + ' ' + NAME[k] + '<small>' + v.towers[k].cost + ' 💰</small></button>';
    }).join('') + '</div>';
  }

  function render(v) {
    if (!v) return;
    view = v;
    const s = v.sides[v.you];
    if (!road) {
      road = roadTiles(v);
      segs = [];
      for (let i = 1; i < v.path.length; i++) {
        const a = v.path[i - 1];
        const b = v.path[i];
        segs.push({ a: a, b: b, len: Math.hypot(b[0] - a[0], b[1] - a[1]) });
      }
    }
    if (picked && road.has(picked[0] + ',' + picked[1])) picked = null;
    // Gold changes all the time (income, every kill): it's updated in place, and the screen is
    // only rebuilt when what's on it changes (a rebuild under your finger would lose the tap).
    const key = JSON.stringify([v.phase, v.countdown, s.lives, s.towers, picked, v.sides[1 - v.you].lives, v.winner]);
    if (key === lastKey) {
      drawLive(v);
      return money(s);
    }
    lastKey = key;
    const top = '<div class="td-top"><span>❤️ ' + s.lives + '</span><span>💰 <b class="gold"></b> <small class="inc"></small></span><span class="them">Them ❤️ ' + v.sides[1 - v.you].lives + '</span></div>';
    if (v.phase === 'countdown') {
      root.innerHTML = top + '<div class="td-wait"><div class="big">' + (v.countdown || '') + '</div><p>Build towers beside your road, send creeps down theirs.</p></div>';
      return money(s);
    }
    if (v.phase === 'over') {
      const won = v.winner === v.you;
      root.innerHTML = top + '<div class="td-wait"><div class="outcome ' + (v.winner === null ? '' : won ? 'won' : 'lost') + '">' +
        (v.winner === null ? 'Draw! 🤝' : won ? 'You win! 🏆' : 'You lose') + '</div><button class="primary rematch">Rematch</button></div>';
      return money(s);
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
      '<div class="td-mini"><span>Their road</span><canvas></canvas></div>' +
      '<div class="td-board"><div class="td-grid" style="grid-template-columns:repeat(' + v.grid.w + ',1fr)">' + cells + '</div><canvas class="td-creeps"></canvas></div>' + panel(v, s) +
      '<div class="td-sends"><div class="label">Send to them:</div>' + SEND.map(function (x) {
        const def = v.creepTypes[x[0]];
        return '<button data-send="' + x[0] + '" data-cost="' + def.cost + '">' + x[1] + ' ' + x[2] + '<small>' + def.cost + ' 💰 · +' + def.income + ' income</small></button>';
      }).join('') + '</div>';
    money(s);
    drawLive(v);
  }

  /** Gold and income, and which buttons you can afford: updated in place on every view. */
  function money(s) {
    if (!root) return;
    const gold = root.querySelector('.gold');
    if (gold) gold.textContent = String(s.gold);
    const inc = root.querySelector('.inc');
    if (inc) inc.textContent = '+' + s.income + '/5s';
    root.querySelectorAll('[data-cost]').forEach(function (b) { b.disabled = s.gold < Number(b.getAttribute('data-cost')); });
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
      root = view = picked = road = segs = null;
      lastKey = '';
    },
  });
})();
