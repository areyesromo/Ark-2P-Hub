// Ultimate Battleship on the phone (server/games/battleship-ultimate.js): pick your commander,
// place their fleet (tap a ship, tap where it goes, ↻ to turn it), then battle. On your turn,
// pick 🎯 a shot, a skill (paid with ⚡ energy) or your ⭐ special, tap where it lands on their
// sea (↔/↕ turns a line, ⬅/➡ picks the side a torpedo comes from), then fire.
(function () {
  const U = window.ArkUltimate;
  let root = null;
  let api = null;
  let view = null;
  let fleet = null; // your ships while placing: [{ x, y, rot }]
  let selected = null;
  let note = '';
  let action = 'shot'; // 'shot', a skill id, or 'special'
  let aim = null; // { x, y, x2, y2 }
  let dir = 'h';
  let from = 'w';
  let lastKey = '';

  // ---- placing ----------------------------------------------------------------------------

  function cellsOf(i, s) {
    return view.fleetDefs[i].rots[s.rot].map(function (c) { return [s.x + c[0], s.y + c[1]]; });
  }

  /** The same rule as the server: on water, no overlaps; shallows take ships of 3 cells or fewer. */
  function fits(ships) {
    const taken = {};
    return ships.every(function (s, i) {
      const cells = cellsOf(i, s);
      return cells.every(function (c) {
        const row = view.rows[c[1]];
        const t = row && row[c[0]];
        const k = c[0] + ',' + c[1];
        if (!t || t === '#' || t === '*' || t === '^' || taken[k] || (t === '~' && cells.length > 3)) return false;
        taken[k] = true;
        return true;
      });
    });
  }

  function shipAt(x, y) {
    for (let i = 0; i < fleet.length; i++) if (cellsOf(i, fleet[i]).some(function (c) { return c[0] === x && c[1] === y; })) return i;
    return -1;
  }

  function tryPlace(i, s) {
    const trial = fleet.slice();
    trial[i] = s;
    if (!fits(trial)) return false;
    fleet = trial;
    return true;
  }

  function onPlaceTap(x, y) {
    const hit = shipAt(x, y);
    note = '';
    if (hit !== -1) selected = hit;
    else if (selected !== null) {
      if (!tryPlace(selected, { x: x, y: y, rot: fleet[selected].rot })) note = "It won't fit there.";
    } else note = 'Tap a ship first.';
    api.vibrate(10);
    render();
  }

  function turnSelected() {
    if (selected === null) return;
    const s = fleet[selected];
    // Turn it, nudging it back onto the sea if the turn pushes it over an edge.
    for (let dy = 0; dy > -5; dy--) {
      for (let dx = 0; dx > -5; dx--) {
        if (tryPlace(selected, { x: s.x + dx, y: s.y + dy, rot: (s.rot + 1) % 4 })) { note = ''; return; }
      }
    }
    note = 'No room to turn it there.';
  }

  // ---- battle -----------------------------------------------------------------------------

  /** What the chosen action aims like: 'cell' for a shot, or the skill's or special's aim. */
  function aimKind(v) {
    if (action === 'shot') return 'cell';
    if (action === 'special') return mine(v).special.aim;
    return v.skillDefs[action].aim;
  }

  function mine(v) {
    return v.roster.find(function (c) { return c.id === v.yourCommander; });
  }

  function canUse(v, a) {
    if (a === 'shot') return true;
    if (a === 'special') return v.charge[v.you] >= v.chargeNeeded[v.you];
    return v.skills.indexOf(a) !== -1 && v.energy[v.you] >= v.skillDefs[a].cost;
  }

  function onBattleTap(board, x, y) {
    const v = view;
    if (v.phase !== 'aim' || v.turn !== v.you) return;
    const kind = aimKind(v);
    if (kind === 'none') return;
    if ((kind === 'own2') !== (board === 'mine')) return; // a shield goes on your own sea; the rest on theirs
    // A plain shot only on a square you can still hit (not land, ice or lava, not shot already).
    const t = v.rows[y][x];
    if (kind === 'cell' && (t === '#' || t === '*' || t === '^' || v.theirs.shots[y * v.size.w + x] !== 0)) return;
    if (kind === 'two' && aim && aim.x2 === undefined && !(aim.x === x && aim.y === y)) aim = { x: aim.x, y: aim.y, x2: x, y2: y };
    else if (kind === 'cell' && aim && aim.x === x && aim.y === y) return fire();
    else aim = { x: x, y: y };
    api.vibrate(10);
    render();
  }

  function ready(v) {
    const kind = aimKind(v);
    if (kind === 'none') return true;
    if (!aim) return false;
    return kind !== 'two' || aim.x2 !== undefined;
  }

  function fire() {
    const v = view;
    if (!ready(v)) return;
    const a = aim || {};
    if (action === 'shot') api.send({ type: 'fire', x: a.x, y: a.y });
    else if (action === 'special') api.send({ type: 'special', x: a.x, y: a.y, dir: dir, from: from });
    else api.send({ type: 'skill', skill: action, x: a.x, y: a.y, x2: a.x2, y2: a.y2, dir: dir, from: from });
    api.vibrate(30);
    aim = null;
    action = 'shot';
  }

  // ---- screens ----------------------------------------------------------------------------

  function pickScreen(v) {
    const picked = v.commanders[v.you];
    if (picked) return '<div class="ub-wait"><div class="big">✅</div><p>Commander picked. ' + (v.commanders[1 - v.you] ? 'Starting…' : 'Waiting for your rival…') + '</p></div>';
    return '<p class="msg">Pick your commander: their fleet, their skills and their special.' + (v.timed ? ' ⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's, then one is picked for you.' : '') + '</p><div class="ub-roster">' + v.roster.map(function (c) {
      return '<div class="ub-card"><div class="ub-head"><span class="ub-icon">' + c.icon + '</span><div><b>' + c.name + '</b><small>' + c.style + '</small></div></div>' +
        '<div class="ub-special">⭐ <b>' + c.special.name + '</b>: ' + c.special.about + '</div>' +
        '<div class="ub-ships">' + c.fleet.map(function (s) {
          return '<span title="' + s.name + '">' + U.shapeHtml(s.cells) + (s.skill ? v.skillDefs[s.skill].icon : '') + '</span>';
        }).join('') + '</div>' +
        '<button class="primary" data-pick="' + c.id + '">Pick ' + c.name.split(' ')[1] + '</button></div>';
    }).join('') + '</div>';
  }

  function placeScreen(v) {
    const me = mine(v);
    const isReady = v.ready[v.you];
    const ships = (isReady ? v.mine.ships : fleet.map(function (s, i) { return { i: i, cells: cellsOf(i, s) }; }));
    const sel = selected !== null && !isReady ? v.fleetDefs[selected] : null;
    return '<div class="score">' + me.icon + ' ' + me.name + ' · ' + v.seaName + (v.timed ? ' · ⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's' : '') + '</div>' +
      '<p class="msg">' + (isReady ? 'Fleet ready. ' + (v.ready[1 - v.you] ? 'Starting…' : 'Waiting for your rival…') : note || (sel ? sel.name + (sel.skill ? ' · ' + v.skillDefs[sel.skill].icon + ' ' + v.skillDefs[sel.skill].name : '') + ': tap where it goes, or ↻ to turn it' : 'Tap a ship, then where it goes. ↻ turns it.')) + '</p>' +
      '<div data-board="mine" class="ub-board">' + U.seaHtml({ rows: v.rows, ships: ships, selected: isReady ? null : selected }) + '</div>' +
      (isReady
        ? '<div class="bs-tools"><button class="unready">Change fleet</button></div>'
        : '<div class="bs-tools"><button class="turn"' + (selected === null ? ' disabled' : '') + '>↻ Turn</button><button class="shuffle">🔀 Shuffle</button><button class="primary ready">Ready ✓</button></div>');
  }

  function battleScreen(v) {
    const you = v.you;
    const me = mine(v);
    const myTurn = v.phase === 'aim' && v.turn === you;
    const kind = myTurn ? aimKind(v) : null;
    const mark = myTurn && aim ? U.footprint(kind === 'cell' ? 'cell' : kind, { x: aim.x, y: aim.y, x2: aim.x2, y2: aim.y2, dir: dir }, v.size) : [];
    const special = me.special;
    const acts = '<div class="ub-acts">' +
      '<button data-act="shot" class="' + (action === 'shot' ? 'on' : '') + '">🎯 Shot</button>' +
      v.skills.map(function (k) {
        const d = v.skillDefs[k];
        return '<button data-act="' + k + '" class="' + (action === k ? 'on' : '') + '"' + (canUse(v, k) ? '' : ' disabled') + '>' + d.icon + ' ' + d.name + '<small>⚡' + d.cost + '</small></button>';
      }).join('') +
      '<button data-act="special" class="special ' + (action === 'special' ? 'on' : '') + '"' + (canUse(v, 'special') ? '' : ' disabled') + '>⭐ ' + special.name + '</button></div>';
    const lines = kind === 'line3' || kind === 'line5';
    const sides = kind === 'row' || kind === 'rows3';
    const about = action === 'shot' ? 'Tap a square on their sea, then tap again (or Fire)' : action === 'special' ? special.about : v.skillDefs[action].about;
    let msg;
    if (v.phase === 'shot' || !myTurn) msg = v.last ? U.lastText(v, you) : 'Their turn…';
    else msg = (v.eruption ? '🌋 <strong>The volcano erupted!</strong> ' : v.eruptIn !== null && v.eruptIn <= 2 ? '🌋 Eruption in ' + v.eruptIn + '! ' : '') + '<strong>Your turn.</strong> ' + about + (kind === 'own2' ? ' (on your own sea, below)' : kind === 'two' && aim && aim.x2 === undefined ? ': now the second square' : '');
    return '<div class="ub-meters"><span>⚡ ' + U.pips(v.energy[you], 10, 'energy') + '</span><span>⭐ ' + U.pips(v.charge[you], v.chargeNeeded[you], 'charge') + '</span></div>' +
      '<p class="msg">' + msg + (v.timed && myTurn ? ' · ' + Math.ceil(v.timeLeftMs / 1000) + 's' : '') + '</p>' +
      '<div class="label">Their sea · ' + v.theirs.afloat + ' afloat</div>' +
      '<div data-board="theirs" class="ub-board' + (myTurn && kind !== 'own2' ? ' live' : '') + '">' +
      U.seaHtml({ rows: v.rows, shots: v.theirs.shots, ships: v.theirs.ships, spotted: v.theirs.spotted, sonar: v.sonar.filter(function (s) { return s.by === you; }), mark: kind === 'own2' ? [] : mark, fx: v.last && v.phase === 'shot' && v.last.by === you ? v.last : v.eruption && v.eruption[1 - you].length ? { kind: 'eruption', cells: v.eruption[1 - you] } : null, frozen: v.frozen[1 - you] }) + '</div>' +
      (myTurn ? acts + '<div class="bs-tools">' +
        (lines ? '<button class="dir">' + (dir === 'h' ? '↔ Across' : '↕ Down') + '</button>' : '') +
        (sides ? '<button class="side">' + (from === 'w' ? '➡ From the left' : '⬅ From the right') + '</button>' : '') +
        '<button class="primary fire"' + (ready(v) ? '' : ' disabled') + '>Fire' + (aim && kind === 'cell' ? ' at ' + U.coord(aim.x, aim.y) : '') + '</button></div>' : '') +
      '<div class="label">Your fleet · ' + v.mine.afloat + ' afloat</div>' +
      '<div data-board="mine" class="ub-board small' + (kind === 'own2' ? ' live' : '') + '">' +
      U.seaHtml({ rows: v.rows, shots: v.mine.shots, ships: v.mine.ships, shields: v.mine.shields, mark: kind === 'own2' ? mark : [], fx: v.last && v.phase === 'shot' && v.last.by !== you ? v.last : v.eruption && v.eruption[you].length ? { kind: 'eruption', cells: v.eruption[you] } : null, frozen: v.frozen[you] }) + '</div>';
  }

  function overScreen(v) {
    const won = v.winner === v.you;
    return '<div class="outcome ' + (won ? 'won' : 'lost') + '">' + (won ? 'You win! 🏆' : 'You lose') + '</div>' +
      '<div class="label">Their fleet</div><div data-board="theirs" class="ub-board">' + U.seaHtml({ rows: v.rows, shots: v.theirs.shots, ships: v.theirs.ships }) + '</div>' +
      '<button class="primary rematch">Rematch</button>';
  }

  function render() {
    if (!root || !view) return;
    const v = view;
    let html;
    if (v.phase === 'pick') html = pickScreen(v);
    else if (v.phase === 'place') html = placeScreen(v);
    else if (v.phase === 'over') html = overScreen(v);
    else html = battleScreen(v);
    root.innerHTML = html;
  }

  function onClick(e) {
    const btn = e.target.closest('button');
    const v = view;
    if (btn && v) {
      const pick = btn.getAttribute('data-pick');
      const act = btn.getAttribute('data-act');
      if (pick) api.send({ type: 'commander', id: pick });
      else if (act) { action = act; aim = null; }
      else if (btn.classList.contains('turn')) turnSelected();
      else if (btn.classList.contains('shuffle')) { fleet = v.placing ? shuffled() : fleet; selected = null; note = ''; }
      else if (btn.classList.contains('ready')) { api.send({ type: 'ready', ships: fleet }); selected = null; }
      else if (btn.classList.contains('unready')) api.send({ type: 'unready' });
      else if (btn.classList.contains('dir')) dir = dir === 'h' ? 'v' : 'h';
      else if (btn.classList.contains('side')) from = from === 'w' ? 'e' : 'w';
      else if (btn.classList.contains('fire')) fire();
      else if (btn.classList.contains('rematch')) api.send({ type: 'rematch' });
      api.vibrate(10);
      render();
      return;
    }
    const cell = e.target.closest('.cell');
    const board = e.target.closest('[data-board]');
    if (!cell || !board || !v) return;
    const x = Number(cell.getAttribute('data-x'));
    const y = Number(cell.getAttribute('data-y'));
    if (v.phase === 'place' && !v.ready[v.you] && board.getAttribute('data-board') === 'mine') return onPlaceTap(x, y);
    onBattleTap(board.getAttribute('data-board'), x, y);
  }

  /** A fresh random fleet, placed here on the phone (the same rules as the server). */
  function shuffled() {
    const w = view.size.w;
    const h = view.size.h;
    for (let attempt = 0; attempt < 50; attempt++) {
      const ships = [];
      for (let tries = 0; ships.length < view.fleetDefs.length && tries < 600; tries++) {
        const s = { x: Math.floor(Math.random() * w), y: Math.floor(Math.random() * h), rot: Math.floor(Math.random() * 4) };
        const trial = ships.concat([s]);
        const saved = fleet;
        fleet = trial;
        const ok = fits(trial);
        fleet = saved;
        if (ok) ships.push(s);
      }
      if (ships.length === view.fleetDefs.length) return ships;
    }
    return fleet;
  }

  function update(v) {
    const prev = view;
    view = v;
    if (v.phase === 'place' && v.placing && (!prev || prev.phase !== 'place' || !fleet)) {
      fleet = v.placing.map(function (s) { return { x: s.x, y: s.y, rot: s.rot }; });
      selected = null;
      note = '';
    }
    if (v.phase !== 'aim' || v.turn !== v.you) { aim = null; action = 'shot'; }
    else if (!canUse(v, action)) action = 'shot';
    const l = v.last;
    const k = l ? JSON.stringify([l.by, l.kind, l.cells]) : '';
    if (l && k !== lastKey && v.phase === 'shot') {
      const hit = l.cells.some(function (c) { return c.result === 'hit' || c.result === 'sunk'; });
      if (hit) api.vibrate(l.by === v.you ? 60 : [100, 50, 100]);
    }
    lastKey = k;
    render();
  }

  window.ArkUltimate.player = {
    mount: function (el, a) {
      api = a;
      root = document.createElement('div');
      root.className = 'bs-phone ub-phone';
      root.addEventListener('click', onClick);
      el.appendChild(root);
    },
    update: update,
    unmount: function () {
      if (root && root.parentNode) root.parentNode.removeChild(root);
      root = view = fleet = aim = null;
      selected = null;
      action = 'shot';
      lastKey = note = '';
    },
  };
})();
