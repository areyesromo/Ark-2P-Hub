// Ultimate Battleship on the TV (server/games/battleship-ultimate.js): both seas with their
// terrain, what each shot or skill did, each commander's ⚡ energy and ⭐ special, sonar readings,
// and the commander pick. Controller players: ←→ and A pick a commander; then the D-pad aims,
// LB / RB pick the shot, a skill or the special, Y turns a line (or a torpedo's side), A fires.
(function () {
  const U = window.ArkUltimate;
  const esc = Ark.escapeHtml;
  let root = null;
  let view = null;
  const pads = {}; // controller players: slot -> { pick, x, y, act, dir, from, first }

  function nameOf(v, slot) {
    return '<span class="p' + (slot + 1) + '-text">' + esc(v.players[slot].name) + '</span>';
  }

  function cmd(v, slot) {
    const id = v.commanders[slot];
    return v.roster.find(function (c) { return c.id === id; });
  }

  function padOf(v, slot) {
    if (!pads[slot]) pads[slot] = { pick: 0, x: Math.floor(v.size.w / 2), y: Math.floor(v.size.h / 2), act: 'shot', dir: 'h', from: 'w', first: null };
    return pads[slot];
  }

  /** The actions a controller player can cycle through: the shot, their skills, their special. */
  function actsOf(v, slot) {
    const c = cmd(v, slot);
    const skills = [];
    if (c) c.fleet.forEach(function (s, i) {
      if (s.skill && skills.indexOf(s.skill) === -1 && !v.boards[slot].ships.some(function (x) { return x.i === i && x.sunk; })) skills.push(s.skill);
    });
    return ['shot'].concat(skills, ['special']);
  }

  function actName(v, slot, act) {
    if (act === 'shot') return '🎯 Shot';
    if (act === 'special') return '⭐ ' + cmd(v, slot).special.name;
    const d = v.skillDefs[act];
    return d.icon + ' ' + d.name + ' (⚡' + d.cost + ')';
  }

  function banner(v) {
    if (v.phase === 'pick') {
      return '<div class="big">Pick your commanders</div><div class="sub">On your phones (controllers: ←→ and A)' + (v.timed ? ' · ⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's, then one is picked for you' : '') + '. ' +
        [0, 1].map(function (s) { return nameOf(v, s) + (v.commanders[s] ? ' ✅' : ' …'); }).join(' · ') + '</div>';
    }
    if (v.phase === 'place') {
      return '<div class="big">Hide your fleets!</div><div class="sub">' + esc(v.seaName) + ' · place your ships on your phone, then tap Ready</div>';
    }
    if (v.phase === 'over' && v.winner === null) return '<div class="big">🌋 A draw!</div><div class="sub">The volcano took both fleets. Rematch or head back to the lobby from your phones or controllers.</div>';
    if (v.phase === 'over') return '<div class="big">🏆 ' + nameOf(v, v.winner) + ' wins!</div><div class="sub">Rematch or head back to the lobby from your phones or controllers.</div>';
    const last = v.last ? U.lastText(v, -1, function (s) { return nameOf(v, s); }) : '';
    if (v.phase === 'shot') return '<div class="big">' + last + '</div>';
    const p = v.players[v.turn].local && pads[v.turn] ? ' · 🎮 ' + actName(v, v.turn, pads[v.turn].act) : '';
    const volcano = v.eruption ? '🌋 The volcano erupted! · ' : v.eruptIn !== null ? '🌋 Eruption in ' + v.eruptIn + ' turn' + (v.eruptIn === 1 ? '' : 's') + ' · ' : '';
    return '<div class="big">' + nameOf(v, v.turn) + ' to fire' + p + '</div><div class="sub">' + volcano + (v.timed ? '⏱ ' + Math.ceil(v.timeLeftMs / 1000) + 's · ' : '') + last + '</div>';
  }

  function side(v, slot) {
    const b = v.boards[slot];
    const shooter = 1 - slot; // this sea is what the other player fires at
    const c = cmd(v, slot);
    const pad = v.phase === 'aim' && v.turn === shooter && v.players[shooter].local && pads[shooter];
    const ownPad = v.phase === 'aim' && v.turn === slot && v.players[slot].local && pads[slot] && pads[slot].act === 'shield';
    const cursor = pad ? { x: pad.x, y: pad.y } : ownPad ? { x: pads[slot].x, y: pads[slot].y } : null;
    let mark = [];
    if (pad && pad.act !== 'shot' && pad.act !== 'shield') {
      const aim = pad.act === 'special' ? cmd(v, shooter).special.aim : v.skillDefs[pad.act].aim;
      mark = U.footprint(aim, { x: pad.x, y: pad.y, dir: pad.dir }, v.size);
      if (pad.first) mark.push([pad.first.x, pad.first.y]); // a Double Shot's first square, picked
    }
    const head = c ? '<span class="ub-icon">' + c.icon + '</span> ' + nameOf(v, slot) + ' <span class="muted">' + esc(c.name) + '</span>' : nameOf(v, slot);
    const meters = c && v.phase !== 'place'
      ? '<div class="ub-meters"><span>⚡ ' + U.pips(v.energy[slot], 10, 'energy') + '</span><span>⭐ ' + U.pips(v.charge[slot], v.chargeNeeded[slot], 'charge') + '</span>' + (v.frozen[slot] ? '<span>🧊 Frozen</span>' : '') + '</div>'
      : '<div class="ub-meters">' + (v.phase === 'place' ? (v.ready[slot] ? '✅ Fleet ready' : '⏳ Placing ships…') : '') + '</div>';
    return '<div class="bs-side' + ((v.phase === 'aim' || v.phase === 'shot') && v.turn === shooter ? ' targeted' : '') + (v.phase === 'over' && v.winner === slot ? ' winner' : '') + '">' +
      '<div class="bs-title">' + head + '</div>' + meters +
      U.seaHtml({ id: 'sea' + slot, rows: v.rows, shots: b.shots, ships: b.ships, sonar: v.sonar.filter(function (s) { return s.by === shooter; }), mark: mark, cursor: cursor,
        fx: v.last && v.phase === 'shot' && v.last.by === shooter ? v.last : v.eruption && v.eruption[slot].length ? { kind: 'eruption', cells: v.eruption[slot] } : null, frozen: v.frozen[slot] }) +
      '<div class="bs-status"><span>' + (b.afloat === null ? '' : b.afloat + ' ship' + (b.afloat === 1 ? '' : 's') + ' afloat') + '</span></div></div>';
  }

  function pickPanel(v) {
    const local = [0, 1].filter(function (s) { return v.players[s].local && !v.commanders[s]; });
    return '<div class="ub-roster tv">' + v.roster.map(function (c, i) {
      const on = local.filter(function (s) { return padOf(v, s).pick === i; }).map(function (s) { return ' aim p' + (s + 1); }).join('');
      return '<div class="ub-card' + on + '"><div class="ub-head"><span class="ub-icon">' + c.icon + '</span><div><b>' + esc(c.name) + '</b><small>' + esc(c.style) + '</small></div></div>' +
        '<div class="ub-special">⭐ <b>' + esc(c.special.name) + '</b>: ' + esc(c.special.about) + '</div>' +
        '<div class="ub-ships">' + c.fleet.map(function (s) { return '<span>' + U.shapeHtml(s.cells) + (s.skill ? v.skillDefs[s.skill].icon : '') + '</span>'; }).join('') + '</div></div>';
    }).join('') + '</div>';
  }

  function render() {
    if (!root || !view) return;
    const v = view;
    root.innerHTML = '<div class="bs-banner">' + banner(v) + '</div>' +
      (v.phase === 'pick' ? pickPanel(v) : '<div class="bs-seas">' + side(v, 0) + side(v, 1) + '</div>');
  }

  const MOVES = { UP: [0, -1], DOWN: [0, 1], LEFT: [-1, 0], RIGHT: [1, 0] };

  window.ArkUltimate.host = {
    sounds: function (prev, v) {
      const out = [];
      if (v.ready.filter(Boolean).length > prev.ready.filter(Boolean).length) out.push('lock');
      const l = v.last;
      if (l && v.phase === 'shot' && prev.phase !== 'shot') {
        const r = l.cells.map(function (c) { return c.result; });
        out.push(r.indexOf('sunk') !== -1 ? 'bigBoom' : r.indexOf('hit') !== -1 ? 'boom' : l.kind === 'skill' && !r.length ? 'reveal' : 'splash');
      }
      return out;
    },
    pad: function (btn, v, slot) {
      const p = padOf(v, slot);
      if (v.phase === 'over') return btn === 'A' || btn === 'START' ? { type: 'rematch' } : null;
      if (v.phase === 'pick') {
        if (v.commanders[slot]) return null;
        if (btn === 'LEFT' || btn === 'RIGHT') {
          p.pick = (p.pick + (btn === 'LEFT' ? -1 : 1) + v.roster.length) % v.roster.length;
          render();
          return null;
        }
        return btn === 'A' ? { type: 'commander', id: v.roster[p.pick].id } : null;
      }
      if (v.phase !== 'aim' || v.turn !== slot) return null;
      if (MOVES[btn]) {
        p.x = Math.min(v.size.w - 1, Math.max(0, p.x + MOVES[btn][0]));
        p.y = Math.min(v.size.h - 1, Math.max(0, p.y + MOVES[btn][1]));
        render();
        return null;
      }
      if (btn === 'LB' || btn === 'RB') {
        const acts = actsOf(v, slot);
        p.act = acts[(acts.indexOf(p.act) + (btn === 'LB' ? -1 : 1) + acts.length) % acts.length];
        p.first = null;
        render();
        return null;
      }
      if (btn === 'Y') {
        p.dir = p.dir === 'h' ? 'v' : 'h';
        p.from = p.from === 'w' ? 'e' : 'w';
        render();
        return null;
      }
      if (btn !== 'A') return null;
      if (p.act === 'shot') return { type: 'fire', x: p.x, y: p.y };
      if (p.act === 'special') return { type: 'special', x: p.x, y: p.y, dir: p.dir, from: p.from };
      if (v.skillDefs[p.act].aim === 'two') {
        if (!p.first) { p.first = { x: p.x, y: p.y }; render(); return null; }
        const f = p.first;
        p.first = null;
        return { type: 'skill', skill: p.act, x: f.x, y: f.y, x2: p.x, y2: p.y };
      }
      return { type: 'skill', skill: p.act, x: p.x, y: p.y, dir: p.dir, from: p.from };
    },
    mount: function (el) {
      root = document.createElement('div');
      root.className = 'bs-host ub-host';
      el.appendChild(root);
    },
    update: function (v) {
      view = v;
      [0, 1].forEach(function (s) {
        const p = pads[s];
        if (!p) return;
        if (v.phase !== 'aim') p.first = null;
        // Back on the sea (a new one may be smaller), and back to the shot if the chosen action's gone.
        p.x = Math.min(v.size.w - 1, p.x);
        p.y = Math.min(v.size.h - 1, p.y);
        if (v.phase === 'pick' || (v.phase === 'aim' && v.commanders[s] && v.commanders[s] !== 'picked' && actsOf(v, s).indexOf(p.act) === -1)) p.act = 'shot';
      });
      render();
    },
    unmount: function () {
      if (root && root.parentNode) root.parentNode.removeChild(root);
      root = view = null;
      Object.keys(pads).forEach(function (k) { delete pads[k]; });
    },
  };
})();
