(function () {
  Ark.loadCss('/games/battleship/style.css');
  const gridReady = Ark.loadScript('/games/battleship/grid.js');

  let root = null;
  let api = null;
  let view = null;
  let loaded = false;
  let fleet = null; // ships being placed: [{ x, y, dir }]
  let selected = null; // index of the ship being moved
  let aim = null; // cell picked on the enemy grid, fired on the second tap
  let note = ''; // short feedback while placing
  let lastShotKey = '';

  function lens() {
    return view.fleet.map(function (f) { return f.len; });
  }

  function fits(ships) {
    const n = view.size;
    const taken = {};
    const L = lens();
    return ships.every(function (s, i) {
      for (let k = 0; k < L[i]; k++) {
        const x = s.dir === 'h' ? s.x + k : s.x;
        const y = s.dir === 'v' ? s.y + k : s.y;
        if (x < 0 || y < 0 || x >= n || y >= n || taken[y * n + x]) return false;
        taken[y * n + x] = true;
      }
      return true;
    });
  }

  function shuffle() {
    const n = view.size;
    const L = lens();
    const ships = [];
    while (ships.length < L.length) {
      const len = L[ships.length];
      const dir = Math.random() < 0.5 ? 'h' : 'v';
      const s = {
        dir: dir,
        x: Math.floor(Math.random() * (dir === 'h' ? n - len + 1 : n)),
        y: Math.floor(Math.random() * (dir === 'v' ? n - len + 1 : n)),
      };
      if (fits(ships.concat([s]))) ships.push(s);
    }
    return ships;
  }

  function shipAt(x, y) {
    const L = lens();
    for (let i = 0; i < fleet.length; i++) {
      const s = fleet[i];
      for (let k = 0; k < L[i]; k++) {
        if ((s.dir === 'h' ? s.x + k : s.x) === x && (s.dir === 'v' ? s.y + k : s.y) === y) return i;
      }
    }
    return -1;
  }

  /** Try a new spot for ship i, nudged back onto the grid; keep it if it fits. */
  function tryPlace(i, s) {
    const n = view.size;
    const len = lens()[i];
    const moved = {
      dir: s.dir,
      x: Math.min(s.x, s.dir === 'h' ? n - len : n - 1),
      y: Math.min(s.y, s.dir === 'v' ? n - len : n - 1),
    };
    const trial = fleet.slice();
    trial[i] = moved;
    if (!fits(trial)) return false;
    fleet = trial;
    return true;
  }

  function onPlaceTap(x, y) {
    const hit = shipAt(x, y);
    note = '';
    if (hit !== -1 && hit === selected) {
      const s = fleet[hit];
      if (!tryPlace(hit, { x: s.x, y: s.y, dir: s.dir === 'h' ? 'v' : 'h' })) note = "No room to turn it there.";
    } else if (hit !== -1) {
      selected = hit;
    } else if (selected !== null) {
      if (!tryPlace(selected, { x: x, y: y, dir: fleet[selected].dir })) note = "It won't fit there.";
    } else {
      note = 'Tap a ship first.';
    }
    api.vibrate(10);
    render();
  }

  function onClick(e) {
    const t = e.target;
    const btn = t.closest('button');
    if (btn) {
      if (btn.classList.contains('shuffle')) { fleet = shuffle(); selected = null; note = ''; }
      else if (btn.classList.contains('ready')) { api.send({ type: 'ready', ships: fleet }); selected = null; note = ''; }
      else if (btn.classList.contains('unready')) api.send({ type: 'unready' });
      else if (btn.classList.contains('fire') && aim) fire();
      else if (btn.classList.contains('rematch')) api.send({ type: 'rematch' });
      render();
      return;
    }
    const cell = t.closest('.cell');
    const board = t.closest('[data-board]');
    if (!cell || !board || !view) return;
    const x = Number(cell.getAttribute('data-x'));
    const y = Number(cell.getAttribute('data-y'));
    const which = board.getAttribute('data-board');
    if (which === 'mine' && view.phase === 'place' && !view.ready[view.you]) return onPlaceTap(x, y);
    if (which === 'theirs' && view.phase === 'aim' && view.turn === view.you) {
      if (view.theirs.shots[y * view.size + x] !== 0) return;
      if (aim && aim.x === x && aim.y === y) return fire();
      aim = { x: x, y: y };
      api.vibrate(10);
      render();
    }
  }

  function fire() {
    api.send({ type: 'fire', x: aim.x, y: aim.y });
    api.vibrate(30);
    aim = null;
  }

  function status(v) {
    const you = v.you;
    const s = v.lastShot;
    if (v.phase === 'place') {
      if (v.ready[you]) return 'Fleet ready. ' + (v.ready[1 - you] ? 'Starting…' : 'Waiting for your opponent…');
      return note || 'Tap a ship, then tap where it goes. Tap it again to turn it.';
    }
    if (v.phase === 'aim') {
      if (v.turn === you) return '<strong>Your turn!</strong> Tap a square, tap again to fire · ' + Math.ceil(v.timeLeftMs / 1000) + 's';
      return 'Their turn…';
    }
    if (v.phase === 'shot' && s) {
      const mine = s.by === you;
      if (s.result === 'miss') return mine ? '💦 You missed' : '💦 They missed';
      if (s.result === 'hit') return mine ? '💥 <strong>Hit!</strong>' : '💥 They hit you at ' + ArkSea.coord(s.x, s.y);
      return mine ? '🔥 <strong>You sank their ' + s.ship + '!</strong>' : '🔥 They sank your ' + s.ship;
    }
    return '';
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    const you = v.you;
    const score = 'Your fleet: ' + v.mine.afloat + ' afloat · Theirs: ' + v.theirs.afloat + ' afloat';

    if (v.phase === 'over') {
      const won = v.winner === you;
      root.innerHTML =
        '<div class="score">' + score + '</div>' +
        '<div class="outcome ' + (won ? 'won' : 'lost') + '">' + (won ? 'You win! 🏆' : 'You lose') + '</div>' +
        '<div class="label">Their fleet</div>' +
        '<div data-board="theirs" class="big-board">' + ArkSea.gridHtml({ size: v.size, shots: v.theirs.shots, ships: v.theirs.ships }) + '</div>' +
        '<button class="primary rematch">Rematch</button>';
      return;
    }

    if (v.phase === 'place') {
      const ready = v.ready[you];
      const ships = (ready ? v.mine.ships : fleet.map(function (s, i) {
        return { x: s.x, y: s.y, dir: s.dir, len: v.fleet[i].len };
      }));
      root.innerHTML =
        '<div class="score">Place your fleet · ⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's</div>' +
        '<p class="msg">' + status(v) + '</p>' +
        '<div data-board="mine" class="big-board' + (ready ? ' locked' : '') + '">' +
        ArkSea.gridHtml({ size: v.size, ships: ships, selected: ready ? null : selected }) + '</div>' +
        (ready
          ? '<div class="bs-tools"><button class="unready">Change fleet</button></div>'
          : '<div class="bs-tools"><button class="shuffle">🔀 Shuffle</button><button class="primary ready">Ready ✓</button></div>');
      return;
    }

    // Battle: enemy waters on top (tap to aim), your own fleet below.
    const myTurn = v.phase === 'aim' && v.turn === you;
    const s = v.lastShot;
    root.innerHTML =
      '<div class="score">' + score + '</div>' +
      '<p class="msg">' + status(v) + '</p>' +
      '<div data-board="theirs" class="big-board' + (myTurn ? ' live' : '') + '">' +
      ArkSea.gridHtml({ size: v.size, shots: v.theirs.shots, ships: v.theirs.ships, aim: myTurn ? aim : null, last: s && s.by === you ? s : null }) + '</div>' +
      '<div class="bs-tools"><button class="primary fire"' + (myTurn && aim ? '' : ' disabled') + '>🎯 Fire' + (aim && myTurn ? ' at ' + ArkSea.coord(aim.x, aim.y) : '') + '</button></div>' +
      '<div class="label">Your fleet</div>' +
      '<div data-board="mine" class="small-board">' + ArkSea.gridHtml({ size: v.size, shots: v.mine.shots, ships: v.mine.ships, last: s && s.by !== you ? s : null }) + '</div>';
  }

  function update(v) {
    const prev = view;
    view = v;
    if (v.phase === 'place' && (!prev || prev.phase !== 'place' || !fleet)) {
      fleet = v.mine.ships.map(function (s) { return { x: s.x, y: s.y, dir: s.dir }; });
      selected = null;
      note = '';
    }
    if (v.phase !== 'aim' || v.turn !== v.you) aim = null;
    const s = v.lastShot;
    const key = s ? [s.by, s.x, s.y].join(',') : '';
    if (s && key !== lastShotKey && v.phase === 'shot') {
      if (s.by === v.you && s.result !== 'miss') api.vibrate(60);
      if (s.by !== v.you && s.result !== 'miss') api.vibrate([100, 50, 100]);
    }
    lastShotKey = key;
    render();
  }

  Ark.register('player', 'battleship', {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'bs-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
      gridReady.then(function () {
        loaded = true;
        render();
      });
    },
    update: update,
    unmount: function () {
      root = view = fleet = aim = null;
      selected = null;
      note = lastShotKey = '';
    },
  });
})();
