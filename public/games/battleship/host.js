(function () {
  Ark.loadCss('/games/battleship/style.css');
  const gridReady = Ark.loadScript('/games/battleship/grid.js');
  const esc = Ark.escapeHtml;

  let root = null;
  let view = null;
  let loaded = false;
  const cursors = {}; // controller players aim with a cursor: slot -> { x, y }
  let host = null; // the element the TV screen lives in
  // Ultimate mode has its own screen (ultimate.js, ultimate-host.js), loaded when needed.
  let ultimate = null;
  let ultimateLoading = null;
  let ultimateView = null;
  let generation = 0; // bumped on every unmount and switch back to Classic: a late load is dropped

  function toUltimate(v) {
    ultimateView = v;
    if (ultimate) return ultimate.update(v);
    if (ultimateLoading) return;
    const mine = generation;
    ultimateLoading = Ark.loadScript('/games/battleship/ultimate.js')
      .then(function () { return Ark.loadScript('/games/battleship/ultimate-host.js'); })
      .then(function () {
        if (!host || mine !== generation) return;
        if (root) root.style.display = 'none';
        ultimate = window.ArkUltimate.host;
        ultimate.mount(host);
        ultimate.update(ultimateView);
      })
      .catch(function () { ultimateLoading = null; });
  }

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function secs(ms) {
    return Math.ceil(ms / 1000);
  }

  function clock(ms) {
    const s = secs(ms);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }

  function banner(v) {
    const s = v.lastShot;
    if (v.phase === 'place') {
      return '<div class="big">Hide your fleets!</div><div class="sub">Place your ships on your phone, then tap Ready' + (v.timed ? ' · ⏱ ' + clock(v.timeLeftMs) : '') + '</div>';
    }
    if (v.phase === 'aim') {
      return '<div class="big">' + nameOf(v, v.turn) + ' to fire</div><div class="sub">' + (v.timed ? '⏱ ' + secs(v.timeLeftMs) + 's' : '') +
        (s ? (v.timed ? ' · ' : '') + 'last: ' + nameOf(v, s.by) + ' → ' + ArkSea.coord(s.x, s.y) + ' ' + (s.result === 'miss' ? 'miss' : s.result === 'hit' ? 'hit' : 'sank the ' + esc(s.ship)) : '') + '</div>';
    }
    if (v.phase === 'shot' && s) {
      const what = s.result === 'miss' ? '💦 Miss' : s.result === 'hit' ? '💥 Hit!' : '🔥 Sunk the ' + esc(s.ship) + '!';
      return '<div class="big shot-' + s.result + '">' + what + '</div><div class="sub">' + nameOf(v, s.by) + ' fired at ' + ArkSea.coord(s.x, s.y) + '</div>';
    }
    if (v.phase === 'over') {
      const w = v.winner;
      const acc = function (slot) { return v.fired[slot] ? Math.round((100 * v.hits[slot]) / v.fired[slot]) : 0; };
      return '<div class="big">🏆 ' + nameOf(v, w) + ' wins!</div><div class="sub">' +
        'Sank the whole fleet in ' + v.fired[w] + ' shots (' + acc(w) + '% hits vs ' + acc(1 - w) + '%) · ' +
        'Rematch or head back to the lobby from your phones or controllers.</div>';
    }
    return '';
  }

  function side(v, slot) {
    const b = v.boards[slot];
    const shooter = 1 - slot; // this grid is what the other player fires at
    const targeted = (v.phase === 'aim' || v.phase === 'shot') && v.turn === shooter;
    let status = '';
    if (v.phase === 'place') status = v.ready[slot] ? '✅ Fleet ready' : '⏳ Placing ships…';
    else status = b.afloat + ' ship' + (b.afloat === 1 ? '' : 's') + ' afloat';
    const s = v.lastShot;
    const cursor = v.phase === 'aim' && v.turn === shooter && v.players[shooter].local && cursors[shooter];
    return (
      '<div class="bs-side' + (targeted ? ' targeted' : '') + (v.phase === 'over' && v.winner === slot ? ' winner' : '') + '">' +
      '<div class="bs-title">' + nameOf(v, slot) + '<span class="muted">’s waters</span></div>' +
      ArkSea.gridHtml({
        size: v.size,
        shots: b.shots,
        ships: b.ships,
        labels: true,
        last: s && s.by === shooter ? s : null,
        cursor: cursor || null,
      }) +
      '<div class="bs-status">' + ArkSea.fleetHtml(v.fleet, b.ships.filter(function (x) { return x.sunk; }).map(function (x) { return x.name; })) +
      '<span>' + status + '</span></div>' +
      '</div>'
    );
  }

  function render() {
    if (!root || !view || !loaded) return;
    const v = view;
    root.innerHTML =
      '<div class="bs-banner">' + banner(v) + '</div>' +
      '<div class="bs-seas">' + side(v, 0) + side(v, 1) + '</div>';
  }

  const MOVES = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] };

  Ark.register('host', 'battleship', {
    // Sound: splash for a miss, a bang for a hit, a bigger one for a sinking.
    sounds: function (prev, v) {
      if (v.ultimate || prev.ultimate) return ultimate && v.ultimate && prev.ultimate ? ultimate.sounds(prev, v) : [];
      const out = [];
      if (v.ready.filter(Boolean).length > prev.ready.filter(Boolean).length) out.push('lock');
      const s = v.lastShot;
      const p = prev.lastShot;
      if (s && (!p || s.by !== p.by || s.x !== p.x || s.y !== p.y || v.fired.join() !== prev.fired.join())) {
        out.push(s.result === 'miss' ? 'splash' : s.result === 'hit' ? 'boom' : 'bigBoom');
      }
      return out;
    },
    padHint: 'D-pad aims · A fires · your fleet is placed at random (it stays hidden) · Ultimate: ←→ A pick a commander, LB/RB shot, skill or special, Y turns a line',
    pad: function (btn, v, slot) {
      if (v.ultimate) return ultimate ? ultimate.pad(btn, v, slot) : null;
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase !== 'aim' || v.turn !== slot) return null;
      const c = cursors[slot] || (cursors[slot] = { x: Math.floor(v.size / 2), y: Math.floor(v.size / 2) });
      if (MOVES[btn]) {
        c.x = Math.min(v.size - 1, Math.max(0, c.x + MOVES[btn][0]));
        c.y = Math.min(v.size - 1, Math.max(0, c.y + MOVES[btn][1]));
        render();
        return null;
      }
      if (btn === 'A' && v.boards[1 - slot].shots[c.y * v.size + c.x] === 0) return { type: 'fire', x: c.x, y: c.y };
      return null;
    },
    mount: function (el) {
      host = el;
      root = document.createElement('div');
      root.className = 'bs-host';
      el.appendChild(root);
      gridReady.then(function () {
        loaded = true;
        render();
      });
    },
    update: function (v) {
      if (v.ultimate) return toUltimate(v);
      if (ultimate || ultimateLoading) { // back to Classic (a new setup), or a load that's no longer wanted
        generation++;
        if (ultimate) ultimate.unmount();
        ultimate = ultimateLoading = null;
        if (root) root.style.display = '';
      }
      view = v;
      render();
    },
    unmount: function () {
      if (ultimate) ultimate.unmount();
      generation++;
      ultimate = ultimateLoading = ultimateView = host = null;
      root = view = null;
      Object.keys(cursors).forEach(function (k) { delete cursors[k]; });
    },
  });
})();
